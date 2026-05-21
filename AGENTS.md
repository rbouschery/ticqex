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
| Next + Trigger | `pnpm dev:all` | 3000 | Both processes; requires Trigger CLI auth on the VM |
| Supabase local | `pnpm db:start` | 54321 (API), 54322 (DB), 54323 (Studio) | Requires Docker |
| Cloudflare tunnel | `cloudflared tunnel run --token "$CLOUDFLARE_TUNNEL_TOKEN"` | — | Proxies public hostname → `localhost:3000` |

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
| `RESEND_INBOUND_WEBHOOK_SECRET` | Yes | Svix signing secret (`whsec_...`) from Resend webhook details |
| `TRIGGER_ACCESS_TOKEN` | Yes | Non-interactive Trigger CLI auth (see below) |
| `TRIGGER_PROJECT_REF` | Yes | |
| `TRIGGER_SECRET_KEY` | Yes | App can queue jobs without `trigger:dev` |
| `CLOUDFLARE_TUNNEL_TOKEN` | Yes | Run token for named tunnel `ticqex-dev` |
| `SUPPORT_EMAIL` | Yes | Verified Resend sender |
| `SUPPORT_FROM_NAME` | Yes | |
| `NEXT_PUBLIC_APP_URL` | Yes | Set to `https://readbetter.rbouschery.de` when tunnel is up |
| Supabase JWT keys | **No** | Written by `pnpm db:env` after `pnpm db:start` |

Next.js and most scripts expect **`.env.local`** (gitignored). After harness vars are available, merge them before starting the app:

```bash
cd /workspace
pnpm db:env   # creates/updates .env.local with Supabase keys

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
```

If `RESEND_INBOUND_WEBHOOK_SECRET` is wrong or missing, copy the **signing secret** from [Resend → Webhooks](https://resend.com/webhooks) (webhook details page) or fetch it via `resend.webhooks.get(id)` using `RESEND_API_KEY`. If you recreate the webhook, update the harness secret to match.

### Full startup sequence

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
pnpm db:seed-admin

# 3. Merge harness into .env.local (script above) + pnpm trigger:env

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
pnpm trigger:env

# 5. App
pnpm dev:all       # Next.js (3000) + Trigger.dev dev worker

# 6. Named tunnel (NOT quick tunnel) — separate terminal or background
cloudflared tunnel run --token "$CLOUDFLARE_TUNNEL_TOKEN"
```

Install `cloudflared` if missing:

```bash
curl -L --output /tmp/cloudflared.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
sudo dpkg -i /tmp/cloudflared.deb
```

**Health checks:**

```bash
curl -s http://127.0.0.1:3000/api/health
curl -s https://readbetter.rbouschery.de/api/health
```

Expect: `{"status":"ok","checks":{"app":"ok","database":"ok"}}`

Public URL returning **1033** or **530** → named tunnel not connected. **502** → tunnel up but nothing on `:3000`.

### Cloudflare tunnel

Preferred on cloud VMs: set `CLOUDFLARE_TUNNEL_TOKEN` in the harness (Cloudflare Zero Trust → **Networks** → **Tunnels** → **ticqex-dev** → copy the **run token**).

Alternative with credentials on disk (`~/.cloudflared/cert.pem` + tunnel JSON):

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

Do not commit `.env.local` or `~/.cloudflared/*` — VM-only secrets.

### Resend

| Setting | Value |
|---------|--------|
| Inbound webhook URL | `https://readbetter.rbouschery.de/api/webhooks/resend/inbound` |
| Event | `email.received` only |
| Signing secret | → `RESEND_INBOUND_WEBHOOK_SECRET` in harness / `.env.local` |

**Webhook signature verification** uses **Svix**, not a plain HMAC of the body. Resend sends `svix-id`, `svix-timestamp`, and `svix-signature` headers. The app verifies via `resend.webhooks.verify()` in `server/adapters/email/resend.ts`. A wrong secret or incorrect verification algorithm returns `401 {"error":{"code":"unauthorized","message":"Invalid webhook signature"}}`.

Use the **raw request body** (string) when verifying — re-stringifying parsed JSON breaks the signature.

**Metadata-only webhooks:** `email.received` payloads do not include the body. The app calls `resend.emails.receiving.get(email_id)` in `resolveInbound()` before creating the ticket message. Without this, tickets are created with an empty body.

Inbound receiving (MX/domain) must be enabled in Resend separately from the webhook.

### Trigger.dev

| Mode | When |
|------|------|
| `TRIGGER_SECRET_KEY` in `.env.local` / harness | Webhooks and outbound can queue jobs without `trigger:dev` |
| `TRIGGER_ACCESS_TOKEN` + `~/.config/trigger/config.json` | Non-interactive CLI auth for `pnpm dev:all` / `pnpm trigger:dev` |
| `pnpm trigger:login` | Interactive fallback when `TRIGGER_ACCESS_TOKEN` is not available |
| `pnpm trigger:create` | First-time project bootstrap on a new Trigger account |

`pnpm dev:all` blocks on interactive `trigger login` until the CLI is authorized on that VM. Prefer the `TRIGGER_ACCESS_TOKEN` config trick above in cloud workspaces.

`pnpm trigger:dev` loads `.env.local` and allows up to 10 concurrent local runs. Inbound/outbound triggers use **idempotency keys** (Resend `email_id` / message UUID) so webhook retries do not spawn duplicate runs.

**If runs stall in `DEQUEUED` / `QUEUED` and tickets or emails never appear:**

```bash
pnpm trigger:clean    # cancel stuck dev runs + clear .trigger build cache
pnpm dev:all          # predev:all kills stale next/trigger processes first
```

**Root cause:** Only one `pnpm dev:all` may run at a time. A second instance hits the Next.js dev lock; `concurrently --kill-others-on-fail` then SIGTERM-kills the Trigger worker while the API keeps queuing runs that never execute. Inbound/outbound handlers require Trigger — there is no inline fallback.

Stuck runs block dev concurrency. Also check Trigger dashboard for runs stuck in `EXECUTING`. After frequent code edits, worker version churn (e.g. `20260521.6` → `.7`) can leave old runs pending — cancel them and restart.

### Key gotchas

- **Docker in cloud VM**: Requires `fuse-overlayfs` storage driver and `iptables-legacy`. `/etc/docker/daemon.json` should include `{"storage-driver": "fuse-overlayfs"}`.
- **Supabase stale state**: `supabase start` may report “already running” while DB container exited → `pnpm db:stop && pnpm db:start`.
- **Supabase keys format**: CLI may show short keys (`sb_publishable_*`, `sb_secret_*`). This app uses JWT keys from `pnpm db:env` (`ANON_KEY` / `SERVICE_ROLE_KEY` in `supabase status -o json`).
- **Nothing on :3000** → tunnel returns **502**; health URL fails publicly even if tunnel is up.
- **`ticqex-dev` not running** → **1033/530** from Cloudflare.
- **esbuild build scripts**: pnpm ignores esbuild postinstall by default; `tsx` seed scripts still work.
- **Admin credentials**: `admin@ticqex.local` / `ticqex-admin-change-me` via `pnpm db:seed-admin`.
- **Resend webhook 401**: Check `RESEND_INBOUND_WEBHOOK_SECRET` matches the signing secret on the Resend webhook; verification must use Svix headers, not raw HMAC.

### Standard commands

`pnpm lint`, `pnpm build`, `pnpm dev`, `pnpm dev:all`, `pnpm db:start`, `pnpm db:stop`, `pnpm db:reset`, `pnpm db:env`, `pnpm db:seed-admin`, `pnpm trigger:login`, `pnpm trigger:create`, `pnpm trigger:env`, `pnpm trigger:dev`, `pnpm trigger:clean`, `pnpm trigger:smoke`.
