# Ticqex — session handover (temporary)

> **Delete this file after the new agent has restarted services.** See [Cleanup](#cleanup) below.

Written: 2026-05-20. Cloud workspace session for local email + Cloudflare tunnel setup.

## Goal

Test **inbound** (Resend → webhook → ticket) and **outbound** (admin public reply → Resend) email locally in Cursor Cloud, exposed via a **persistent Cloudflare named tunnel**.

## What was done this session

| Item | Status |
|------|--------|
| `cloudflared` installed (v2026.5.0) | Done |
| Cloudflare login + tunnel `ticqex-dev` (`6a63d384-56ef-432c-8e2e-b573acc1153e`) | Done |
| DNS: `readbetter.rbouschery.de` → `ticqex-dev` (`cloudflared tunnel route dns`) | Done |
| `~/.cloudflared/config.yml` ingress → `http://localhost:3000` | Done (on VM; not in git) |
| Docker + Supabase local (`pnpm db:start`, `db:reset`, `db:seed-admin`) | Done when run |
| Next.js on :3000 | Verified via `/api/health` |
| Named tunnel `cloudflared tunnel run ticqex-dev` | Verified public health OK |
| `.env.local` in workspace | Created from `.env.example` + `pnpm db:env` only — **real Resend/Trigger secrets were not in repo** (user has them saved elsewhere) |

## Restart checklist (new agent)

Run in order:

```bash
# 1. Docker (cloud VM)
sudo dockerd & 
sleep 3
sudo chmod 666 /var/run/docker.sock

# 2. Supabase + DB
cd /workspace
# Ensure .env.local has YOUR keys (Resend, Trigger, SUPPORT_EMAIL) — not placeholders
pnpm db:start
pnpm db:env
pnpm db:reset          # if you need a clean DB
pnpm db:seed-admin

# 3. Trigger.dev (if using queued jobs)
pnpm trigger:login     # browser auth once per machine
pnpm trigger:env       # writes TRIGGER_PROJECT_REF + TRIGGER_SECRET_KEY

# 4. App
pnpm dev:all           # or: pnpm dev + pnpm trigger:dev in two terminals

# 5. Named tunnel (persistent hostname)
cloudflared tunnel run ticqex-dev
```

**Health checks:**

- Local: `curl http://127.0.0.1:3000/api/health`
- Public: `curl https://readbetter.rbouschery.de/api/health`

Expect: `{"status":"ok","checks":{"app":"ok","database":"ok"}}`

## Environment variables (`.env.local`)

Required for full email flow:

```env
# From pnpm db:env
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...

# User-provided (Phase 3)
RESEND_API_KEY=re_...
RESEND_INBOUND_WEBHOOK_SECRET=whsec_...
SUPPORT_EMAIL=<verified Resend sender>
SUPPORT_FROM_NAME=Support

# User-provided (Trigger.dev)
TRIGGER_PROJECT_REF=proj_...
TRIGGER_SECRET_KEY=tr_dev_...

NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Without valid `TRIGGER_SECRET_KEY`, webhooks and outbound **still work** via inline processing in Next.js (see README).

Default admin (after seed): `admin@ticqex.local` / `ticqex-admin-change-me`

## Resend

| Setting | Value |
|---------|--------|
| Webhook URL | `https://readbetter.rbouschery.de/api/webhooks/resend/inbound` |
| Event | `email.received` only |
| Signing secret | → `RESEND_INBOUND_WEBHOOK_SECRET` |

**Inbound receiving** must be enabled in Resend (domain/MX), separate from the webhook.

**Note:** Resend `email.received` webhooks send metadata only (no body). Tickets may have empty body until the app fetches via [Received emails API](https://resend.com/api-reference/emails/retrieve-received-email).

## Cloudflare tunnel (on VM, not in repo)

Credentials: `~/.cloudflared/6a63d384-56ef-432c-8e2e-b573acc1153e.json`  
Config example:

```yaml
tunnel: ticqex-dev
credentials-file: /home/ubuntu/.cloudflared/6a63d384-56ef-432c-8e2e-b573acc1153e.json
ingress:
  - hostname: readbetter.rbouschery.de
    service: http://localhost:3000
  - service: http_status:404
```

Do **not** use `cloudflared tunnel --url http://localhost:3000` for production testing of `readbetter.rbouschery.de` — that is a separate quick tunnel and does not attach to the named tunnel DNS.

## Outbound test

1. Sign in to admin UI (tunnel URL or localhost:3000).
2. Open a ticket whose customer `username` is a real email.
3. Post a **public** reply (not internal).
4. Check Resend dashboard + inbox.

## Gotchas from this session

- **Nothing on :3000** → tunnel returns 502/530.
- **`ticqex-dev` not running** → `readbetter.rbouschery.de` returns Cloudflare 530; `cloudflared tunnel info ticqex-dev` shows no connections.
- **`pnpm dev:all`** blocked until `pnpm trigger:login` completes on a fresh VM; use `pnpm dev` alone if Trigger CLI is not authed yet.
- **Subdomain DNS** overwrote/route for `readbetter.rbouschery.de` — confirm in Cloudflare DNS that this hostname is intended (not apex/www).

## Docs reference

- [docs/INTEGRATIONS.md](./docs/INTEGRATIONS.md) — email + Trigger flows
- [AGENTS.md](./AGENTS.md) — Cursor Cloud startup (Docker, Supabase, Trigger)

---

## Cleanup

**After the new agent has:**

1. Restored `.env.local` with real secrets  
2. Started Supabase, Next (and Trigger if needed), and `cloudflared tunnel run ticqex-dev`  
3. Confirmed `https://readbetter.rbouschery.de/api/health` is OK  
4. Configured Resend webhook (if not already)

**Delete this file:**

```bash
git rm HANDOVER.md
git commit -m "chore: remove temporary session handover doc"
git push origin main
```

This handover was intentionally short-lived; do not link to it from other docs.
