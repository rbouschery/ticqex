# Ticqex

> Open-source, agent-first support platform — first-class REST API and MCP, with a realtime Kanban admin.

[![CI](https://github.com/rbouschery/ticqex/actions/workflows/ci.yml/badge.svg)](https://github.com/rbouschery/ticqex/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
![Status: pre-1.0](https://img.shields.io/badge/status-pre--1.0-orange.svg)

Ticqex is an agentic infrastructure layer for support ticket management —
designed to plug into the agent(s) and AI workflow of your choice. It provides
the data model, APIs, and supervision surface; you bring the intelligence.

Every action is available over a typed REST API (`/api/v1/*`) and an MCP server,
so agents are first-class operators that can triage, respond, and manage tickets
— while humans stay in the loop on a realtime Kanban board.

A composable channel and integration layer (registry-based) adapts the platform
to however support reaches you. Email parsing ships onboard — inbound messages
are parsed into tickets and replies are delivered via Resend — and new channels
and providers plug in without touching the core.

Need a custom email provider, Slack, or Teams integration or something built for your custom workflow?
Simply build a new channel or integration based on a template.

Built on Supabase (Postgres, Auth, and Realtime) and Next.js (App Router), async
email work runs in-process via Next.js `after()` — no external job runner
required.

Customize the board in the admin UI: status **lanes**, **custom fields**
(text, select, multiselect, and more), and per-field **visibility** on Kanban
cards — plus saved filters and manual lane ordering when you need it.

<!-- TODO: replace with a real screenshot or demo GIF of the Kanban board.
     Drop the asset under public/ (e.g. public/screenshot.png) and reference it:
![Ticqex board](./public/screenshot.png)
-->

## Quick start

### Prerequisites

- Node.js 20+ (development pinned to Node 22 — see [`.nvmrc`](./.nvmrc))
- [pnpm](https://pnpm.io/)
- [Docker](https://www.docker.com/) (for local Supabase)

Optional when enabling the email channel (on by default):

- **[Resend](https://resend.com/) + API key** — inbound/outbound mail and webhooks use Resend; disable email in `pnpm ticqex init` if you do not need it yet

For cloud deployment, init can also wire up Supabase Cloud and Vercel when the CLIs are installed and logged in ([Supabase CLI](https://supabase.com/docs/guides/cli), [Vercel CLI](https://vercel.com/docs/cli)).

### 1. Install dependencies

```bash
pnpm install
```

### 2. Interactive setup

Use the repo-local CLI to configure Supabase, email (Resend), and optionally Vercel:

```bash
pnpm ticqex init
```

**Supabase (local or cloud):** choose `local` to start Docker Supabase, sync keys to `.env.local`, and optionally seed an admin user; choose `cloud` to link a Supabase project, push migrations, bootstrap statuses/settings, fetch cloud API keys into `.env.local`, and optionally create a cloud admin user (email + password).

**Vercel (cloud flow):** after channel/env setup, init can link an existing Vercel project or create and link a new one, pull the production URL into `NEXT_PUBLIC_APP_URL`, and sync env vars to Vercel (production, preview, development) via the Vercel CLI.

**Default:** the email channel and Resend integration stay **on** (`config/ticqex.config.json`). With email enabled, you need a Resend API key (`re_…` from the [Resend dashboard](https://resend.com/api-keys)). Init defaults `NEXT_PUBLIC_APP_URL` to `http://localhost:3000` for the admin UI. **Inbound email locally requires an HTTPS tunnel** — init explains this and lets you start **ngrok** (`ngrok http 3000`, reused if already running) or paste a tunnel URL (Cloudflare, etc.), then optionally register Resend webhooks via API. You also set support sender email/name.

For local UI-only work without mail, answer **no** when asked to enable the email channel, or choose **skip** when init asks how to provide a tunnel URL.

Re-run or fix webhooks later:

```bash
pnpm resend:setup-webhooks --app-url https://your-public-host
```

For local development, choose `local` and then `start`, `reset`, or `skip`. If local Supabase has already been initialized, you can run:

```bash
pnpm ticqex init --supabase skip
```

For Supabase Cloud, run:

```bash
pnpm ticqex init --supabase cloud
```

The cloud flow links your project, can push migrations and bootstrap the database, stores deploy secrets for Vercel sync (not `.env.local`), and can seed a cloud admin user. When you opt in, it also links or creates a Vercel project, connects git, resolves the production URL, and syncs env vars to Vercel.

The CLI may update `config/ticqex.config.json` (committed — edit and push to change channels/integrations on deploy). Use `config/ticqex.config.example.json` as the template when bootstrapping a fresh clone.

After init, `pnpm config:sync` validates activation and reports planned channel field policies (database upsert comes in a later slice). Use `pnpm config:check` to verify channel/integration bindings and required env vars.

See [Manual setup](#manual-setup-without-pnpm-ticqex-init) for the same steps without the interactive CLI.

### 3. Run the app

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000), sign in with `SEED_ADMIN_*` credentials from `.env.local`, and check [http://localhost:3000/api/health](http://localhost:3000/api/health).

Prefer doing setup by hand? See [Manual setup](#manual-setup-without-pnpm-ticqex-init) below.

### Environment reference

| Variable | Source | Required for |
|----------|--------|----------------|
| `NEXT_PUBLIC_SUPABASE_URL` | `pnpm db:env` | App + API |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `pnpm db:env` | App auth (client) |
| `SUPABASE_SECRET_KEY` | `pnpm db:env` | Admin seed, server jobs |
| `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` | `.env.example` defaults | `pnpm db:seed-admin` |
| `NEXT_PUBLIC_APP_URL` | `pnpm ticqex init` | Public hostname Resend calls for webhooks (tunnel or deploy URL) |
| `RESEND_API_KEY` | [Resend API keys](https://resend.com/api-keys) / init | **Required** when email is enabled |
| `RESEND_INBOUND_WEBHOOK_SECRET` | init / `resend:setup-webhooks` | Svix secret for inbound (`email.received`) |
| `RESEND_EVENTS_WEBHOOK_SECRET` | init / `resend:setup-webhooks` | Svix secret for delivery events |
| `SUPPORT_EMAIL` / `SUPPORT_FROM_NAME` | init | Outbound From address and display name |

Async email processing uses Next.js `after()` — no external job runner required.

Use `http://localhost:3000` for local dev (not `127.0.0.1` — Next.js treats them as different origins).

## Manual setup (without `pnpm ticqex init`)

These paths mirror what the interactive CLI does, but you run each step yourself. Use them when you want explicit control, CI, or when init is unavailable.

**Concepts**

| Term | Meaning |
|------|---------|
| **Channel** | How support reaches Ticqex (`email` in `config/ticqex.config.json`). |
| **Integration** | Provider behind a channel (`resend` for email). |
| **`ticqex.config.json`** | Committed activation file — which channels/integrations are on. |
| **`NEXT_PUBLIC_APP_URL`** | Public HTTPS URL Resend calls for webhooks. Local UI can use `http://localhost:3000`; **inbound email requires HTTPS** (tunnel or deploy URL). |

Webhook paths when email is enabled:

- Inbound: `{NEXT_PUBLIC_APP_URL}/api/webhooks/integrations/resend/inbound`
- Events: `{NEXT_PUBLIC_APP_URL}/api/webhooks/integrations/resend/events`

---

### Manual local setup — Kanban, API, and MCP (no email)

Use this when you only need the admin UI, REST API, or MCP — not real inbound mail.

1. **Install dependencies**

   ```bash
   pnpm install
   ```

2. **Activation config** — copy the example if you do not have one yet:

   ```bash
   cp config/ticqex.config.example.json config/ticqex.config.json
   ```

   Disable email in `config/ticqex.config.json`:

   ```json
   "channels": { "email": { "enabled": false, "integration": null } },
   "integrations": { "resend": { "enabled": false } }
   ```

3. **Environment file** — copy and fill Supabase vars (step 5 writes the keys):

   ```bash
   cp .env.example .env.local
   ```

4. **Start local Supabase** (Docker must be running):

   ```bash
   pnpm db:start
   ```

   If the stack looks stale: `pnpm db:stop && pnpm db:start`. For a clean database: `pnpm db:reset` (wipes local data).

5. **Sync Supabase keys into `.env.local`:**

   ```bash
   pnpm db:env
   ```

   This writes `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and `SUPABASE_SECRET_KEY` from `supabase status`.

6. **Bootstrap required board data** (status columns + global settings):

   ```bash
   pnpm db:bootstrap
   ```

7. **Create an admin user** (optional but typical):

   Set `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD` in `.env.local`, then:

   ```bash
   pnpm db:seed-admin
   ```

8. **Validate and run:**

   ```bash
   pnpm config:check
   pnpm env:verify
   pnpm dev
   ```

9. **Verify** — open [http://localhost:3000](http://localhost:3000), sign in with your seed admin credentials, and check [http://localhost:3000/api/health](http://localhost:3000/api/health) returns `"database":"ok"`.

---

### Manual local setup — full stack with inbound email

Do everything in **Kanban, API, and MCP** above, but keep email enabled in `config/ticqex.config.json` (default example config) and complete these extra steps.

1. **Resend account** — create an API key at [resend.com/api-keys](https://resend.com/api-keys) (`re_…`) and set in `.env.local`:

   ```bash
   RESEND_API_KEY=re_...
   ```

2. **Support sender** — use an address/domain Resend allows you to send from:

   ```bash
   SUPPORT_EMAIL=hello@yourdomain.com
   SUPPORT_FROM_NAME=Your Support Name
   ```

3. **Public HTTPS URL for webhooks** — Resend cannot POST to `http://localhost:3000`. Start a tunnel to port 3000, for example:

   ```bash
   ngrok http 3000
   ```

   Or use Cloudflare Tunnel or another HTTPS reverse proxy. Set:

   ```bash
   NEXT_PUBLIC_APP_URL=https://your-tunnel-host.example
   ```

4. **Register Resend webhooks** (writes signing secrets to `.env.local`):

   ```bash
   pnpm resend:setup-webhooks --app-url https://your-tunnel-host.example
   ```

   Or create webhooks manually in the [Resend dashboard](https://resend.com/webhooks) pointing at the inbound/events paths above, then paste `RESEND_INBOUND_WEBHOOK_SECRET` and `RESEND_EVENTS_WEBHOOK_SECRET` into `.env.local`.

5. **Start the app and keep the tunnel running:**

   ```bash
   pnpm config:check
   pnpm dev
   ```

6. **Test inbound mail** — send email to your configured inbound address; a ticket should appear on the board.

If the tunnel URL changes, update `NEXT_PUBLIC_APP_URL` and re-run `pnpm resend:setup-webhooks --app-url <new-https-url>`.

---

### Manual cloud setup — Supabase Cloud + Vercel + email

You need accounts/projects on [Supabase](https://supabase.com), [Vercel](https://vercel.com), and [Resend](https://resend.com). Install the [Supabase CLI](https://supabase.com/docs/guides/cli) and [Vercel CLI](https://vercel.com/docs/cli) and log in (`supabase login`, `vercel login`).

#### 1. Clone, install, and activation config

```bash
pnpm install
cp config/ticqex.config.example.json config/ticqex.config.json
```

Keep email enabled unless you are skipping mail.

#### 2. Supabase Cloud — link, migrate, bootstrap

1. Create a Supabase project (or pick an existing one) and note the **project ref** (`abcdefghijklmnop` from `https://<ref>.supabase.co`).
2. Link the repo to that project:

   ```bash
   supabase link --project-ref <your-project-ref>
   ```

3. Push migrations to the remote database (review impact first — this changes cloud schema):

   ```bash
   supabase db push --linked
   ```

4. Bootstrap statuses and global settings:

   ```bash
   supabase db query --linked -f supabase/bootstrap.sql
   ```

5. Copy API keys from **Supabase → Project Settings → API Keys** (use the publishable key and the full secret / `service_role` key — not a redacted CLI placeholder).

#### 3. Vercel — project, git, and environment variables

1. Create or choose a Vercel project in the team that should own production.
2. Link this directory (pick the correct team with `--scope` if needed):

   ```bash
   vercel link --yes --scope <team-slug> --project <project-name>
   ```

3. Connect the Git repository (uses `git remote get-url origin`):

   ```bash
   vercel git connect
   ```

4. Set **all** runtime env vars on Vercel (Dashboard → Project → Settings → Environment Variables, or `vercel env add`). Apply to **Production**, **Preview**, and **Development** as appropriate:

   | Variable | Value |
   |----------|--------|
   | `NEXT_PUBLIC_SUPABASE_URL` | `https://<project-ref>.supabase.co` |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Publishable key from Supabase |
   | `SUPABASE_SECRET_KEY` | Secret / service_role key from Supabase |
   | `NEXT_PUBLIC_APP_URL` | `https://<project-name>.vercel.app` or your custom domain |
   | `RESEND_API_KEY` | `re_…` from Resend |
   | `RESEND_INBOUND_WEBHOOK_SECRET` | From Resend webhook setup (below) |
   | `RESEND_EVENTS_WEBHOOK_SECRET` | From Resend webhook setup (below) |
   | `SUPPORT_EMAIL` | Outbound support address Resend allows |
   | `SUPPORT_FROM_NAME` | Display name for outbound mail |

   Cloud deploys do **not** require these secrets in committed files. For local debugging against cloud, run `vercel env pull .env.local` after linking.

5. Note the production URL (`https://<project>.vercel.app` or your custom domain). Deploy once if the project has never been deployed:

   ```bash
   vercel deploy --prod
   ```

#### 4. Resend — webhooks against the deployed URL

With `NEXT_PUBLIC_APP_URL` set to your **HTTPS** Vercel URL, register webhooks:

```bash
RESEND_API_KEY=re_... NEXT_PUBLIC_APP_URL=https://<your-vercel-host> \
  pnpm resend:setup-webhooks --app-url https://<your-vercel-host>
```

Copy the generated signing secrets into Vercel env vars (`RESEND_INBOUND_WEBHOOK_SECRET`, `RESEND_EVENTS_WEBHOOK_SECRET`) if you created webhooks locally. Redeploy or promote so production picks up new env vars.

#### 5. Cloud admin user

Create the first admin in Supabase Auth (does not need to live in `.env.local` long term):

```bash
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co \
SUPABASE_SECRET_KEY=<full-secret-key> \
SEED_ADMIN_EMAIL=you@example.com \
SEED_ADMIN_PASSWORD='choose-a-strong-password' \
pnpm db:seed-admin
```

Sign in at your deployed URL with that email and password.

#### 6. Deploy and verify

1. Push to the connected git branch (or run `vercel deploy --prod`).
2. Hit `https://<your-vercel-host>/api/health` — `"database":"ok"`.
3. Sign in at `/` with the admin user.
4. Optionally send a test inbound email and confirm a ticket appears.

**Checks**

```bash
pnpm config:check   # after pulling env locally, or with vars in the shell
```

**If webhooks break** (domain change, new Vercel URL): update `NEXT_PUBLIC_APP_URL` on Vercel, re-run `pnpm resend:setup-webhooks --app-url <https-url>`, update secrets on Vercel, redeploy.

---

### Manual setup checklist

**Local (no email)**

- [ ] `config/ticqex.config.json` — email off
- [ ] `.env.local` — Supabase keys from `pnpm db:env`
- [ ] `pnpm db:bootstrap` and `pnpm db:seed-admin`
- [ ] `pnpm config:check` passes
- [ ] Health check OK; admin sign-in works

**Local (with email)**

- [ ] All of the above with email on in config
- [ ] `RESEND_API_KEY`, support sender, HTTPS `NEXT_PUBLIC_APP_URL`
- [ ] Webhooks registered; tunnel running during dev
- [ ] Test inbound message creates a ticket

**Cloud**

- [ ] Supabase linked, migrated, bootstrapped
- [ ] Vercel project linked, git connected, env vars on Vercel
- [ ] Production URL set as `NEXT_PUBLIC_APP_URL`
- [ ] Resend webhooks point at deployed HTTPS URLs
- [ ] Admin seeded; health check and sign-in OK on deploy URL

### Cloud Supabase + Vercel (interactive CLI)

Prefer the guided flow? Run `pnpm ticqex init --supabase cloud` instead of the [manual cloud steps](#manual-cloud-setup--supabase-cloud--vercel--email) above.

1. Create a project at [supabase.com](https://supabase.com) (or use an existing one).
2. Install and log in to the [Supabase CLI](https://supabase.com/docs/guides/cli) and [Vercel CLI](https://vercel.com/docs/cli).
3. Run `pnpm ticqex init --supabase cloud`.
4. Follow prompts to link Supabase, push migrations, bootstrap, fetch keys, and optionally create an admin user.
5. When asked, link an existing Vercel project or create a new one; init connects git, resolves the production URL, syncs env vars to Vercel, then configures Resend.

## Agent onboarding

Agents connect the same way as automation scripts: **REST** (`/api/v1/*`) or **MCP**
(`/api/mcp`), both authenticated with a **Bearer API key**.

1. Run the app and sign in as an admin (`pnpm dev`, then `pnpm db:seed-admin` if needed).
2. Open **Settings → API & MCP**, create an API key, and copy it once (it is not shown again).
3. Point your agent client at `{NEXT_PUBLIC_APP_URL}/api/mcp` with `Authorization: Bearer <key>`.
4. Use the copy-paste snippets on that settings page for Cursor, Codex, Claude Code, and similar clients.

MCP tools mirror the REST mutations agents need (tickets, board moves, messages,
contacts, tags, statuses, custom fields, settings, and more). API key lifecycle
(create/revoke/list) stays in the admin UI and REST only — not exposed over MCP.
REST↔MCP coverage is checked in `tests/unit/mcp-api-parity.test.ts`.

For HTTP-only integrations, call `/api/v1/*` with the same Bearer key.

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Next.js dev server (UI, API, background email) |
| `pnpm build` | Production build |
| `pnpm lint` | ESLint |
| `pnpm ticqex init` | Interactive setup: local or cloud Supabase, Resend/email env, optional Vercel link + env sync |
| `pnpm resend:setup-webhooks` | Create Resend inbound/events webhooks and write signing secrets to `.env.local` |
| `pnpm config:check` | Validate `config/ticqex.config.json` bindings and required env vars |
| `pnpm config:sync` | Validate activation JSON and print planned channel field sync (dry-run) |
| `pnpm env:verify` | Check Supabase env vars (`pnpm db:env`); use `config:check` for email/Resend |
| `pnpm test` / `test:unit` / `test:integration` | Vitest under `tests/` (unit: no DB; integration: local Supabase + seed admin) |
| `pnpm db:start` / `db:stop` / `db:reset` | Local Supabase |
| `pnpm db:bootstrap` | Required statuses + settings (empty board) |
| `pnpm db:env` | Sync Supabase keys → `.env.local` |
| `pnpm db:seed-admin` | Optional: create local admin user |
| `pnpm seed:board-load` | Optional: large board dataset for manual load testing |

### Tests

All tests live under `tests/unit/` and `tests/integration/` (shared helpers in `tests/helpers/`). Unit tests run without Supabase. Integration tests call `server/services` directly (not HTTP), except the MCP route test which needs `pnpm dev` on `http://localhost:3000` (override with `LOCAL_APP_URL` or `NEXT_PUBLIC_APP_URL`).

```bash
pnpm test:unit
pnpm db:start && pnpm db:env && pnpm db:seed-admin && pnpm test:integration
```

Set `SKIP_MCP_INTEGRATION=1` to skip the MCP HTTP test when `pnpm dev` is not running.

## Project layout

| Path | Purpose |
|------|---------|
| `src/app/` | Next.js App Router — admin UI, `/api/v1/*`, webhooks, MCP |
| `src/components/` | React components (board, settings, account) |
| `server/services/` | Business logic (tickets, board, messages, contacts, …) |
| `server/channels/` | Product channel behavior (email today) |
| `server/integrations/` | External providers (Resend) |
| `server/lib/`, `server/middleware/` | Route handlers, auth, validation, errors |
| `shared/` | Code shared between client and server (config, registries, schemas) |
| `config/` | OSS activation config (`ticqex.config.json` — version-controlled; `ticqex.config.example.json` is the bootstrap template) |
| `scripts/` | Setup/seed/verify CLIs (`pnpm ticqex`, `db:*`, `config:*`) |
| `supabase/migrations/` | Database schema |
| `tests/unit`, `tests/integration` | Vitest suites (helpers in `tests/helpers/`) |

## Documentation

This repo covers local development and the environment reference above.
Deployment guides (Vercel + Supabase Cloud), Cloudflare tunnel webhook setup, and
detailed Resend configuration live in the separate docs repository.

<!-- TODO: link the docs site/repo once published, e.g. https://github.com/ticqex/docs -->

## Contributing

Contributions are welcome — see [CONTRIBUTING.md](./CONTRIBUTING.md) for setup,
coding standards, and the PR workflow. Security issues: see
[SECURITY.md](./SECURITY.md).

## License

[MIT](./LICENSE)
