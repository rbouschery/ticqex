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

### 1. Install dependencies

```bash
pnpm install
```

### 2. Interactive setup

Use the repo-local CLI to configure Supabase and email (Resend):

```bash
pnpm ticqex init
```

**Default:** the email channel and Resend integration stay **on** (`config/ticqex.config.json`). With email enabled, you need a Resend API key (`re_…` from the [Resend dashboard](https://resend.com/api-keys)). Init prompts for that key, your **public app URL** (tunnel or deployment hostname for webhooks), and can **create Resend webhooks via API** — signing secrets are written to `.env.local` automatically. You also set support sender email/name.

For local UI-only work without mail, answer **no** when asked to enable the email channel. For real inbound email, use a tunnel URL as `NEXT_PUBLIC_APP_URL` so Resend can reach your app (plain `http://localhost:3000` is fine for the admin UI, not for webhooks).

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
| `NEXT_PUBLIC_APP_URL` | `pnpm ticqex init` | Public hostname Resend calls for webhooks (tunnel or deploy URL) |
| `RESEND_API_KEY` | [Resend API keys](https://resend.com/api-keys) / init | **Required** when email is enabled |
| `RESEND_INBOUND_WEBHOOK_SECRET` | init / `resend:setup-webhooks` | Svix secret for inbound (`email.received`) |
| `RESEND_EVENTS_WEBHOOK_SECRET` | init / `resend:setup-webhooks` | Svix secret for delivery events |
| `SUPPORT_EMAIL` / `SUPPORT_FROM_NAME` | init | Outbound From address and display name |

Async email processing uses Next.js `after()` — no external job runner required.

Use `http://localhost:3000` for local dev (not `127.0.0.1` — Next.js treats them as different origins).

### Cloud Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. `pnpm ticqex init --supabase cloud`
3. Choose whether to push migrations to the linked project.
4. Set cloud URL, publishable key, and secret key in `.env.local` or deployment settings.

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
| `pnpm ticqex init` | Interactive setup: Supabase, Resend API key, webhooks, and email env (email on by default) |
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
