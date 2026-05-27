# Ticqex

> API-first, open-core support platform with a realtime Kanban admin.

Spec and planning docs live in [`docs/`](./docs/README.md).

## Status

**Phase 4 (Live board)** — Supabase Realtime sync across tabs; drag-and-drop error feedback. See [PHASES.md](./docs/PHASES.md).

## Quick start

### Prerequisites

- Node.js 20+
- [pnpm](https://pnpm.io/)
- [Docker](https://www.docker.com/) (for local Supabase)

### 1. Install dependencies

```bash
pnpm install
cp .env.example .env.local
```

### 2. Local Supabase

Start the stack, sync API keys into `.env.local`, apply migrations, and seed the admin user:

```bash
pnpm db:start
pnpm db:env          # writes NEXT_PUBLIC_SUPABASE_* and SUPABASE_SECRET_KEY
pnpm db:reset        # migrations + seed.sql
pnpm db:seed-admin   # admin@ticqex.local (password from .env.local)
```

`pnpm db:env` reads publishable and secret keys from `supabase status -o json` (`PUBLISHABLE_KEY` / `SECRET_KEY`).

### 3. Run the app

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000), sign in with `SEED_ADMIN_*` credentials from `.env.local`, and check [http://localhost:3000/api/health](http://localhost:3000/api/health).

### Environment reference

| Variable | Source | Required for |
|----------|--------|----------------|
| `NEXT_PUBLIC_SUPABASE_URL` | `pnpm db:env` | App + API |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `pnpm db:env` | App auth (client) |
| `SUPABASE_SECRET_KEY` | `pnpm db:env` | Admin seed, server jobs |
| `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` | `.env.example` defaults | `pnpm db:seed-admin` |
| `RESEND_*`, `SUPPORT_*` | Cursor Cloud secrets or `.env.local` | Email in/out |

Async email processing uses Next.js `after()` — no external job runner required.

### Cloud Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. `pnpm supabase link --project-ref <ref>`
3. `pnpm supabase db push`
4. Set cloud URL, publishable key, and secret key in `.env.local`, then `pnpm db:seed-admin`.

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Next.js dev server (UI, API, background email) |
| `pnpm env:verify` | Check required env vars are set |
| `pnpm db:start` / `db:stop` / `db:reset` | Local Supabase |
| `pnpm db:env` | Sync Supabase keys → `.env.local` |
| `pnpm db:seed-admin` | Create local admin user |

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
- [Integrations (email, Realtime)](./docs/INTEGRATIONS.md)

## License

Core: [MIT](./LICENSE) · Enterprise: see [`/enterprise`](./enterprise/README.md)
