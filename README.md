# Ticqex

> A thin UX and data layer for support and helpdesk — where humans and AI agents work the same queue, together.

Open-Source · Free

[![CI](https://github.com/rbouschery/ticqex/actions/workflows/ci.yml/badge.svg)](https://github.com/rbouschery/ticqex/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
![Status: pre-1.0](https://img.shields.io/badge/status-pre--1.0-orange.svg)

## About

Ticqex is a flexible, customizable support desk built on one idea: humans and AI agents are both first-class operators. Tickets live on a Kanban board for people to work, but every action — creating and editing tickets, adding lanes, defining custom fields — is equally available over API and MCP.

Ticqex is agent-agnostic. Plug in whatever agent you prefer — Claude, Codex, Cursor, Pi, OpenClaw, Hermes. If it can call an API or MCP, it works with Ticqex.

Tickets can be created manually, arrive through the API, or come in through channels and integrations. Ticqex ships with a built-in email channel powered by Resend, so an inbound support email becomes a ticket that you — or your agent — can reply to in place, without juggling a separate inbox.

Need a different channel? Use the channel and integration templates to build your own. Slack, chatbots, WordPress forms — if it can send a request, you can wire it up.

Ticqex is built with Next.js and runs on Supabase, leveraging its Postgres database, authentication layer and storage.

## Getting Started

Follow the steps in [Quick start](#quick-start) below, or view the Docs (coming soon).

## Quick start

### Prerequisites

- Node.js 20+ (development pinned to Node 22 — see `[.nvmrc](./.nvmrc)`)
- [pnpm](https://pnpm.io/)
- [Docker](https://www.docker.com/) (for local Supabase)

Optional when enabling the email channel (on by default):

- **[Resend](https://resend.com/) + API key** — required for email
- **HTTPS tunnel** such as [ngrok](https://ngrok.com/download) — required for local inbound email because Resend cannot post webhooks to `http://localhost:3000`

### 1. Install dependencies

```bash
pnpm install
```

### 2. Interactive setup

Use the repo-local CLI to configure local Supabase, email (Resend), and activation config:

```bash
pnpm ticqex init
```

**Supabase:** choose `local` to start Docker Supabase, sync keys to `.env.local`, bootstrap required board data, and optionally seed an admin user. Choose `skip` if you already handled the database.

**Email:** the email channel and Resend integration stay **on** by default in `config/ticqex.config.json`. With email enabled, init asks for a Resend API key (`re_…`), `NEXT_PUBLIC_APP_URL`, webhook signing secrets, and support sender details.

For local UI-only work, `NEXT_PUBLIC_APP_URL=http://localhost:3000` is fine. For inbound email, `NEXT_PUBLIC_APP_URL` must be a public **HTTPS** URL that forwards to port 3000. Init makes this explicit and lets you start/reuse `ngrok http 3000`, paste another tunnel URL, or skip webhook setup and do it later.

For local UI-only work without mail, answer **no** when asked to enable the email channel, or choose **skip** when init asks how to provide a tunnel URL.

Re-run or fix webhooks later:

```bash
pnpm resend:setup-webhooks --app-url https://your-public-host
```

For local development, choose `local` and then `start`, `reset`, or `skip`. If local Supabase has already been initialized, you can run:

```bash
pnpm ticqex init --supabase skip
```

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


| Variable                                   | Source                                                | Required for                                                     |
| ------------------------------------------ | ----------------------------------------------------- | ---------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`                 | `pnpm db:env`                                         | App + API                                                        |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`     | `pnpm db:env`                                         | App auth (client)                                                |
| `SUPABASE_SECRET_KEY`                      | `pnpm db:env`                                         | Admin seed, server jobs                                          |
| `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` | `.env.example` defaults                               | `pnpm db:seed-admin`                                             |
| `NEXT_PUBLIC_APP_URL`                      | `pnpm ticqex init`                                    | Public hostname Resend calls for webhooks (tunnel or deploy URL) |
| `RESEND_API_KEY`                           | [Resend API keys](https://resend.com/api-keys) / init | **Required** when email is enabled                               |
| `RESEND_WEBHOOK_SECRET`                    | init / `resend:setup-webhooks`                        | Svix secret for Resend webhook events                            |
| `SUPPORT_EMAIL` / `SUPPORT_FROM_NAME`      | init                                                  | Outbound From address and display name                           |


Async email processing uses Next.js `after()` — no external job runner required.

Use `http://localhost:3000` for local dev (not `127.0.0.1` — Next.js treats them as different origins).

## Manual setup (without `pnpm ticqex init`)

These paths mirror what the interactive CLI does, but you run each step yourself. Use them when you want explicit control, CI, or when init is unavailable.

**Concepts**


| Term                      | Meaning                                                                                                                                        |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| **Channel**               | How support reaches Ticqex (`email` in `config/ticqex.config.json`).                                                                           |
| **Integration**           | Provider behind a channel (`resend` for email).                                                                                                |
| `**ticqex.config.json`**  | Committed activation file — which channels/integrations are on.                                                                                |
| `**NEXT_PUBLIC_APP_URL**` | Public HTTPS URL Resend calls for webhooks. Local UI can use `http://localhost:3000`; **inbound email requires HTTPS** (tunnel or deploy URL). |


Webhook path when email is enabled:

- Resend: `{NEXT_PUBLIC_APP_URL}/api/webhooks/integrations/resend`

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
4. **Register Resend webhooks** (writes signing secrets to `.env.local`):
  ```bash
   pnpm resend:setup-webhooks --app-url https://your-tunnel-host.example
  ```
   Or create one webhook manually in the [Resend dashboard](https://resend.com/webhooks) pointing at the Resend path above, subscribe it to inbound and delivery events, then paste `RESEND_WEBHOOK_SECRET` into `.env.local`.
5. **Start the app and keep the tunnel running:**
  ```bash
   pnpm config:check
   pnpm dev
  ```
6. **Test inbound mail** — send email to your configured inbound address; a ticket should appear on the board.

If the tunnel URL changes, update `NEXT_PUBLIC_APP_URL` and re-run `pnpm resend:setup-webhooks --app-url <new-https-url>`.

---

### Manual cloud setup — Supabase Cloud + Vercel

Cloud setup is manual. `pnpm ticqex init` only configures local development.

You need:

- A Supabase project
- A Vercel project connected to this Git repository
- A Resend account if email is enabled
- Supabase CLI and Vercel CLI logged in: `supabase login`, `vercel login`

#### 1. Prepare the repo

```bash
pnpm install
cp config/ticqex.config.example.json config/ticqex.config.json
```

Keep email enabled in `config/ticqex.config.json` if you want inbound/outbound mail. Disable it before deploying if you do not want Resend env vars.

#### 2. Set up Supabase Cloud

1. Create a Supabase project.
2. Copy the project ref from the project URL: `https://<project-ref>.supabase.co`.
3. Link this repo:
  ```bash
   supabase link --project-ref <project-ref>
  ```
4. Push migrations to the linked cloud database:
  ```bash
   supabase db push --linked
  ```
5. Bootstrap required statuses and settings:
  ```bash
   supabase db query --linked -f supabase/bootstrap.sql
  ```
6. In Supabase, open **Project Settings -> API Keys** and copy:

- `NEXT_PUBLIC_SUPABASE_URL`: `https://<project-ref>.supabase.co`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: publishable key
- `SUPABASE_SECRET_KEY`: full secret key or `service_role` key

#### 3. Set up Vercel

Create/import the Vercel project from the Git repo, or link with the CLI:

```bash
vercel link
```

Set these environment variables in **Vercel -> Project -> Settings -> Environment Variables** for Production and Preview:


| Variable                               | Value                                                                     |
| -------------------------------------- | ------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`             | `https://<project-ref>.supabase.co`                                       |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable key                                                  |
| `SUPABASE_SECRET_KEY`                  | Supabase full secret / `service_role` key                                 |
| `NEXT_PUBLIC_APP_URL`                  | Production URL, e.g. `https://<project>.vercel.app` or your custom domain |
| `RESEND_API_KEY`                       | Resend API key, only if email is enabled                                  |
| `RESEND_WEBHOOK_SECRET`                | Add after webhook setup, only if email is enabled                         |
| `SUPPORT_EMAIL`                        | Resend-approved sender address, only if email is enabled                  |
| `SUPPORT_FROM_NAME`                    | Sender display name, only if email is enabled                             |


Deploy once so the webhook endpoints exist:

```bash
vercel deploy --prod
```

Use the deployed HTTPS URL as `NEXT_PUBLIC_APP_URL`. If you switch to a custom domain, update `NEXT_PUBLIC_APP_URL` before setting up Resend webhooks.

#### 4. Set up Resend email

Skip this section if email is disabled in `config/ticqex.config.json`.

1. In Resend, create an API key.
2. Verify the sender domain or sender address you will use for `SUPPORT_EMAIL`.
3. Register webhooks against the deployed Vercel URL:
  ```bash
   RESEND_API_KEY=re_... pnpm resend:setup-webhooks --app-url https://<your-vercel-host>
  ```
4. Copy this generated value from `.env.local` into Vercel env vars for Production and Preview:

- `RESEND_WEBHOOK_SECRET`

1. Confirm the Resend webhook endpoint is:

- `https://<your-vercel-host>/api/webhooks/integrations/resend`

Redeploy after adding or changing Vercel env vars:

```bash
vercel deploy --prod
```

#### 5. Create the first admin

Run this locally against the cloud project:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co \
SUPABASE_SECRET_KEY=<full-secret-key> \
SEED_ADMIN_EMAIL=you@example.com \
SEED_ADMIN_PASSWORD='choose-a-strong-password' \
pnpm db:seed-admin
```

Do not commit those values. They only need to exist in the shell for this command.

#### 6. Verify production

1. Open `https://<your-vercel-host>/api/health` and confirm `"database":"ok"`.
2. Sign in at `https://<your-vercel-host>` with the admin user.
3. If email is enabled, send a test inbound email and confirm a ticket appears.

If webhooks break after a domain change, update `NEXT_PUBLIC_APP_URL` in Vercel, re-run `pnpm resend:setup-webhooks --app-url <https-url>`, copy the new webhook secrets to Vercel, and redeploy.

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

## Agent onboarding

Agents connect the same way as automation scripts: **REST** (`/api/v1/`*) or **MCP**
(`/api/mcp`), both authenticated with a **Bearer API key**.

1. Run the app and sign in as an admin (`pnpm dev`, then `pnpm db:seed-admin` if needed).
2. Open **Settings → API & MCP**, create an API key, and copy it once (it is not shown again).
3. Point your agent client at `{NEXT_PUBLIC_APP_URL}/api/mcp` with `Authorization: Bearer <key>`.
4. Use the copy-paste snippets on that settings page for Cursor, Codex, Claude Code, and similar clients.

MCP tools mirror the REST mutations agents need (tickets, board moves, messages,
contacts, tags, statuses, custom fields, settings, and more). API key lifecycle
(create/revoke/list) stays in the admin UI and REST only — not exposed over MCP.
REST↔MCP coverage is checked in `tests/unit/mcp-api-parity.test.ts`.

For HTTP-only integrations, call `/api/v1/`* with the same Bearer key.

## Scripts


| Command                                        | Description                                                                      |
| ---------------------------------------------- | -------------------------------------------------------------------------------- |
| `pnpm dev`                                     | Next.js dev server (UI, API, background email)                                   |
| `pnpm build`                                   | Production build                                                                 |
| `pnpm lint`                                    | ESLint                                                                           |
| `pnpm ticqex init`                             | Interactive local setup: local Supabase, Resend/email env, and activation config |
| `pnpm resend:setup-webhooks`                   | Create Resend inbound/events webhooks and write signing secrets to `.env.local`  |
| `pnpm config:check`                            | Validate `config/ticqex.config.json` bindings and required env vars              |
| `pnpm config:sync`                             | Validate activation JSON and print planned channel field sync (dry-run)          |
| `pnpm env:verify`                              | Check Supabase env vars (`pnpm db:env`); use `config:check` for email/Resend     |
| `pnpm test` / `test:unit` / `test:integration` | Vitest under `tests/` (unit: no DB; integration: local Supabase + seed admin)    |
| `pnpm db:start` / `db:stop` / `db:reset`       | Local Supabase                                                                   |
| `pnpm db:bootstrap`                            | Required statuses + settings (empty board)                                       |
| `pnpm db:env`                                  | Sync Supabase keys → `.env.local`                                                |
| `pnpm db:seed-admin`                           | Optional: create local admin user                                                |
| `pnpm seed:board-load`                         | Optional: large board dataset for manual load testing                            |


### Tests

All tests live under `tests/unit/` and `tests/integration/` (shared helpers in `tests/helpers/`). Unit tests run without Supabase. Integration tests call `server/services` directly (not HTTP), except the MCP route test which needs `pnpm dev` on `http://localhost:3000` (override with `LOCAL_APP_URL` or `NEXT_PUBLIC_APP_URL`).

```bash
pnpm test:unit
pnpm db:start && pnpm db:env && pnpm db:seed-admin && pnpm test:integration
```

Set `SKIP_MCP_INTEGRATION=1` to skip the MCP HTTP test when `pnpm dev` is not running.

## Project layout


| Path                                | Purpose                                                                                                                   |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `src/app/`                          | Next.js App Router — admin UI, `/api/v1/*`, webhooks, MCP                                                                 |
| `src/components/`                   | React components (board, settings, account)                                                                               |
| `server/services/`                  | Business logic (tickets, board, messages, contacts, …)                                                                    |
| `server/channels/`                  | Product channel behavior (email today)                                                                                    |
| `server/integrations/`              | External providers (Resend)                                                                                               |
| `server/lib/`, `server/middleware/` | Route handlers, auth, validation, errors                                                                                  |
| `shared/`                           | Code shared between client and server (config, registries, schemas)                                                       |
| `config/`                           | OSS activation config (`ticqex.config.json` — version-controlled; `ticqex.config.example.json` is the bootstrap template) |
| `scripts/`                          | Setup/seed/verify CLIs (`pnpm ticqex`, `db:*`, `config:*`)                                                                |
| `supabase/migrations/`              | Database schema                                                                                                           |
| `tests/unit`, `tests/integration`   | Vitest suites (helpers in `tests/helpers/`)                                                                               |


## Contributing

Contributions are welcome — see [CONTRIBUTING.md](./CONTRIBUTING.md) for setup,
coding standards, and the PR workflow. Security issues: see
[SECURITY.md](./SECURITY.md).

## License

[MIT](./LICENSE)