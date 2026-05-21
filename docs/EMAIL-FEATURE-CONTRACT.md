# Email feature implementation contract (no BCC)

## DB migration `20260521140000_email_metadata.sql`

```sql
-- messages: email metadata + HTML + delivery tracking
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS email_from text;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS email_to text[] NOT NULL DEFAULT '{}';
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS email_cc text[] NOT NULL DEFAULT '{}';
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS email_subject text;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS email_body_html text;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS email_delivery_status text;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS resend_outbound_id text;

-- global_settings: agent signature appended to outbound replies
ALTER TABLE public.global_settings ADD COLUMN IF NOT EXISTS email_signature text NOT NULL DEFAULT '';

-- canned response snippets
CREATE TABLE IF NOT EXISTS public.email_snippets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text NOT NULL,
  created_by uuid REFERENCES public.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.email_snippets ENABLE ROW LEVEL SECURITY;
CREATE POLICY email_snippets_select_authenticated ON public.email_snippets FOR SELECT TO authenticated USING (true);
CREATE POLICY email_snippets_write_admin ON public.email_snippets FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin')
);

-- staged outbound attachment uploads (message_id set when message is created)
CREATE TABLE IF NOT EXISTS public.message_attachment_uploads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.tickets (id) ON DELETE CASCADE,
  message_id uuid REFERENCES public.messages (id) ON DELETE CASCADE,
  filename text NOT NULL,
  content_type text NOT NULL,
  size_bytes int NOT NULL,
  storage_path text NOT NULL,
  uploaded_by uuid REFERENCES public.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.message_attachment_uploads ENABLE ROW LEVEL SECURITY;
CREATE POLICY message_attachment_uploads_authenticated ON public.message_attachment_uploads FOR ALL TO authenticated USING (true);
```

## API: POST `/api/v1/tickets/:id/messages`

```typescript
{
  body: string;
  visibility: "public" | "internal";
  channel?: "admin" | "email" | "api";
  email?: {
    cc?: string[];           // explicit CC list (merged with reply-all logic server-side)
    subject?: string;        // override; server defaults Re: last subject
    reply_all?: boolean;     // if true, CC = last inbound message's CC (+ To extras except customer)
    include_quote?: boolean; // append quoted previous message to body before send
    attachment_upload_ids?: string[];
  };
}
```

## API: POST `/api/v1/tickets/:id/attachment-uploads` (multipart FormData, field `file`)

Returns `{ id, filename, content_type, size_bytes }`.

## API: GET `/api/v1/messages/:messageId/attachments/:attachmentId` 

Returns signed download URL redirect or JSON `{ url }`.

## API: GET/POST `/api/v1/email-snippets` CRUD for snippets

## API: POST `/api/webhooks/resend/events`

Resend delivery webhooks (`email.sent`, `email.delivered`, `email.bounced`, `email.failed`) → update `messages.email_delivery_status` via `resend_outbound_id`.

## Message response shape (getTicket messages[])

```typescript
{
  id, body, visibility, author_type, author_id, channel, created_at, read?,
  email_from?: string | null;
  email_to?: string[];
  email_cc?: string[];
  email_subject?: string | null;
  email_body_html?: string | null;
  email_delivery_status?: string | null;
  attachments?: { id: string; filename: string; content_type: string; size_bytes: number }[];
}
```

## Subject default logic

`formatReplySubject(lastSubject, fallback?)` in `src/lib/format-subject.ts` (re-exported from `server/lib/utils.ts`) — if already starts with Re:/Fwd:, prefix `Re: ` once.

## CC default on reply

- `reply_all: false` → CC = `email.cc` from request only (default [])
- `reply_all: true` → CC = last **customer** message's `email_cc` + other `email_to` except support address and customer
- To always = customer.username (locked in UI)

## Outbound send

Extend `OutboundEmail`: `cc?: string[]`, `html?: string`, `attachments`
Store snapshot metadata on message row after send.

## Inbound parse

Extend `ParsedEmail`: `fromName?`, `to: string[]`, `cc: string[]`, `bodyHtml?`
Populate from Resend receiving API headers.
