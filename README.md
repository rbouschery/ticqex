<p align="center">
  <img src="./public/web-app-manifest-192x192.png" alt="Ticqex" width="96" height="96">
</p>

<p align="center">
  <strong>A thin UX and headless data layer for support and helpdesk — where humans and AI agents work the same queue, together.</strong>
</p>

<hr />

<p align="center">
  <a href="https://github.com/rbouschery/ticqex/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/rbouschery/ticqex/ci.yml?branch=main&label=CI" alt="CI"></a>
  <a href="https://www.npmjs.com/package/@ticqex/cli"><img src="https://img.shields.io/npm/v/@ticqex/cli?label=%40ticqex%2Fcli" alt="@ticqex/cli on npm"></a>
  <a href="https://www.npmjs.com/package/@ticqex/api-client"><img src="https://img.shields.io/npm/v/@ticqex/api-client?label=%40ticqex%2Fapi-client" alt="@ticqex/api-client on npm"></a>
  <a href="./LICENSE"><img src="https://img.shields.io/github/license/rbouschery/ticqex" alt="License: MIT"></a>
  <img src="https://img.shields.io/badge/status-pre--1.0-orange" alt="Status: pre-1.0">
  <img src="https://img.shields.io/badge/open--source-free-brightgreen" alt="Open-Source · Free">
</p>

## What is Ticqex?

Ticqex is a flexible, customizable support desk built on one idea: humans and AI agents are both first-class operators. Tickets live on a Kanban board for people to work, but every action — creating and editing tickets, adding lanes, defining custom fields — is equally available over API and MCP. Use it through the admin UX, or run it completely headless through REST, MCP, the TypeScript API client, or the CLI.

Ticqex is agent-agnostic. Plug in whatever agent you prefer — Claude, Codex, Cursor, Pi, OpenClaw, Hermes. If it can call an API or MCP, it works with Ticqex.

Tickets can be created manually, arrive through the API, or come in through channels and integrations. Ticqex ships with a built-in email channel powered by Resend, so an inbound support email becomes a ticket that you — or your agent — can reply to in place, without juggling a separate inbox.

Need a different channel? Use the channel and integration templates to build your own. Slack, chatbots, WordPress forms — if it can send a request, you can wire it up.

Ticqex is built with Next.js and runs on Supabase, leveraging its Postgres database, authentication layer and storage.

<p align="center">
  Built by
  <a href="https://x.com/RBouschery"><img src="https://img.shields.io/badge/X-RBouschery-black?logo=x&logoColor=white" alt="X: @RBouschery"></a>
  <a href="https://www.linkedin.com/in/rbouschery"><img src="https://img.shields.io/badge/LinkedIn-rbouschery-0A66C2?logo=linkedin&logoColor=white" alt="LinkedIn: rbouschery"></a>
</p>

## Quick start (local)

Prerequisites: Node 20+ (dev pinned to 22, see `[.nvmrc](./.nvmrc)`), [pnpm](https://pnpm.io/), [Docker](https://www.docker.com/) (for local Supabase).

```bash
pnpm install       # also builds workspace packages (@ticqex/api-spec, etc.)
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
pnpm install       # builds workspace packages
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
5. **First admin** — create the user in the Supabase dashboard, then promote it to admin:
   - In your project, go to **Authentication → Users → Add user → Create new user**, enter the email and password, and tick **Auto Confirm User**.
   - New sign-ups default to the `agent` role, so grant admin once: open **Table Editor → `users`**, find the row for that email (created automatically), and set `role` to `admin`. (Equivalently, run `update public.users set role = 'admin' where email = 'you@example.com';` in the **SQL Editor**.)
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


## Connect an agent (headless API & MCP)

Agents and other headless clients connect like any automation: **REST** (`/api/v1/`*) or **MCP** (`/api/mcp`), both authenticated with a Bearer API key.

1. Sign in as an admin and open **Settings → API & MCP**.
2. Create an API key and copy it once (it is not shown again).
3. Point your client at `{NEXT_PUBLIC_APP_URL}/api/mcp` with `Authorization: Bearer <key>` — the settings page has copy-paste snippets for Cursor, Codex, Claude Code, and similar clients. HTTP-only integrations use the same key against `/api/v1/`*.

MCP tools mirror the REST mutations agents need (tickets, board moves, messages, contacts, tags, statuses, custom fields, settings, …); parity is enforced in `tests/unit/mcp-api-parity.test.ts`. API key lifecycle stays in the admin UI and REST only — not exposed over MCP.

### Published packages

Ticqex publishes two public npm packages:

- [`@ticqex/cli`](https://www.npmjs.com/package/@ticqex/cli) — a shell-friendly headless client for agents, scripts, and release checks.
- [`@ticqex/api-client`](https://www.npmjs.com/package/@ticqex/api-client) — a small TypeScript client for headless REST API integrations.

`@ticqex/api-spec` is intentionally internal. The CLI bundles the operation catalog it needs, so consumers do not need to install or depend on the spec package.

### Agent CLI (`@ticqex/cli`)

For shell-based agents and scripts, run the published CLI:

```bash
pnpm dlx @ticqex/cli --help
ticqex auth login --instance https://your-instance.example.com
ticqex tickets list --page 1 --json
ticqex call ticqex_get_ticket --input '{"id":"<uuid>"}'
```

`auth login` prompts for an API key from **Settings → API & MCP**. You can also skip stored credentials and pass `--instance` / `--api-key`, or set `TICQEX_INSTANCE` and `TICQEX_API_KEY`.

When developing from this repo, use `node packages/cli/dist/main.js` after `pnpm --filter @ticqex/cli... build`.

See [`packages/cli/README.md`](packages/cli/README.md). Request schemas: [`docs/openapi.yaml`](docs/openapi.yaml).

### TypeScript API client (`@ticqex/api-client`)

Install the client when you want to call Ticqex from an app, worker, integration, or agent runtime:

```bash
pnpm add @ticqex/api-client
```

```typescript
import { TicqexClient } from "@ticqex/api-client";

const client = new TicqexClient({
  baseUrl: "https://your-instance.example.com",
  apiKey: process.env.TICQEX_API_KEY!,
});

const tickets = await client.get("/tickets", { page: 1, per_page: 25 });
const created = await client.post("/tickets", {
  subject: "Login issue",
  contact_email: "user@example.com",
});
```

Paths are relative to `/api/v1`; the client adds that prefix for you. See [`packages/api-client/README.md`](packages/api-client/README.md).

OpenAPI spec: [`docs/openapi.yaml`](docs/openapi.yaml) — regenerate with `pnpm openapi:generate`, verify with `pnpm openapi:check`.

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
| `pnpm openapi:generate` / `openapi:check`      | Generate or verify `docs/openapi.yaml`                                  |
| `pnpm build:packages` / `test:packages`        | Build and test `@ticqex/*` workspace packages                           |
| `pnpm seed:board-load`                         | Optional: large board dataset for manual load testing                   |
| `pnpm seed:cedar-crm-demo`                     | Optional: 10-ticket Cedar CRM demo with fields and tags                 |


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