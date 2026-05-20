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
- [Trigger.dev](https://trigger.dev/) account (for background jobs in local dev)

### 1. Install dependencies

```bash
pnpm install
cp .env.example .env.local
```

### 2. Local Supabase

Start the stack, sync API keys into `.env.local`, apply migrations, and seed the admin user:

```bash
pnpm db:start
pnpm db:env          # writes NEXT_PUBLIC_SUPABASE_* and SUPABASE_SERVICE_ROLE_KEY
pnpm db:reset        # migrations + seed.sql
pnpm db:seed-admin   # admin@ticqex.local (password from .env.local)
```

`pnpm db:env` reads JWT keys from `supabase status -o json` (not the `sb_publishable_*` / `sb_secret_*` lines in the human-readable status output).

### 3. Trigger.dev (background jobs)

Email and other async work use Trigger.dev tasks in [`trigger/`](./trigger/). The placeholder `proj_ticqex` in `.env.example` is not a real project — you need a cloud project linked to this repo.

**First time on this machine:**

```bash
pnpm trigger:login   # opens browser; skip if already logged in
pnpm trigger:create  # creates "ticqex" in Trigger.dev (Sempervirens org) if missing
pnpm trigger:env     # writes TRIGGER_PROJECT_REF + TRIGGER_SECRET_KEY to .env.local
```

**If the project already exists** (e.g. another clone already created it), link manually:

```bash
pnpm trigger:init    # pick the existing "ticqex" project in the prompt
pnpm trigger:env
```

Or pass a project ref directly: `pnpm trigger:env -- --project-ref=proj_xxxx`.

Dashboard: [cloud.trigger.dev](https://cloud.trigger.dev) → project **ticqex** → `proj_lrkynmfueucqbdnizato` (current dev project).

### 4. Run the app

```bash
pnpm dev:all         # Next.js (3000) + Trigger.dev dev worker
# or separately:
pnpm dev
pnpm trigger:dev
```

Open [http://localhost:3000](http://localhost:3000), sign in with `SEED_ADMIN_*` credentials from `.env.local`, and check [http://localhost:3000/api/health](http://localhost:3000/api/health).

### Environment reference

| Variable | Source | Required for |
|----------|--------|----------------|
| `NEXT_PUBLIC_SUPABASE_URL` | `pnpm db:env` | App + API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `pnpm db:env` | App auth (client) |
| `SUPABASE_SERVICE_ROLE_KEY` | `pnpm db:env` | Admin seed, server jobs |
| `TRIGGER_PROJECT_REF` | `pnpm trigger:env` | Trigger.dev CLI + tasks |
| `TRIGGER_SECRET_KEY` | `pnpm trigger:env` | Triggering tasks from Next.js |
| `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` | `.env.example` defaults | `pnpm db:seed-admin` |
| `RESEND_*`, `SUPPORT_*` | Manual | Phase 3 email (optional locally) |

Without `TRIGGER_SECRET_KEY`, the app still runs; inbound/outbound email handlers fall back to inline processing where implemented.

### Cloud Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. `pnpm supabase link --project-ref <ref>`
3. `pnpm supabase db push`
4. Set cloud URL and service role key in `.env.local`, then `pnpm db:seed-admin`.

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Next.js only |
| `pnpm dev:all` | Next.js + Trigger.dev |
| `pnpm db:start` / `db:stop` / `db:reset` | Local Supabase |
| `pnpm db:env` | Sync Supabase keys → `.env.local` |
| `pnpm db:seed-admin` | Create local admin user |
| `pnpm trigger:login` | Authenticate Trigger.dev CLI |
| `pnpm trigger:create` | Create/link cloud project |
| `pnpm trigger:env` | Sync Trigger.dev keys → `.env.local` |
| `pnpm trigger:dev` | Trigger.dev dev worker |

## Project layout

| Path | Purpose |
|------|---------|
| `src/app/` | Next.js App Router (admin UI, API routes) |
| `server/services/` | Business logic (Phase 1+) |
| `server/adapters/` | External integrations (email in Phase 3) |
| `trigger/` | Trigger.dev background tasks |
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
