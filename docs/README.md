# Ticqex — Planning Docs

Interlinked specifications for an API-first, open-core support/ticketing platform.

## Documents

| Doc | Purpose |
|-----|---------|
| [VISION.md](./VISION.md) | Product vision, principles, open-core strategy, license |
| [NAMING.md](./NAMING.md) | Brand name decision and assets |
| [DATA-MODEL.md](./DATA-MODEL.md) | Entities, relationships, custom fields |
| [API.md](./API.md) | REST API design, auth, filtering, conventions |
| [PHASES.md](./PHASES.md) | Phased build plan with dependencies |
| [INTEGRATIONS.md](./INTEGRATIONS.md) | Email, Trigger.dev, Realtime, adapter contracts |

## How to read these

```
VISION ──► PHASES ──► (implementation)
   │           │
   ├── DATA-MODEL ◄──► API
   │           │
   └── INTEGRATIONS
```

Start with **VISION** for the "why", then **PHASES** for the "when", and use **DATA-MODEL** + **API** as the build reference.

## Decisions log

| Decision | Choice |
|----------|--------|
| **Product name** | Ticqex |
| License (core) | MIT — open core |
| Tenancy (v1) | Single instance = one team |
| Admin data access | API only (no Supabase client in browser) |
| Realtime | Supabase Realtime for admin Kanban |
| DB | All-in on Supabase |
| Deploy | Vercel + Supabase Cloud |
| API surface | Next.js Route Handlers + service layer |
| Async jobs | Trigger.dev (email, scheduled jobs) |
| Email | Resend (swappable adapter) |
| Webhooks | Deferred post-v1 |
