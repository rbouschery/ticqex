# Vision

> Related: [PHASES.md](./PHASES.md) · [NAMING.md](./NAMING.md) · [API.md](./API.md)

## One-liner

**Ticqex** is an open-core, API-first support platform with a realtime Kanban admin — built so tickets can come from anywhere.

## Problem

Most support tools are either:

- **Customer-portal first** — great UX for end-users, but the admin/API layer is an afterthought
- **Enterprise bloated** — rigid schemas, heavy UI, poor developer experience
- **Closed source** — hard to self-host, extend, or wire into custom stacks

Teams that want **flexible ticketing** (custom fields, multiple ingress channels, AI agent access) without building everything from scratch lack a Plain-caliber option that is fully open source.

## Solution

A support **backend** with:

1. **API-first** — every action available via REST; admin UI uses the same API
2. **Flexible data model** — tickets and customers driven by admin-defined custom fields
3. **Kanban admin** — the primary GUI; lanes = configurable status types
4. **Channel-agnostic ingress** — API keys, email (v1), webhooks and more later
5. **Open core (MIT)** — core is fully OSS; premium/hosted features optional later

## What we're building (v1)

| In scope | Out of scope (v1) |
|----------|-------------------|
| Kanban board + ticket CRUD | Customer-facing portal |
| Message threads (internal + public) | Webhooks |
| Custom fields on board | SLAs, priorities, due dates |
| Email in/out via Resend | Audit log |
| API key auth for integrations | Multi-tenant / workspaces |
| Copy conversation for AI | Manual file uploads |
| Realtime board updates | |
| Email attachments (inbound parse) | |

See [PHASES.md](./PHASES.md) for the full build sequence.

## Principles

### 1. API first, UI second

The admin GUI is a **client of the API**, not a special case. External agents, scripts, and future UIs call the same endpoints.

```
External client ──┐
AI agent ─────────┼──► /api/v1/* ──► Service layer ──► Supabase
Admin UI ─────────┘
```

Exception: **Supabase Realtime** subscriptions in the admin UI for live Kanban updates (read-only push; mutations still go through the API).

### 2. Flexible by default

- Tickets and customers have **core props** + **admin-defined custom fields**
- Status lanes, tags, and field visibility are **configurable** without code changes
- `globalSettings` drives what's shown on the board

### 3. Boring stack, sharp edges

- **Next.js** on Vercel — Route Handlers as the API surface
- **Supabase** — Postgres, Auth, RLS, Realtime, Storage (all-in; no abstraction layer for v1)
- **Trigger.dev** — inbound/outbound email processing, scheduled jobs
- **Resend** — email provider behind a swappable adapter interface

Business logic lives in a **service layer** (`/server` or `/lib`) so the API can be extracted to a standalone service later without a rewrite.

### 4. Open core, not open bait

Inspired by [Chatwoot](https://github.com/chatwoot/chatwoot) (MIT core + enterprise directory):

| Layer | License | Location |
|-------|---------|----------|
| **Core** | MIT | Root repo — API, admin UI, schema, email adapter |
| **Enterprise / Cloud** | Separate license (TBD) | `/enterprise` directory or separate repo |

**Core (MIT) includes everything needed to self-host a fully functional support desk:**

- Full CRUD API
- Kanban admin UI
- Custom fields, statuses, tags
- Email integration
- API keys
- Realtime board

**Enterprise / hosted (future, not v1) might include:**

- Multi-tenant workspace management
- Advanced analytics & reporting
- SSO / SAML
- Audit log & compliance exports
- Managed hosting (Ticqex Cloud)
- Priority support

The `/enterprise` directory exists from day one (even if empty) to make the boundary explicit — same pattern as Chatwoot.

### 5. Self-hostable without pain

Primary path: **Vercel + Supabase Cloud** (free tiers, fast setup).

Future: Docker Compose for fully local/on-prem (post-v1, see [PHASES.md](./PHASES.md) Phase 6).

## Users & personas

### v1: Support agent (staff)

- Uses the Kanban admin daily
- Creates/edits tickets, replies to customers, moves cards
- Configures board visibility and custom fields (admin role)

### v1: Integration / AI agent

- Authenticates with **API key**
- Creates tickets, adds messages, queries/filters tickets
- No UI — pure API consumer

### v1: Customer (external contact)

- **No login, no portal**
- Exists as a record linked to tickets
- Interacts via email (inbound/outbound) only

### Future: Customer portal

- Deferred — API and data model should not block it

## Comparable products

| Product | Relationship |
|---------|--------------|
| **Plain** | UX/philosophy north star — developer-friendly, minimal |
| **Chatwoot** | OSS model north star — MIT open core |
| **Help Scout** | Email-centric simplicity reference |
| **Zammad** | Feature scope reference (but we're simpler) |

**Explicitly not building:** Zendesk-scale enterprise, Intercom-style messaging widget, full ITSM.

## Success metrics (v1)

- [ ] Create a ticket via API, see it on the Kanban board
- [ ] Send an email, ticket auto-created with thread
- [ ] Reply from admin, customer receives email
- [ ] Move ticket between lanes (drag + API), board updates in realtime for another agent
- [ ] Filter tickets by custom field via API
- [ ] Copy full conversation context as markdown/text for AI
- [ ] External script creates ticket with API key — no UI needed

## Open decisions

| Item | Status | Notes |
|------|--------|-------|
| Final product name | **Ticqex** | See [NAMING.md](./NAMING.md) |
| Enterprise license | Deferred | MIT for core; commercial terms TBD when `/enterprise` has features |
| Docker self-host | Post-v1 | Phase 6 |
| Webhooks | Post-v1 | Phase 7 |
