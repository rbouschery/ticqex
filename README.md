# Ticqex

> API-first, open-core support platform with a realtime Kanban admin.

## Quick start

### Prerequisites

- Node.js 20+
- [pnpm](https://pnpm.io/)
- [Docker](https://www.docker.com/) (for local Supabase)

### 1. Install dependencies

```bash
pnpm install
```

### 2. Interactive setup

Use the repo-local CLI to configure Supabase setup and choose active channels/integrations:

```bash
pnpm ticqex init
```

For local development, choose `local` and then `start`, `reset`, or `skip`. If local Supabase has already been initialized, you can run:

```bash
pnpm ticqex init --supabase skip
```

For Supabase Cloud, run:

```bash
pnpm ticqex init --supabase cloud
```

The cloud flow links the project and can push migrations, but it does not fetch or write cloud keys. It prints the Supabase env vars you need to set in `.env.local` or deployment settings.

The CLI writes `.env.local` (ignored by git — set the same keys in Vercel env vars for deploy) and may update `config/ticqex.config.json` (committed — edit and push to change channels/integrations on Vercel). Use `config/ticqex.config.example.json` as the template when bootstrapping a fresh clone.

After init, `pnpm config:sync` validates activation and reports planned channel field policies (database upsert comes in a later slice). Use `pnpm config:check` to verify channel/integration bindings and required env vars.

Manual equivalents:

```bash
pnpm db:start
pnpm db:env          # writes NEXT_PUBLIC_SUPABASE_* and SUPABASE_SECRET_KEY
pnpm db:bootstrap    # status columns + global_settings (empty board; no admin user)
pnpm db:seed-admin   # optional admin@ticqex.local
```

Optional: `pnpm db:reset` applies migrations and seed data, but wipes the local DB.

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
| `RESEND_*`, `SUPPORT_*` | `.env.local` | Email in/out |

Async email processing uses Next.js `after()` — no external job runner required.

### Cloud Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. `pnpm ticqex init --supabase cloud`
3. Choose whether to push migrations to the linked project.
4. Set cloud URL, publishable key, and secret key in `.env.local` or deployment settings.

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Next.js dev server (UI, API, background email) |
| `pnpm ticqex init` | Interactive setup for local Supabase, env vars, channels, and integrations |
| `pnpm config:check` | Validate `config/ticqex.config.json` bindings and required env vars |
| `pnpm config:sync` | Validate activation JSON and print planned channel field sync (dry-run) |
| `pnpm env:verify` | Check Supabase env vars (`pnpm db:env`); use `config:check` for email/Resend |
| `pnpm db:start` / `db:stop` / `db:reset` | Local Supabase |
| `pnpm db:bootstrap` | Required statuses + settings (empty board) |
| `pnpm db:env` | Sync Supabase keys → `.env.local` |
| `pnpm db:seed-admin` | Optional: create local admin user |

## Project layout

| Path | Purpose |
|------|---------|
| `src/app/` | Next.js App Router (admin UI, API routes) |
| `server/services/` | Business logic |
| `server/channels/` | Product channel behavior (email, future chat channels) |
| `server/integrations/` | External provider integrations (Resend) |
| `config/` | OSS activation config (`ticqex.config.json` — version-controlled; `ticqex.config.example.json` is the bootstrap template) |
| `supabase/migrations/` | Database schema |

## License

[MIT](./LICENSE)
