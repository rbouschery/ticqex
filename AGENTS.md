# AGENTS.md

Guidance for AI agents and contributors working in this repository. Keep changes
small, typed, and tested. Human-facing setup lives in [README.md](./README.md);
contribution process lives in [CONTRIBUTING.md](./CONTRIBUTING.md).

## If asked to set up this repo for the user

`pnpm ticqex init` is local-only. Do not use it for Supabase Cloud or Vercel.

### Local setup

1. `pnpm install`
2. `pnpm ticqex init`
   - Supabase: choose `local` then `start` or `reset`.
   - For UI/API/MCP only, disable the email channel.
   - For email, provide `RESEND_API_KEY`, support sender env vars, and webhook secrets.
3. If inbound email is needed locally, `NEXT_PUBLIC_APP_URL` must be a public HTTPS tunnel URL, not `http://localhost:3000`. Use `ngrok http 3000` or another HTTPS tunnel, then register webhooks with `pnpm resend:setup-webhooks --app-url <https-url>`.
4. Run `pnpm config:check`, `pnpm env:verify`, and `pnpm dev`.
5. Verify `http://localhost:3000/api/health`, then sign in with the seed admin credentials.

Manual fallback:

```bash
pnpm install
pnpm db:start && pnpm db:env && pnpm db:bootstrap
pnpm db:seed-admin
pnpm dev
```

### Manual cloud setup

Only do this when the user explicitly asks for cloud setup. Remote migrations affect a real Supabase database.

1. Create a Supabase Cloud project and copy the project ref.
2. Link and migrate:

   ```bash
   supabase link --project-ref <project-ref>
   supabase db push --linked
   supabase db query --linked -f supabase/bootstrap.sql
   ```

3. Copy Supabase env vars from Project Settings -> API Keys:
   `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`.
4. Create/import the Vercel project and set Production + Preview env vars:
   Supabase vars, `NEXT_PUBLIC_APP_URL`, and, if email is enabled, `RESEND_API_KEY`,
   `RESEND_INBOUND_WEBHOOK_SECRET`, `RESEND_EVENTS_WEBHOOK_SECRET`,
   `SUPPORT_EMAIL`, `SUPPORT_FROM_NAME`.
5. Deploy once with `vercel deploy --prod`.
6. If email is enabled, create a Resend API key, verify the sender/domain, run
   `RESEND_API_KEY=re_... pnpm resend:setup-webhooks --app-url https://<vercel-host>`,
   then copy the generated webhook secrets into Vercel and redeploy.
7. Seed the first admin against cloud with `NEXT_PUBLIC_SUPABASE_URL`,
   `SUPABASE_SECRET_KEY`, `SEED_ADMIN_EMAIL`, and `SEED_ADMIN_PASSWORD` in the shell:
   `pnpm db:seed-admin`.
8. Verify `https://<vercel-host>/api/health`, sign in, and test inbound email if enabled.

## What this project is

Ticqex is an agentic infrastructure layer for support ticket management, meant to
plug into the agent(s) and AI workflow of your choice. It provides the data model,
APIs, and human supervision surface; you bring the intelligence. Every ticket
action is exposed over a typed REST API (`/api/v1/*`) and an MCP server, so AI
agents are first-class operators alongside humans, who supervise on a realtime
Kanban admin. A composable, registry-based channel/integration layer adapts the
platform to each deployment; email parsing ships onboard (inbound → tickets,
outbound via Resend).
Built on Supabase (Postgres, Auth, Realtime) and Next.js (App Router), async
email work runs in-process via Next.js `after()` — there is no external job
runner.

## Tech stack

- **Next.js 16** (App Router) + **React 19**, TypeScript everywhere
- **Supabase** (Postgres, Auth, RLS) — local stack via Docker
- **Resend** for inbound/outbound email (Svix-signed webhooks)
- **Tailwind v4** + shadcn/ui + Radix for the admin UI
- **Vitest** for unit + integration tests
- **pnpm** is the only supported package manager

## Repository layout

| Path | Purpose |
|------|---------|
| `src/app/` | Next.js App Router — admin UI, API routes (`/api/v1/*`), webhooks, MCP |
| `src/components/` | React components (board, settings, account) |
| `server/services/` | Business logic (tickets, board, messages, contacts, …) |
| `server/channels/` | Product channel behavior (email today) |
| `server/integrations/` | External providers (Resend) |
| `server/lib/`, `server/middleware/` | Route handlers, auth, validation, errors |
| `shared/` | Code shared between client and server (config, registries, schemas) |
| `supabase/migrations/` | Database schema (source of truth) |
| `scripts/` | Setup/seed/verify CLIs (`pnpm ticqex`, `db:*`, `config:*`) |
| `config/` | Activation config (`ticqex.config.json`, committed) |
| `tests/unit`, `tests/integration` | Vitest suites (helpers in `tests/helpers/`) |

## Local development

Prerequisites: Node 20+ (dev pinned to Node 22 in `.nvmrc`), pnpm, Docker (for
local Supabase).

```bash
pnpm install
pnpm ticqex init        # interactive: Supabase + channels + env
pnpm dev                # http://localhost:3000
```

Manual equivalent:

```bash
pnpm db:start           # local Supabase (Docker)
pnpm db:env             # write Supabase keys → .env.local
pnpm db:bootstrap       # required statuses + settings
pnpm db:seed-admin      # optional local admin user
pnpm dev
```

Open `http://localhost:3000` (not `127.0.0.1` — Next.js dev treats them as
different origins). Health check: `http://localhost:3000/api/health` should
return `{"status":"ok","checks":{"app":"ok","database":"ok"}}`.

## Standard commands

`pnpm dev`, `pnpm build`, `pnpm lint`, `pnpm test`, `pnpm test:unit`,
`pnpm test:integration`, `pnpm db:start`, `pnpm db:stop`, `pnpm db:reset`,
`pnpm db:env`, `pnpm db:bootstrap`, `pnpm db:seed-admin`, `pnpm config:check`,
`pnpm env:verify`.

## Working agreement for agents

- **Always use `pnpm`.** Never introduce `npm`/`yarn` lockfiles.
- **Migrations are local-only.** After editing `supabase/migrations/`, apply with
  `pnpm db:reset` (clean) or `pnpm db:start` (pending) against the **local** DB
  only. Never run migrations against a remote/production Supabase project.
- **Restart the dev server yourself** after server/API/config changes or when
  Turbopack shows stale errors. Only one `pnpm dev` at a time.
- **Test your change** before finishing: `pnpm test:unit` for fast checks;
  `pnpm test:integration` after `pnpm db:env` + `pnpm db:seed-admin` for
  DB-backed behavior. Add tests under `tests/unit/` or `tests/integration/`.
- **Validate input** with Zod schemas in `server/lib/validation/`; return errors
  via the helpers in `server/lib/errors.ts` / `response.ts`.
- **Never commit secrets.** `.env.local` and credentials stay out of git
  (`.env.example` is the committed template).

## Conventions

- Business logic lives in `server/services/`; route handlers stay thin.
- Shared client/server code goes in `shared/`; keep it free of server-only deps.
- Prefer the registry pattern (`shared/registry/`) for channels/integrations.
- Comments explain *why*, not *what*. Avoid narrating obvious code.
- **UI/UX copy:** do not sprinkle filler subtitles or blurbs under every page title
  or card — navigation and labels already name the surface. Add text only when it
  teaches something non-obvious (constraints, side effects, empty states, errors).

## Gotchas

- **Supabase keys:** use publishable + secret keys from `pnpm db:env`
  (`PUBLISHABLE_KEY` / `SECRET_KEY`), not legacy JWT anon/service-role keys.
- **Stale Supabase state:** `supabase start` may report "already running" while
  the DB container exited → `pnpm db:stop && pnpm db:start`.
- **Webhook verification** uses Svix headers (`svix-id/-timestamp/-signature`),
  not a plain HMAC of the body. Verify against the raw request body string.
- **Inbound `email.received` payloads omit the body** — it is fetched via the
  Resend API in `resolveInbound()` before the ticket message is created.

