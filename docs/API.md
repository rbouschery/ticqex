# API Design

> Related: [DATA-MODEL.md](./DATA-MODEL.md) · [VISION.md](./VISION.md) · [INTEGRATIONS.md](./INTEGRATIONS.md)

## Overview

REST JSON API at `/api/v1/*`. All consumers — admin UI, external scripts, AI agents — use the same endpoints.

```
Base URL:  https://your-instance.com/api/v1
Format:    application/json
Auth:      Bearer token (staff session or API key)
Errors:    { "error": { "code": "...", "message": "..." } }
```

## Authentication

Two auth modes, same endpoints:

| Mode | Header | Used by |
|------|--------|---------|
| **Staff session** | `Authorization: Bearer <supabase_jwt>` | Admin UI (after login) |
| **API key** | `Authorization: Bearer tq_live_<key>` | Integrations, AI agents |

API key format: `tq_live_<random>` (prefix stored in `api_keys.key_prefix` for lookup).

**Authorization:**

- All authenticated requests: read/write tickets, messages, customers
- Settings + custom field definitions: `admin` role only
- API keys: full agent access (no role distinction in v1); created by admin

## Conventions

### Request / response shapes

**Single resource:**

```json
{
  "data": { "id": "...", "title": "...", "...": "..." }
}
```

**List:**

```json
{
  "data": [ { "...": "..." }, { "...": "..." } ],
  "meta": {
    "total": 42,
    "page": 1,
    "per_page": 25
  }
}
```

**Error:**

```json
{
  "error": {
    "code": "not_found",
    "message": "Ticket not found"
  }
}
```

### Pagination

```
GET /api/v1/tickets?page=1&per_page=25
```

Defaults: `page=1`, `per_page=25`, max `per_page=100`.

### Timestamps

ISO 8601 UTC: `"2026-05-19T20:00:00Z"`

### IDs

UUID v4 everywhere.

### Custom fields in payloads

Custom fields appear as a nested object keyed by field `key`:

```json
{
  "data": {
    "id": "...",
    "title": "Emails not sending",
    "custom_fields": {
      "plan": "Unlimited",
      "seat_count": 12,
      "metadata": { "region": "eu-west" }
    }
  }
}
```

On write, same shape — only include fields you want to set/update.

## Endpoints

### Tickets

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/tickets` | List tickets (with filters) |
| `POST` | `/tickets` | Create ticket |
| `GET` | `/tickets/:id` | Get ticket with messages + custom fields |
| `PATCH` | `/tickets/:id` | Update ticket (title, status, assignee, tags, custom fields) |
| `DELETE` | `/tickets/:id` | Delete ticket |
| `GET` | `/tickets/:id/context` | Export conversation as markdown (AI copy feature) |

**Create ticket:**

```json
POST /api/v1/tickets
{
  "title": "Emails not sending",
  "customer": { "username": "user@example.com" },
  "status_id": "uuid",
  "assignee_id": "uuid",
  "origin": "api",
  "tags": ["bug"],
  "message": {
    "body": "Since yesterday our transactional emails stopped...",
    "visibility": "public"
  },
  "custom_fields": {
    "plan": "Unlimited"
  }
}
```

`customer.username` triggers find-or-create. If `status_id` omitted, defaults to first status.

**Update ticket (partial):**

```json
PATCH /api/v1/tickets/:id
{
  "status_id": "uuid",
  "assignee_id": "uuid",
  "custom_fields": { "plan": "Pro" }
}
```

### Messages

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/tickets/:id/messages` | List messages for ticket |
| `POST` | `/tickets/:id/messages` | Add message (reply or internal note) |

**Add message:**

```json
POST /api/v1/tickets/:ticketId/messages
{
  "body": "We've identified the issue...",
  "visibility": "public",
  "channel": "admin"
}
```

When `visibility: "public"` and ticket originated from email, triggers outbound email via Trigger.dev. See [INTEGRATIONS.md](./INTEGRATIONS.md#outbound-email).

### Customers

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/customers` | List customers |
| `POST` | `/customers` | Create customer |
| `GET` | `/customers/:id` | Get customer with custom fields + ticket count |
| `PATCH` | `/customers/:id` | Update customer |
| `DELETE` | `/customers/:id` | Delete customer (fails if tickets exist) |

### Status types

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/statuses` | List all status types (ordered by position) |
| `POST` | `/statuses` | Create status (admin) |
| `PATCH` | `/statuses/:id` | Update status (admin) |
| `DELETE` | `/statuses/:id` | Delete status (admin; fails if tickets use it) |
| `PUT` | `/statuses/reorder` | Reorder lanes `{ "ids": ["uuid", ...] }` |

### Tags

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/tags` | List tags |
| `POST` | `/tags` | Create tag (admin) |
| `PATCH` | `/tags/:id` | Update tag (admin) |
| `DELETE` | `/tags/:id` | Delete tag (admin) |

### Custom field definitions

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/custom-fields` | List definitions (`?group=ticket\|customer`) |
| `POST` | `/custom-fields` | Create definition (admin) |
| `PATCH` | `/custom-fields/:id` | Update definition (admin) |
| `DELETE` | `/custom-fields/:id` | Delete definition (admin) |

### Settings

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/settings` | Get global settings |
| `PATCH` | `/settings` | Update global settings (admin) |

### API keys

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api-keys` | List keys (prefix + metadata only) |
| `POST` | `/api-keys` | Create key (returns full key once) |
| `DELETE` | `/api-keys/:id` | Revoke key |

### Users (staff)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/users` | List staff users |
| `GET` | `/users/me` | Current user |

User management (invite, role change) via Supabase Auth + `users` table sync in v1.

### Board (convenience)

Optimized endpoint for the Kanban admin UI.

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/board` | All visible lanes with tickets (respects `global_settings`) |

```json
GET /api/v1/board

{
  "data": {
    "lanes": [
      {
        "status": { "id": "...", "name": "New", "color": "#..." },
        "tickets": [
          {
            "id": "...",
            "title": "Emails not sending",
            "preview": "Since yesterday...",
            "customer": { "username": "user@example.com", "initials": "UE" },
            "assignee": { "username": "Robert", "initials": "RB" },
            "custom_fields": { "plan": "Unlimited" },
            "tags": [{ "name": "bug", "color": "#..." }],
            "updated_at": "..."
          }
        ]
      }
    ]
  }
}
```

## Filtering

v1: simple exact-match filters on `GET /tickets`.

```
GET /api/v1/tickets?status_id=<uuid>
GET /api/v1/tickets?assignee_id=<uuid>
GET /api/v1/tickets?customer_id=<uuid>
GET /api/v1/tickets?tag=<name>
GET /api/v1/tickets?origin=email
GET /api/v1/tickets?custom_fields.plan=Unlimited
GET /api/v1/tickets?custom_fields.seat_count=12
```

**Custom field filter syntax:** `custom_fields.<key>=<value>`

- Exact match only in v1
- Multiple params = AND
- API response includes matching `meta.filters` for transparency

**Future (post-v1):** `filter[plan][eq]=Unlimited`, range operators, OR groups. Design query params to extend without breaking v1 clients.

## Copy context (AI feature)

```
GET /api/v1/tickets/:id/context
```

Returns markdown:

```markdown
# Emails not sending

**Customer:** user@example.com (Plan: Unlimited)
**Status:** In Process
**Tags:** bug

---

**user@example.com** (2026-05-19 14:00):
Since yesterday our transactional emails stopped...

**Robert** (2026-05-19 15:30):
We've identified the issue with the SMTP relay...

---

[Internal note — Robert, 2026-05-19 15:31]:
Checked Resend dashboard, rate limit hit.
```

Internal notes included by default (staff-only endpoint). Optional `?exclude_internal=true`.

## Realtime (admin UI only)

Not part of the REST API. Admin UI subscribes to Supabase Realtime:

```typescript
supabase
  .channel('board')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'tickets' }, handler)
  .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, handler)
  .subscribe()
```

Mutations always go through REST API. Realtime triggers board re-fetch or optimistic patch.

## Rate limiting

v1: none (single-team instance). Post-v1 / hosted: per API key limits.

## Versioning

URL prefix `/api/v1/`. Breaking changes → `/api/v2/`. Non-breaking additions (new fields, new endpoints) stay in v1.

## Service layer structure

```
/app/api/v1/tickets/route.ts     ← Route Handler (thin)
/server/services/tickets.ts      ← Business logic
/server/services/customers.ts
/server/adapters/email/resend.ts ← Swappable adapter
/server/adapters/db/supabase.ts  ← DB client (service role)
/server/middleware/auth.ts       ← JWT + API key validation
```

Route handlers: validate input → call service → format response. No business logic in handlers.

## OpenAPI spec

Generate from route definitions or maintain `docs/openapi.yaml` alongside implementation. Target: Phase 5 (OSS release).
