<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Cursor Cloud specific instructions

### What this environment is for

Local development of **inbound email** (Resend webhook → ticket) and **outbound email** (admin public reply → Resend), with the app exposed on the internet via a **named Cloudflare tunnel** so Resend can reach webhooks.

| Public hostname | Tunnel name | Tunnel ID |
|-----------------|-------------|-----------|
| `readbetter.rbouschery.de` | `ticqex-dev` | `6a63d384-56ef-432c-8e2e-b573acc1153e` |

Do **not** use `cloudflared tunnel --url http://localhost:3000` for Resend/webhook testing on that hostname — quick tunnels are a separate mechanism and do not use the named tunnel DNS.

Further integration detail: [docs/INTEGRATIONS.md](./docs/INTEGRATIONS.md).

### Services overview

| Service | Command | Port | Notes |
|---------|---------|------|-------|
| Next.js dev server | `pnpm dev` | 3000 | App UI + API routes; loads `.env.local` |
| Trigger.dev dev | `pnpm trigger:dev` | — | Optional local worker; see [Trigger.dev](#triggerdev) |
| Next + Trigger | `pnpm dev:all` | 3000 | Both processes; requires `pnpm trigger:login` on the VM |
| Supabase local | `pnpm db:start` | 54321 (API), 54322 (DB), 54323 (Studio) | Requires Docker |
| Cloudflare tunnel | `cloudflared tunnel run ticqex-dev` | — | Proxies public hostname → `localhost:3000` |

### Secrets: Cursor Cloud harness

The cloud agent harness injects secrets into the **process environment** (not committed to git). Inspect names with:

```bash
echo "$CLOUD_AGENT_ALL_SECRET_NAMES"
echo "$CLOUD_AGENT_INJECTED_SECRET_NAMES"
```

Typically provided:

| Variable | In harness | Notes |
|----------|------------|-------|
| `RESEND_API_KEY` | Yes | Outbound + Resend API |
| `TRIGGER_PROJECT_REF` | Yes | |
| `TRIGGER_SECRET_KEY` | Yes | App can queue jobs without `trigger:dev` |
| `SUPPORT_EMAIL` | Yes | Verified Resend sender |
| `SUPPORT_FROM_NAME` | Yes | |
| `NEXT_PUBLIC_APP_URL` | Yes | Often tunnel URL or `http://localhost:3000` |
| `RESEND_INBOUND_WEBHOOK_SECRET` | Usually **no** | Set manually in `.env.local` for signed webhooks |
| Supabase JWT keys | **No** | Written by `pnpm db:env` after `pnpm db:start` |

Next.js and most scripts expect **`.env.local`** (gitignored). After harness vars are available, create/update it before starting the app:

```bash
cd /workspace
cp -n .env.example .env.local 2>/dev/null || true

# Merge harness into .env.local (run from repo root; values come from env)
node -e "
const fs = require('fs');
function setLine(c, k, v) {
  const line = k + '=' + v;
  const p = new RegExp('^' + k + '=.*$', 'm');
  return p.test(c) ? c.replace(p, line) : c.replace(/\n?$/, '') + '\n' + line + '\n';
}
let c = fs.readFileSync('.env.local', 'utf8');
for (const k of ['RESEND_API_KEY','SUPPORT_EMAIL','SUPPORT_FROM_NAME','TRIGGER_PROJECT_REF','TRIGGER_SECRET_KEY','NEXT_PUBLIC_APP_URL']) {
  if (process.env[k]) c = setLine(c, k, process.env[k]);
}
fs.writeFileSync('.env.local', c.endsWith('\n') ? c : c + '\n');
console.log('Merged harness keys into .env.local');
"

pnpm db:start   # if not already running
pnpm db:env     # sync NEXT_PUBLIC_SUPABASE_* and SUPABASE_SERVICE_ROLE_KEY
```

Add `RESEND_INBOUND_WEBHOOK_SECRET=whsec_...` to `.env.local` when testing real Resend webhooks (from Resend dashboard → webhook signing secret). Without it, signature verification is skipped when `NODE_ENV` is not `production`.

### Full startup sequence (next session)

Run in order:

```bash
# 1. Docker (cloud VM)
sudo dockerd &
sleep 3
sudo chmod 666 /var/run/docker.sock

# 2. Supabase + DB
cd /workspace
pnpm db:start
# If containers are stale: pnpm db:stop && pnpm db:start
pnpm db:env
# Optional clean slate: pnpm db:reset
pnpm db:seed-admin

# 3. .env.local — harness merge (above) + pnpm db:env + optional RESEND_INBOUND_WEBHOOK_SECRET

# 4. App (pick one)
pnpm dev              # enough when TRIGGER_SECRET_KEY is in .env.local / harness
# pnpm dev:all        # Next + trigger:dev (requires `pnpm trigger:login` once per VM)
# TRIGGER_INLINE_INBOUND=true — optional bypass if trigger:dev is not running (not recommended once Trigger is set up)

# 5. Named tunnel (separate terminal or background)
cloudflared tunnel run ticqex-dev
```

**Health checks:**

```bash
curl -s http://127.0.0.1:3000/api/health
curl -s https://readbetter.rbouschery.de/api/health
```

Expect: `{"status":"ok","checks":{"app":"ok","database":"ok"}}`

### Cloudflare tunnel

**VM-only files** (not in git): `~/.cloudflared/cert.pem`, `~/.cloudflared/config.yml`, `~/.cloudflared/<tunnel-id>.json`.

Install `cloudflared` if missing (linux amd64):

```bash
curl -sL https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o /tmp/cloudflared
chmod +x /tmp/cloudflared && sudo mv /tmp/cloudflared /usr/local/bin/cloudflared
```

**First time on a new VM** (or after credentials are lost):

1. `cloudflared tunnel login` — opens Cloudflare auth; saves `~/.cloudflared/cert.pem`. User may need to complete login in the desktop browser.
2. Ensure tunnel credentials exist. Either copy `6a63d384-56ef-432c-8e2e-b573acc1153e.json` from a previous VM, or fetch a run token and save credentials:

```bash
mkdir -p ~/.cloudflared
cloudflared tunnel token 6a63d384-56ef-432c-8e2e-b573acc1153e | tee /tmp/tunnel.token
# Optional: decode token into credentials JSON for config.yml (see existing file on a working VM)
```

3. `~/.cloudflared/config.yml`:

```yaml
tunnel: ticqex-dev
credentials-file: /home/ubuntu/.cloudflared/6a63d384-56ef-432c-8e2e-b573acc1153e.json
ingress:
  - hostname: readbetter.rbouschery.de
    service: http://localhost:3000
  - service: http_status:404
```

4. `cloudflared tunnel run ticqex-dev`  
   Alternative one-off: `cloudflared tunnel run --token "$(cloudflared tunnel token 6a63d384-56ef-432c-8e2e-b573acc1153e)"`

**DNS** was routed with `cloudflared tunnel route dns ticqex-dev readbetter.rbouschery.de`. Confirm in Cloudflare DNS that `readbetter.rbouschery.de` CNAME points at the tunnel (not apex/www unless intended).

**Diagnostics:**

```bash
cloudflared tunnel list
cloudflared tunnel info ticqex-dev
```

### Resend

| Setting | Value |
|---------|--------|
| Inbound webhook URL | `https://readbetter.rbouschery.de/api/webhooks/resend/inbound` |
| Event | `email.received` only |
| Signing secret | → `RESEND_INBOUND_WEBHOOK_SECRET` in `.env.local` |

**Register webhook (API)** — requires `RESEND_API_KEY` and a reachable `ENDPOINT` (tunnel + Next running):

```bash
pnpm resend:webhook          # creates webhook in Resend, writes signing_secret to .env.local
pnpm resend:webhook:test     # Svix-signed smoke POST to localhost
WEBHOOK_TEST_URL=https://readbetter.rbouschery.de pnpm resend:webhook:test
```

Override endpoint: `RESEND_INBOUND_WEBHOOK_URL=https://... pnpm resend:webhook`

Add `RESEND_INBOUND_WEBHOOK_SECRET` to the Cursor Cloud harness after the first `pnpm resend:webhook` so restarts keep the same secret without re-registering.

Inbound webhooks are verified with **Svix** headers (`svix-id`, `svix-timestamp`, `svix-signature`), not a plain HMAC of the body.

**Inbound receiving** (MX/domain) must be enabled in Resend separately from the webhook.

**Metadata-only webhooks:** `email.received` payloads do not include the body. Tickets may have an empty body until the app fetches content via the [Received emails API](https://resend.com/api-reference/emails/retrieve-received-email).

**Outbound test:** Sign in to admin → open a ticket whose customer `username` is a real email → post a **public** (non-internal) reply → check Resend dashboard and inbox.

### Trigger.dev

| Mode | When |
|------|------|
| `TRIGGER_SECRET_KEY` in `.env.local` / harness | Webhooks and outbound can **inline** process in Next.js without `trigger:dev` |
| `pnpm trigger:login` + `pnpm trigger:env` | Sync keys from CLI; required for `pnpm dev:all` / `pnpm trigger:dev` |
| `pnpm trigger:create` | First-time project bootstrap on a new Trigger account |

`pnpm dev:all` blocks on interactive `trigger login` until the CLI is authorized on that VM. Prefer `pnpm dev` when the harness already supplies `TRIGGER_SECRET_KEY`.

### Key gotchas

- **Docker in cloud VM**: Requires `fuse-overlayfs` storage driver and `iptables-legacy`. `/etc/docker/daemon.json` should include `{"storage-driver": "fuse-overlayfs"}`.
- **Supabase stale state**: `supabase start` may report “already running” while DB container exited → `pnpm db:stop && pnpm db:start`.
- **Supabase keys format**: CLI may show short keys (`sb_publishable_*`, `sb_secret_*`). This app uses JWT keys from `pnpm db:env` (`ANON_KEY` / `SERVICE_ROLE_KEY` in `supabase status -o json`).
- **Nothing on :3000** → tunnel returns **502**; health URL fails publicly even if tunnel is up.
- **`ticqex-dev` not running** → **530** from Cloudflare; `cloudflared tunnel info ticqex-dev` shows no connectors.
- **esbuild build scripts**: pnpm ignores esbuild postinstall by default; `tsx` seed scripts still work.
- **Admin credentials**: `admin@ticqex.local` / `ticqex-admin-change-me` via `pnpm db:seed-admin` (override with `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`).
- **Webhook POST without signature** → **401** locally (expected). Configure `RESEND_INBOUND_WEBHOOK_SECRET` for production-like verification.

### Standard commands

`pnpm lint`, `pnpm build`, `pnpm dev`, `pnpm dev:all`, `pnpm db:start`, `pnpm db:stop`, `pnpm db:reset`, `pnpm db:env`, `pnpm db:seed-admin`, `pnpm trigger:login`, `pnpm trigger:create`, `pnpm trigger:env`, `pnpm trigger:dev`.
