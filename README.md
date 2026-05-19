# Ticqex

> API-first, open-core support platform with a realtime Kanban admin.

Spec and planning docs live in [`docs/`](./docs/README.md).

## Status

**Phase 0 (Foundation)** — Next.js app, Supabase schema, staff auth, health check. See [PHASES.md](./docs/PHASES.md).

## Quick start

### Prerequisites

- Node.js 20+
- [pnpm](https://pnpm.io/)
- [Docker](https://www.docker.com/) (for local Supabase)

### Setup

```bash
pnpm install
cp .env.example .env.local
# Fill keys from `pnpm supabase status` after starting Supabase

pnpm db:start          # start local Supabase
pnpm db:reset          # migrations + seed.sql
pnpm db:seed-admin     # create admin staff user

pnpm dev
```

Open [http://localhost:3000](http://localhost:3000), sign in with `SEED_ADMIN_*` credentials, and hit [http://localhost:3000/api/health](http://localhost:3000/api/health).

### Cloud Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. `pnpm supabase link --project-ref <ref>`
3. `pnpm supabase db push`
4. Run `pnpm db:seed-admin` with cloud URL and service role key in `.env.local`.

## Project layout

| Path | Purpose |
|------|---------|
| `src/app/` | Next.js App Router (admin UI, API routes) |
| `server/services/` | Business logic (Phase 1+) |
| `server/adapters/` | External integrations (email in Phase 3) |
| `supabase/migrations/` | Database schema |
| `enterprise/` | Commercial / hosted features (open-core boundary) |

## Quick links

- [Vision & principles](./docs/VISION.md)
- [Naming](./docs/NAMING.md)
- [Data model](./docs/DATA-MODEL.md)
- [API design](./docs/API.md)
- [Phased build plan](./docs/PHASES.md)
- [Integrations (email, Trigger.dev, Realtime)](./docs/INTEGRATIONS.md)

## License

Core: [MIT](./LICENSE) · Enterprise: see [`/enterprise`](./enterprise/README.md)
