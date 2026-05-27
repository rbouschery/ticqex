# Integrations

> Related: [API.md](./API.md) · [DATA-MODEL.md](./DATA-MODEL.md) · [PHASES.md](./PHASES.md)

## Integration architecture

```
                    ┌─────────────┐
  Inbound email ──► │   Resend    │──webhook──► Next.js webhook route
                    └─────────────┘                    │
                                                       ▼
                                               after() background work
                                               (parse + match)
                                                       │
                                                       ▼
                                               Service layer ──► Supabase

  Admin reply ──► POST /api/v1/tickets/:id/messages
                           │
                           ▼
                   after() ──► Resend ──► Customer inbox

  Admin UI (read) ──► Supabase Realtime ──► Board update
  Admin UI (write) ──► REST API (same as external clients)
```

## Email (Resend)

### Adapter interface

Swappable provider behind a common interface. Resend is the v1 implementation.

```typescript
// /server/adapters/email/types.ts

interface EmailAdapter {
  send(params: OutboundEmail): Promise<{ messageId: string }>
  parseInbound(raw: InboundWebhookPayload): ParsedEmail
}

interface OutboundEmail {
  to: string
  from: string           // "Support <support@yourdomain.com>"
  subject: string
  body: string           // plain text or HTML
  inReplyTo?: string     // Message-ID for threading
  references?: string[]  // Thread Message-IDs
  attachments?: Attachment[]
}

interface ParsedEmail {
  from: string
  to: string
  subject: string
  body: string
  messageId: string
  inReplyTo?: string
  references?: string[]
  attachments: ParsedAttachment[]
}
```

Implementation: `/server/adapters/email/resend.ts`

Future: add `/server/adapters/email/postmark.ts` etc. without changing service layer.

### Inbound email flow

```
1. Customer sends email to support@yourdomain.com
2. Resend receives → POST /api/webhooks/resend/inbound
3. Webhook route validates signature → schedules background work via `after()`
4. Background work runs:
   a. Parse email (from, subject, body, headers, attachments)
   b. Find/create customer by `from` address → customers.username
   c. Match ticket (see Threading below)
   d. Create message (visibility: public, author: customer, channel: email)
   e. Store attachments in Supabase Storage
   f. If new ticket: set origin=email, title=subject, status=first lane
5. Realtime pushes update to admin board
```

### Email threading

Priority order for matching inbound email to existing ticket:

| Priority | Method | How |
|----------|--------|-----|
| 1 | **Message-ID / In-Reply-To** | `In-Reply-To` header matches any `messages.email_message_id` for this instance → attach to that ticket |
| 2 | **References header** | Any ID in `References` matches a known `email_message_id` |
| 3 | **Subject + customer fallback** | Normalize subject (strip `Re:`, `Fwd:`, `[TAGS]`) + match `email_threads.subject` + `customer.username` |
| 4 | **Create new ticket** | No match found |

Normalization example:

```
"Re: [Bug] Emails not sending" → "Emails not sending"
"Fwd: Re: Emails not sending"  → "Emails not sending"
```

Store mapping in `email_threads` table when a ticket is first created via email.

### Outbound email flow

Triggered when a **public** message is created with `channel: admin` or `channel: api`:

```
1. POST /api/v1/tickets/:id/messages { visibility: "public", ... }
2. Service layer creates message in DB
3. Schedules outbound send via `after()`:
   a. Load ticket + customer + thread history
   b. Build email with proper headers:
      - From: "Support <support@yourdomain.com>"
      - To: customer.username
      - Subject: "Re: {ticket.title}"
      - In-Reply-To: last message's email_message_id
      - References: all message IDs in thread
   c. Send via Resend adapter
   d. Store returned Message-ID on the message row
4. Internal notes (visibility: internal) skip this flow entirely
```

### Customer matching

```typescript
async function findOrCreateCustomer(username: string): Promise<Customer> {
  const existing = await db.customers.findByUsername(username)
  if (existing) return existing
  return db.customers.create({ username })
}
```

`username` is typically an email address but can be any unique string (external ID, handle).

### Environment variables

```env
RESEND_API_KEY=re_...
RESEND_INBOUND_WEBHOOK_SECRET=whsec_...
SUPPORT_EMAIL=support@yourdomain.com
SUPPORT_FROM_NAME=Support
```

## Background email processing

Async email work uses Next.js [`after()`](https://nextjs.org/docs/app/api-reference/functions/after) on Vercel — same process, no external job runner.

| Work | Trigger | Purpose |
|------|---------|---------|
| Inbound parse + ticket create | Resend webhook → `enqueueInboundEmail()` | Fetch body, match thread, persist message |
| Outbound reply | Public message created | Send via Resend adapter |
| Stale ticket digest | Cron (daily) | Optional; not implemented |
| Cleanup attachments | Cron (weekly) | Optional; not implemented |

### Why `after()`

- Inbound parsing can be slow (attachments, storage upload) — respond to webhook quickly
- Outbound send shouldn't block the API response
- Vercel Fluid Compute extends function lifetime for background work
- DB dedupe (`resend_inbound_id`, `email_message_id`) prevents duplicate messages on webhook retries

### Implementation

```typescript
// server/adapters/email/background.ts
import { after } from "next/server"
import { resendAdapter } from "@server/adapters/email/resend"
import { processInboundEmail } from "@server/services/email-inbound"

export function enqueueInboundEmail(raw: InboundWebhookPayload) {
  after(async () => {
    const parsed = await resendAdapter.resolveInbound(raw)
    await processInboundEmail(parsed)
  })
}
```

Phase 5 scheduled jobs can use Vercel Cron or Supabase pg_cron when needed.

## Supabase Realtime

### Usage

Admin UI only. Read-only push channel.

```typescript
// Subscribe to ticket changes
supabase.channel('board')
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'tickets'
  }, (payload) => {
    // Re-fetch affected lane or patch local state
  })
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'messages'
  }, (payload) => {
    // Update ticket card preview if message belongs to visible ticket
  })
  .subscribe()
```

### RLS for Realtime

Authenticated staff users need **SELECT** policy on `tickets`, `messages`, `customers`, `custom_field_values` for Realtime to deliver events. Write policies are not needed (writes go through API with service role).

```sql
-- Example: agents can read all tickets (single-tenant v1)
CREATE POLICY "Staff can read tickets"
  ON tickets FOR SELECT
  TO authenticated
  USING (true);
```

### What Realtime does NOT do

- Auth validation (handled by Supabase Auth session)
- Business logic (handled by API)
- Write operations (handled by API)

## Supabase Storage

### Bucket: `attachments`

- Path: `attachments/{ticket_id}/{message_id}/{filename}`
- Access: signed URLs via API (never public bucket)
- Max file size: configure in Supabase (default 50MB; v1 email attachments typically smaller)
- Allowed types: v1 permissive (email can attach anything); restrict in hosted version if needed

## Webhooks (deferred — Phase 7)

Placeholder contract for when implemented:

```typescript
interface WebhookEndpoint {
  id: string
  url: string
  events: WebhookEvent[]
  secret: string  // HMAC signing
  active: boolean
}

type WebhookEvent =
  | 'ticket.created'
  | 'ticket.updated'
  | 'ticket.status_changed'
  | 'message.created'
  | 'customer.created'
```

Delivery via background job with exponential backoff (TBD — Vercel Cron or pg_cron). Payload signed with `X-Ticqex-Signature` HMAC header.

v1: not implemented. API + email cover initial integration needs.

## AI agent integration (v1)

No special SDK needed. Agents use the REST API with an API key:

```bash
# Agent creates a ticket
curl -X POST https://instance.com/api/v1/tickets \
  -H "Authorization: Bearer tq_live_..." \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Auto-detected: API latency spike",
    "customer": { "username": "monitoring@internal" },
    "origin": "api",
    "message": { "body": "Latency exceeded 2s threshold...", "visibility": "internal" }
  }'

# Agent reads context
curl https://instance.com/api/v1/tickets/:id/context \
  -H "Authorization: Bearer tq_live_..."
```

Future: MCP server or `@ticqex/agent` SDK (post-v1).

## Environment variables (complete)

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
SUPABASE_SECRET_KEY=sb_secret_...

# Auth
# (handled by Supabase — no extra vars)

# Email
RESEND_API_KEY=re_...
RESEND_INBOUND_WEBHOOK_SECRET=whsec_...
SUPPORT_EMAIL=support@yourdomain.com
SUPPORT_FROM_NAME=Support

# App
NEXT_PUBLIC_APP_URL=https://your-instance.com
```

## Adapter swap guide

| Integration | Interface location | v1 impl | To swap |
|-------------|-------------------|---------|---------|
| Email | `/server/adapters/email/types.ts` | `resend.ts` | Implement interface, change env var |
| Database | Direct Supabase client in services | Supabase | Phase 6+ if needed |
| Job queue | Next.js `after()` on Vercel | `background.ts` | Would need external runner if moving off Vercel |
| Realtime | Supabase Realtime | Supabase | Would need WebSocket server |

Email is the only adapter designed for swapping in v1. Everything else is Supabase-native by design.
