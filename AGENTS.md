# AGENTS.md

Guidance for AI agents and contributors working in this repository. Keep changes
small, typed, and tested. Human-facing setup lives in [README.md](./README.md);
contribution process lives in [CONTRIBUTING.md](./CONTRIBUTING.md).

## If asked to set up this repo for the user

> **Note for agents:** When the user wants this repo running locally or in the
> cloud, follow the steps below in order. Run commands yourself; do not only
> paste instructions. Explain each choice briefly as you go. When setup succeeds
> (health check OK, user can sign in), **ask the user whether to remove this
> entire section from `AGENTS.md`** — it is meant as a one-time bootstrap aid,
> not permanent repo documentation.

### Concepts (explain briefly if the user is new)

| Term | What it means here |
|------|-------------------|
| **Channel** | How support *reaches* Ticqex (e.g. `email` in `config/ticqex.config.json`). Channels are product-facing; today only email ships. |
| **Integration** | The *provider* behind a channel (e.g. `resend` for email). Registered in `server/integrations/`; bound in config via `"integration": "resend"`. |
| **Resend** | Third-party email API: outbound sends, inbound `email.received` webhooks. Needs `RESEND_API_KEY` and Svix signing secrets in `.env.local`. |
| **`NEXT_PUBLIC_APP_URL`** | Public base URL Resend calls for webhooks. Local UI-only dev can stay `http://localhost:3000`. **Inbound email needs HTTPS** — use a tunnel URL here, not bare localhost. |
| **Tunnel** | Public HTTPS proxy to `localhost:3000` (ngrok, Cloudflare Tunnel, etc.). Resend cannot POST to `http://localhost:3000`. Init can start ngrok or accept a pasted tunnel URL. |
| **`ticqex.config.json`** | Committed activation file (which channels/integrations are on). Init may update it; cloud deploys should match what you enabled. |

Webhook paths (when email is on): `{NEXT_PUBLIC_APP_URL}/api/webhooks/integrations/resend/inbound` and `.../events`. Re-register later with `pnpm resend:setup-webhooks --app-url <https-url>`.

### Prerequisites (check before starting)

1. **Node 20+** (repo pins Node 22 in `.nvmrc`) and **pnpm** installed.
2. **Docker running** for local Supabase (`pnpm db:start`).
3. **Email optional:** [Resend](https://resend.com/) account + API key (`re_…`) if the email channel stays enabled (default).
4. **Inbound email locally:** [ngrok](https://ngrok.com/download) on PATH (or another tunnel the user will paste).
5. **Cloud path:** [Supabase CLI](https://supabase.com/docs/guides/cli) and [Vercel CLI](https://vercel.com/docs/cli) installed and logged in (`supabase login`, `vercel login`).

### Path A — Local setup (Kanban + API only, no email)

Use when the user only needs the admin UI, REST, or MCP — not real inbound mail yet.

1. `pnpm install`
2. `pnpm ticqex init`
   - Supabase: choose **local** → **start** (or **reset** if they want a clean DB).
   - When asked to enable the **email channel**, answer **no** (or disable email in config).
3. If init did not seed an admin: `pnpm db:seed-admin` (credentials land in `.env.local` as `SEED_ADMIN_*`).
4. `pnpm dev` — only one dev server; restart it yourself after env/API changes.
5. Open **`http://localhost:3000`** (not `127.0.0.1`).
6. Verify: `curl -s http://localhost:3000/api/health` → `{"status":"ok",...,"database":"ok"}`.
7. Sign in with seed admin email/password from `.env.local`.

### Path B — Local setup (full stack including inbound email)

1. Do **Path A** steps 1–2, but answer **yes** to enable email / Resend.
2. Provide **`RESEND_API_KEY`** when prompted (or ensure it is already in `.env.local`).
3. **Tunnel step (required for inbound):** when init explains Resend cannot reach localhost:
   - **ngrok:** let init start `ngrok http 3000`, or run it yourself first; init reuses an existing ngrok on port 4040.
   - **Other tunnel:** run Cloudflare Tunnel (or similar), paste the **HTTPS** URL when asked.
   - Confirm setting **`NEXT_PUBLIC_APP_URL`** to that HTTPS URL (not `http://localhost:3000`).
4. Set **support sender** (`SUPPORT_EMAIL`, `SUPPORT_FROM_NAME`) — must be a domain/sender Resend allows.
5. Let init **register Resend webhooks** (writes `RESEND_INBOUND_WEBHOOK_SECRET` and `RESEND_EVENTS_WEBHOOK_SECRET`), or run later:
   `pnpm resend:setup-webhooks --app-url https://your-tunnel-host`
6. `pnpm config:check` — must pass with email enabled.
7. `pnpm dev`; keep the **tunnel running** while testing inbound mail.
8. Send a test email to the configured inbound address; confirm a ticket appears on the board.

**If webhooks break** (tunnel URL changed, ngrok restarted): update `NEXT_PUBLIC_APP_URL` in `.env.local` and re-run `pnpm resend:setup-webhooks --app-url <new-https-url>`, then restart `pnpm dev`.

### Path C — Cloud setup (Supabase Cloud + Vercel + email)

1. User has (or will create) a **Supabase Cloud** project and **Vercel** project.
2. `pnpm install`
3. `pnpm ticqex init --supabase cloud` (or choose **cloud** interactively).
4. Follow prompts: **link** Supabase project, **push migrations**, **bootstrap** DB, fetch API keys into `.env.local`, optional **cloud admin** user.
5. **Vercel:** when asked, link existing project or create new; init syncs env vars and sets `NEXT_PUBLIC_APP_URL` from production URL when available.
6. **Email:** keep channel on → `RESEND_API_KEY`, support From address, webhook registration against the **deployed HTTPS URL** (production or preview — must match what Resend will call).
7. Deploy or ensure Vercel env vars match `.env.local` (init’s `pushEnvToVercel` helps).
8. After deploy: hit `https://<vercel-host>/api/health`, sign in, optionally send a test inbound email.

**Agent rule:** never run `supabase db push` / migrations against a remote project unless the user explicitly asked for cloud setup and understands data impact. Init’s cloud flow is the supported path.

### Manual fallback (if `pnpm ticqex init` fails or user wants explicit control)

```bash
pnpm install
pnpm db:start && pnpm db:env && pnpm db:bootstrap
pnpm db:seed-admin   # optional
# copy config/ticqex.config.example.json → config/ticqex.config.json if missing
pnpm dev
```

For email: fill `.env.local` from `.env.example`, set tunnel HTTPS in `NEXT_PUBLIC_APP_URL`, run `pnpm resend:setup-webhooks --app-url <https-url>`, then `pnpm config:check`.

### Success checklist (tell the user what passed)

- [ ] `pnpm config:check` exits 0 (when email is enabled, Resend vars present).
- [ ] `/api/health` shows database OK.
- [ ] User can sign in at `/` with admin credentials.
- [ ] (Email path) Tunnel or deploy URL is HTTPS and matches `NEXT_PUBLIC_APP_URL`.
- [ ] (Email path) Test inbound message creates a ticket.

### After setup succeeds

1. Summarize what was configured (local vs cloud, email on/off, tunnel vs Vercel URL).
2. Point to **Settings → API & MCP** if they want an agent API key.
3. **Ask explicitly:** “Setup looks good. Do you want me to remove the **If asked to set up this repo for the user** section from `AGENTS.md`?” If yes, delete that section (from the heading through **After setup succeeds**) and leave the rest of the file intact.

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

