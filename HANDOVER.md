# Ticqex — session handover (temporary)

> **Delete this file after the new agent has restarted services and confirmed the named tunnel.** See [Cleanup](#cleanup) below.

Written: 2026-05-21. Cloud workspace session: full stack startup + named Cloudflare tunnel pending.

## Goal

Run local **Ticqex** (Next.js + Supabase + Trigger.dev) and expose it on the **named** Cloudflare tunnel hostname so Resend webhooks and public access use a stable URL.

| Public hostname | Tunnel name | Tunnel ID |
|-----------------|-------------|-----------|
| `readbetter.rbouschery.de` | `ticqex-dev` | `6a63d384-56ef-432c-8e2e-b573acc1153e` |

Do **not** use `cloudflared tunnel --url http://localhost:3000` for this hostname — quick tunnels are a separate mechanism and do not attach to the named tunnel DNS.

## What was done this session

| Item | Status |
|------|--------|
| Docker + Supabase local (`pnpm db:start`) | Done |
| `.env.local` via `pnpm db:env` + `pnpm trigger:env` | Done |
| Trigger CLI config at `~/.config/trigger/config.json` from `TRIGGER_ACCESS_TOKEN` | Done |
| Admin user seeded (`admin@ticqex.local`) | Done |
| `pnpm dev:all` (Next.js :3000 + Trigger.dev worker) | Running |
| Local health `http://127.0.0.1:3000/api/health` | OK |
| Admin login to `/board` | Verified |
| `cloudflared` installed (v2026.5.0) | Done |
| **Named tunnel** `ticqex-dev` → `readbetter.rbouschery.de` | **Not running** — needs `CLOUDFLARE_TUNNEL_TOKEN` |
| Quick tunnel (`trycloudflare.com`) | Was started by mistake; stopped |

## Blocker: Cloudflare tunnel credentials

This VM has **no** `~/.cloudflared/cert.pem` or tunnel credentials JSON. Interactive `cloudflared tunnel login` was attempted but requires browser auth on a fresh VM.

**User action before restart:** add a Cursor Cloud secret:

| Secret name | How to get it |
|-------------|---------------|
| `CLOUDFLARE_TUNNEL_TOKEN` | [Cloudflare Zero Trust](https://one.dash.cloudflare.com/) → **Networks** → **Tunnels** → **ticqex-dev** → copy the **run token** (long JWT-like string) |

Optional but recommended:

| Secret name | Value |
|-------------|--------|
| `NEXT_PUBLIC_APP_URL` | `https://readbetter.rbouschery.de` |

Alternative (if not using run token): `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` — agent can fetch the run token via API for tunnel `6a63d384-56ef-432c-8e2e-b573acc1153e`.

## Restart checklist (new agent)

Run in order:

```bash
# 1. Docker (cloud VM)
sudo dockerd &
sleep 3
sudo chmod 666 /var/run/docker.sock

# 2. Supabase + DB
cd /workspace
pnpm db:start
# If stale: pnpm db:stop && pnpm db:start
pnpm db:env
pnpm db:seed-admin

# 3. Merge harness secrets into .env.local (Resend, Trigger, app URL)
node -e "
const fs = require('fs');
function setLine(c, k, v) {
  const line = k + '=' + v;
  const p = new RegExp('^' + k + '=.*$', 'm');
  return p.test(c) ? c.replace(p, line) : c.replace(/\n?$/, '') + '\n' + line + '\n';
}
let c = fs.readFileSync('.env.local', 'utf8');
for (const k of ['RESEND_API_KEY','RESEND_INBOUND_WEBHOOK_SECRET','SUPPORT_EMAIL','SUPPORT_FROM_NAME','TRIGGER_PROJECT_REF','TRIGGER_SECRET_KEY','NEXT_PUBLIC_APP_URL']) {
  if (process.env[k]) c = setLine(c, k, process.env[k]);
}
fs.writeFileSync('.env.local', c.endsWith('\n') ? c : c + '\n');
console.log('Merged harness keys into .env.local');
"

# 4. Trigger CLI (non-interactive — uses TRIGGER_ACCESS_TOKEN from harness)
mkdir -p ~/.config/trigger
node -e "
const fs = require('fs');
const p = process.env.HOME + '/.config/trigger/config.json';
fs.writeFileSync(p, JSON.stringify({
  profiles: { default: { accessToken: process.env.TRIGGER_ACCESS_TOKEN, apiUrl: 'https://api.trigger.dev' } },
  currentProfile: 'default'
}, null, 2));
console.log('Trigger CLI config written');
"
pnpm trigger:env   # refresh TRIGGER_SECRET_KEY in .env.local if needed

# 5. App
pnpm dev:all       # Next.js (3000) + Trigger.dev dev worker

# 6. Named tunnel (NOT quick tunnel)
cloudflared tunnel run --token "$CLOUDFLARE_TUNNEL_TOKEN"
```

If `CLOUDFLARE_TUNNEL_TOKEN` is set, prefer the one-liner above. Fallback with config file (after credentials exist on VM):

```yaml
# ~/.cloudflared/config.yml
tunnel: ticqex-dev
credentials-file: /home/ubuntu/.cloudflared/6a63d384-56ef-432c-8e2e-b573acc1153e.json
ingress:
  - hostname: readbetter.rbouschery.de
    service: http://localhost:3000
  - service: http_status:404
```

```bash
cloudflared tunnel run ticqex-dev
```

## Health checks

```bash
curl -s http://127.0.0.1:3000/api/health
curl -s https://readbetter.rbouschery.de/api/health
```

Expect: `{"status":"ok","checks":{"app":"ok","database":"ok"}}`

Public URL returning **1033** or **530** → named tunnel not connected. **502** → tunnel up but nothing on `:3000`.

## Environment variables

Harness typically injects (check with `echo "$CLOUD_AGENT_INJECTED_SECRET_NAMES"`):

- `RESEND_API_KEY`, `RESEND_INBOUND_WEBHOOK_SECRET`
- `TRIGGER_ACCESS_TOKEN`, `TRIGGER_SECRET_KEY`, `TRIGGER_PROJECT_REF`
- `SUPPORT_EMAIL`, `SUPPORT_FROM_NAME`
- `NEXT_PUBLIC_APP_URL` (set to `https://readbetter.rbouschery.de` after tunnel works)

Supabase JWT keys come from `pnpm db:env` (not in harness).

Default admin: `admin@ticqex.local` / `ticqex-admin-change-me`

## Resend webhook

| Setting | Value |
|---------|--------|
| Inbound webhook URL | `https://readbetter.rbouschery.de/api/webhooks/resend/inbound` |
| Event | `email.received` only |
| Signing secret | → `RESEND_INBOUND_WEBHOOK_SECRET` in `.env.local` / harness |

Inbound receiving (MX/domain) must be enabled in Resend separately from the webhook.

## AGENTS.md note

`main` has a **short** AGENTS.md. The full Cloud/tunnel/Resend instructions live on branch `cursor/agents-cloud-setup-f2f6` — consider merging that back into `main` after this session.

## Gotchas

- **`pnpm dev:all`** needs Trigger CLI config; use `TRIGGER_ACCESS_TOKEN` trick above instead of interactive `pnpm trigger:login`.
- **Supabase stale state**: `supabase start` may say “already running” while DB container exited → `pnpm db:stop && pnpm db:start`.
- **Nothing on :3000** → tunnel returns **502**; health URL fails publicly even if tunnel is up.
- **`ticqex-dev` not running** → **1033/530** from Cloudflare.
- Do not commit `.env.local` or `~/.cloudflared/*` — VM-only secrets.

## Docs reference

- [docs/INTEGRATIONS.md](./docs/INTEGRATIONS.md) — email + Trigger flows
- [AGENTS.md](./AGENTS.md) — Cursor Cloud startup (short version on `main`)

---

## Cleanup

**After the new agent has:**

1. Confirmed `CLOUDFLARE_TUNNEL_TOKEN` is in the harness and the named tunnel is running
2. Started Supabase, `pnpm dev:all`, and `cloudflared tunnel run --token …`
3. Verified `https://readbetter.rbouschery.de/api/health` returns OK
4. Set `NEXT_PUBLIC_APP_URL=https://readbetter.rbouschery.de` in harness / `.env.local`
5. Confirmed admin login at `/board` if needed

**Delete this file:**

```bash
git rm HANDOVER.md
git commit -m "chore: remove temporary session handover doc"
git push origin main
```

This handover is intentionally short-lived; do not link to it from other docs.
