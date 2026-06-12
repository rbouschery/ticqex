<p align="center">
  <img src="./public/web-app-manifest-192x192.png" alt="Ticqex" width="96" height="96">
</p>

<p align="center">
  <strong>A thin UX and data layer for support and helpdesk — where humans and AI agents work the same queue, together.</strong>
</p>

<hr />

<p align="center">
  <a href="https://github.com/rbouschery/ticqex/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/rbouschery/ticqex/ci.yml?branch=main&label=CI" alt="CI"></a>
  <a href="./LICENSE"><img src="https://img.shields.io/github/license/rbouschery/ticqex" alt="License: MIT"></a>
  <img src="https://img.shields.io/badge/status-pre--1.0-orange" alt="Status: pre-1.0">
  <img src="https://img.shields.io/badge/open--source-free-brightgreen" alt="Open-Source · Free">
</p>

## What is Ticqex?

Ticqex is a flexible, customizable support desk built on one idea: humans and AI agents are both first-class operators. Tickets live on a Kanban board for people to work, but every action — creating and editing tickets, adding lanes, defining custom fields — is equally available over API and MCP.

Ticqex is agent-agnostic. Plug in whatever agent you prefer — Claude, Codex, Cursor, Pi, OpenClaw, Hermes. If it can call an API or MCP, it works with Ticqex.

Tickets can be created manually, arrive through the API, or come in through channels and integrations. Ticqex ships with a built-in email channel powered by Resend, so an inbound support email becomes a ticket that you — or your agent — can reply to in place, without juggling a separate inbox.

Need a different channel? Use the channel and integration templates to build your own. Slack, chatbots, WordPress forms — if it can send a request, you can wire it up.

Ticqex is built with Next.js and runs on Supabase, leveraging its Postgres database, authentication layer and storage.

## Quick start (local)

Prerequisites: Node 20+ (dev pinned to 22, see `[.nvmrc](./.nvmrc)`), [pnpm](https://pnpm.io/), [Docker](https://www.docker.com/) (for local Supabase).

```bash
pnpm install
pnpm ticqex init   # interactive: local Supabase, channels, env
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000), sign in with the `SEED_ADMIN_*` credentials from `.env.local`, and confirm [http://localhost:3000/api/health](http://localhost:3000/api/health) returns `"database":"ok"`.

What `init` does:

- **Supabase** — choose `local` to start Docker Supabase, write its keys to `.env.local`, bootstrap required board data, and optionally seed an admin user. Choose `skip` if the database is already set up (`pnpm ticqex init --supabase skip`).
- **Email** — on by default. For UI/API/MCP-only work, answer **no** when asked to enable the email channel. With email on, init asks for your Resend API key, sender details, and webhook URL — see [Email channel](#email-channel-resend).
- **Config** — init may update `config/ticqex.config.json`, the committed activation file that controls which channels/integrations are on (`config/ticqex.config.example.json` is the template).

`pnpm ticqex init` is local-only; for production see [Deploy](#deploy-supabase-cloud--vercel).

### Manual setup (without the CLI)

The explicit equivalent of `init`, useful for CI or full control:

```bash
pnpm install
cp config/ticqex.config.example.json config/ticqex.config.json   # disable email here if unwanted
cp .env.example .env.local
pnpm db:start        # local Supabase (Docker); if stale: pnpm db:stop && pnpm db:start
pnpm db:env          # write Supabase keys → .env.local
pnpm db:bootstrap    # required statuses + settings
pnpm db:seed-admin   # admin user from SEED_ADMIN_* in .env.local
pnpm config:check && pnpm env:verify
pnpm dev
```

If email is enabled in the config, also complete the [Email channel](#email-channel-resend) steps.

## Email channel (Resend)

Skip this section if email is disabled in `config/ticqex.config.json`.

1. Create a [Resend API key](https://resend.com/api-keys) and set in `.env.local`:
  ```bash
   RESEND_API_KEY=re_...
   SUPPORT_EMAIL=hello@yourdomain.com    # Resend-verified sender
   SUPPORT_FROM_NAME=Your Support Name
  ```
2. **Inbound email needs a public HTTPS URL** — Resend cannot POST webhooks to `http://localhost:3000`. Locally, start a tunnel (`ngrok http 3000`, Cloudflare Tunnel, …) and set `NEXT_PUBLIC_APP_URL` to its HTTPS URL. For UI-only local work, `http://localhost:3000` is fine.
3. Register webhooks (writes `RESEND_WEBHOOK_SECRET` to `.env.local`):
  ```bash
   pnpm resend:setup-webhooks --app-url https://your-public-host
  ```
   The endpoint is `{NEXT_PUBLIC_APP_URL}/api/webhooks/integrations/resend`.
4. Test: with `pnpm dev` and the tunnel running, send an email to your inbound address — a ticket appears on the board.

If the tunnel or domain changes, update `NEXT_PUBLIC_APP_URL` and re-run `pnpm resend:setup-webhooks --app-url <new-https-url>`.

Async email processing runs in-process via Next.js `after()` — no external job runner.

## Deploy (Supabase Cloud + Vercel)

You need a Supabase project, a Vercel project connected to this repo, a Resend account if email is enabled, and both CLIs logged in (`supabase login`, `vercel login`).

1. **Prepare** — `pnpm install`, then create `config/ticqex.config.json` from the example and set the channels you want before deploying.
2. **Supabase** — link and migrate against your project ref (from `https://<project-ref>.supabase.co`):
  ```bash
   supabase link --project-ref <project-ref>
   supabase db push --linked
   supabase db query --linked -f supabase/bootstrap.sql
  ```
3. **Vercel** — import the repo (or `vercel link`) and set the [environment variables](#environment-reference) for Production and Preview: the three Supabase keys (from Supabase **Project Settings → API Keys**), `NEXT_PUBLIC_APP_URL` (your production URL), and the Resend vars if email is enabled. Deploy once so the webhook endpoints exist:
  ```bash
   vercel deploy --prod
  ```
4. **Resend** (email only) — verify your sender domain, then register webhooks against the deployed URL and copy the generated `RESEND_WEBHOOK_SECRET` from `.env.local` into Vercel, then redeploy:
  ```bash
   RESEND_API_KEY=re_... pnpm resend:setup-webhooks --app-url https://<your-vercel-host>
  ```
5. **First admin** — run locally against the cloud project (values live only in this shell; never commit them):
  ```bash
   NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co \
   SUPABASE_SECRET_KEY=<secret-key> \
   SEED_ADMIN_EMAIL=you@example.com \
   SEED_ADMIN_PASSWORD='choose-a-strong-password' \
   pnpm db:seed-admin
  ```
6. **Verify** — `https://<host>/api/health` returns `"database":"ok"`, admin sign-in works, and (if enabled) an inbound test email becomes a ticket.

## Environment reference


| Variable                                   | Source                                                | Required for                                         |
| ------------------------------------------ | ----------------------------------------------------- | ---------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`                 | `pnpm db:env` / Supabase dashboard                    | App + API                                            |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`     | `pnpm db:env` / Supabase dashboard                    | App auth (client)                                    |
| `SUPABASE_SECRET_KEY`                      | `pnpm db:env` / Supabase dashboard                    | Admin seed, server jobs                              |
| `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` | `.env.example` defaults                               | `pnpm db:seed-admin`                                 |
| `NEXT_PUBLIC_APP_URL`                      | init / you                                            | Public URL; must be HTTPS for inbound email webhooks |
| `RESEND_API_KEY`                           | [Resend API keys](https://resend.com/api-keys) / init | Email enabled                                        |
| `RESEND_WEBHOOK_SECRET`                    | `pnpm resend:setup-webhooks` / init                   | Svix verification of Resend webhooks                 |
| `SUPPORT_EMAIL` / `SUPPORT_FROM_NAME`      | init / you                                            | Outbound From address and display name               |


## Connect an agent (API & MCP)

Agents connect like any automation: **REST** (`/api/v1/`*) or **MCP** (`/api/mcp`), both authenticated with a Bearer API key.

1. Sign in as an admin and open **Settings → API & MCP**.
2. Create an API key and copy it once (it is not shown again).
3. Point your client at `{NEXT_PUBLIC_APP_URL}/api/mcp` with `Authorization: Bearer <key>` — the settings page has copy-paste snippets for Cursor, Codex, Claude Code, and similar clients. HTTP-only integrations use the same key against `/api/v1/`*.

MCP tools mirror the REST mutations agents need (tickets, board moves, messages, contacts, tags, statuses, custom fields, settings, …); parity is enforced in `tests/unit/mcp-api-parity.test.ts`. API key lifecycle stays in the admin UI and REST only — not exposed over MCP.

## Scripts


| Command                                        | Description                                                             |
| ---------------------------------------------- | ----------------------------------------------------------------------- |
| `pnpm dev` / `build` / `lint`                  | Dev server, production build, ESLint                                    |
| `pnpm ticqex init`                             | Interactive local setup: Supabase, email/Resend env, activation config  |
| `pnpm resend:setup-webhooks`                   | Create Resend webhooks and write signing secrets to `.env.local`        |
| `pnpm config:check`                            | Validate `config/ticqex.config.json` bindings and required env vars     |
| `pnpm config:sync`                             | Validate activation JSON and print planned channel field sync (dry-run) |
| `pnpm env:verify`                              | Check Supabase env vars                                                 |
| `pnpm db:start` / `db:stop` / `db:reset`       | Local Supabase lifecycle (`reset` wipes local data)                     |
| `pnpm db:env`                                  | Sync Supabase keys → `.env.local`                                       |
| `pnpm db:bootstrap`                            | Required statuses + settings (empty board)                              |
| `pnpm db:seed-admin`                           | Create admin user from `SEED_ADMIN_*`                                   |
| `pnpm test` / `test:unit` / `test:integration` | Vitest suites under `tests/`                                            |
| `pnpm seed:board-load`                         | Optional: large board dataset for manual load testing                   |


## Tests

Unit tests run without Supabase; integration tests need local Supabase and a seed admin:

```bash
pnpm test:unit
pnpm db:start && pnpm db:env && pnpm db:seed-admin && pnpm test:integration
```

Integration tests call `server/services` directly, except the MCP route test which needs `pnpm dev` running on `http://localhost:3000` (override with `LOCAL_APP_URL`; set `SKIP_MCP_INTEGRATION=1` to skip it).

## Project layout


| Path                                | Purpose                                                             |
| ----------------------------------- | ------------------------------------------------------------------- |
| `src/app/`                          | Next.js App Router — admin UI, `/api/v1/*`, webhooks, MCP           |
| `src/components/`                   | React components (board, settings, account)                         |
| `server/services/`                  | Business logic (tickets, board, messages, contacts, …)              |
| `server/channels/`                  | Product channel behavior (email today)                              |
| `server/integrations/`              | External providers (Resend)                                         |
| `server/lib/`, `server/middleware/` | Route handlers, auth, validation, errors                            |
| `shared/`                           | Code shared between client and server (config, registries, schemas) |
| `config/`                           | Activation config (`ticqex.config.json`, committed)                 |
| `scripts/`                          | Setup/seed/verify CLIs (`pnpm ticqex`, `db:*`, `config:*`)          |
| `supabase/migrations/`              | Database schema                                                     |
| `tests/unit`, `tests/integration`   | Vitest suites (helpers in `tests/helpers/`)                         |


## Contributing

Contributions are welcome — see [CONTRIBUTING.md](./CONTRIBUTING.md) for setup, coding standards, and the PR workflow. Security issues: see [SECURITY.md](./SECURITY.md).

## License

[MIT](./LICENSE)