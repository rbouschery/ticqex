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
| Next + Trigger + watchdog | `pnpm dev:all` | 3000 | **Use this.** One instance only. |
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

Next.js and scripts expect **`.env.local`** (gitignored). Sync everything in one step after Supabase is up:

```bash
cd /workspace
pnpm db:start          # if not already running
pnpm env:sync          # db:env + harness merge + trigger CLI config + trigger:env
pnpm env:verify        # optional sanity check
```

`pnpm env:sync` runs:
1. `pnpm db:env` — Supabase JWT keys into `.env.local`
2. `scripts/sync-cloud-env.ts` — merges harness secrets + writes `~/.config/trigger/config.json` from `TRIGGER_ACCESS_TOKEN`
3. `pnpm trigger:env` — refreshes `TRIGGER_SECRET_KEY` in `.env.local`

Harness keys merged when present in `process.env`: `RESEND_API_KEY`, `RESEND_INBOUND_WEBHOOK_SECRET`, `SUPPORT_EMAIL`, `SUPPORT_FROM_NAME`, `TRIGGER_PROJECT_REF`, `TRIGGER_SECRET_KEY`, `NEXT_PUBLIC_APP_URL`.

Manual merge (if not using `pnpm env:sync`):

```bash
tsx scripts/sync-cloud-env.ts
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

# 3. Environment
pnpm env:sync
pnpm db:seed-admin

# 4. App (single instance — predev:all cleans stale processes + stuck Trigger runs)
pnpm dev:all

# 5. Named tunnel (NOT quick tunnel) — separate terminal or background
cloudflared tunnel run --token "$CLOUDFLARE_TUNNEL_TOKEN"
```

Do **not** start a second `pnpm dev:all`. A stale Next.js lock causes `concurrently --kill-others-on-fail` to kill the Trigger worker while webhooks keep queuing runs that never execute.

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

**Browser testing:** Open the app at `http://localhost:3000`, not `http://127.0.0.1:3000`. Next.js dev mode treats these as different origins; client JS and HMR can fail on `127.0.0.1` unless `allowedDevOrigins` is configured (already set in `next.config.ts`).

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

### Email architecture (Trigger-only)

All email processing goes through Trigger.dev — **no inline fallback** in API routes.

| Direction | Entry | Trigger task | Notes |
|-----------|-------|--------------|-------|
| Inbound | `POST /api/webhooks/resend/inbound` | `process-inbound-email` | Svix verify → queue; body fetched in task via `resolveInbound()` |
| Outbound | `POST /api/v1/tickets/:id/messages` (public) | `send-outbound-email` | After DB insert; Resend send in task |

Idempotency keys: `inbound:resend:{email_id}`, `outbound:message:{messageId}`. DB dedupe: `messages.resend_inbound_id`, `messages.email_message_id`.

Missing `TRIGGER_SECRET_KEY` → inbound returns **503**, outbound throws.

### Trigger.dev

| Command | Purpose |
|---------|---------|
| `pnpm dev:all` | Next.js + `trigger:dev` + stuck-run watchdog |
| `pnpm env:sync` | Supabase + harness + Trigger CLI + dev secret key |
| `pnpm trigger:clean` | Cancel stuck runs + clear `.trigger` cache |
| `pnpm trigger:smoke` | End-to-end inbound task health check |
| `pnpm trigger:watchdog` | Auto-recovery (also runs inside `dev:all`) |

| Auth | When |
|------|------|
| `TRIGGER_SECRET_KEY` in `.env.local` | App queues tasks via SDK |
| `TRIGGER_ACCESS_TOKEN` → `~/.config/trigger/config.json` | Non-interactive `trigger dev` (via `pnpm env:sync`) |
| `pnpm trigger:login` | Interactive fallback |

`pnpm trigger:dev` loads `.env.local`, `--max-concurrent-runs 10`.

**Stuck runs (`DEQUEUED` / `QUEUED`) — inbound or outbound not appearing:**

```bash
pnpm trigger:clean
pnpm dev:all
pnpm trigger:smoke     # inbound ok:true within ~10s
pnpm env:verify
```

**Root causes:**
- Only **one** `pnpm dev:all` at a time (see startup sequence).
- Local Trigger worker occasionally misses dispatch; runs orphan in `DEQUEUED`.
- `predev:all` kills stale processes and cancels stuck runs on startup.

**Watchdog** (`scripts/trigger-stuck-watchdog.ts`, runs in `dev:all`): every 15s, finds email tasks stuck 20s+ in `DEQUEUED`/`QUEUED`, **re-triggers first** (uses `runs.retrieve` for payload — `runs.list` omits it), then cancels the stuck run best-effort. DB dedupe prevents double sends on outbound recovery.

After code edits, worker version churn (e.g. `20260521.10` → `.11`) can leave old runs pending — `pnpm trigger:clean` and restart.

Recovery is not instant — the watchdog polls every 15s and only acts on runs stuck 20s+. If email still missing after ~1 minute, run `pnpm trigger:clean && pnpm dev:all`.

**Manual replay** (when watchdog or a single run still fails): cancel the stuck run (`pnpm trigger:clean` or Trigger dashboard), then re-trigger with a **new idempotency suffix** (e.g. `inbound:resend:{email_id}:replay1`). Re-using the same idempotency key after cancel returns the cancelled run instead of executing again.

**Verify delivery in the database** — a webhook `200 {"accepted":true,"queued":true}` only means the Trigger task was queued, not that processing finished:

| Direction | Success signal |
|-----------|----------------|
| Inbound | New row in `tickets` / `messages`; body populated (not empty) |
| Outbound | `messages.email_message_id` set (e.g. `<uuid@resend.dev>`) |

**Debugging runs:** In the Trigger dashboard, filter by task `process-inbound-email` or `send-outbound-email`. Status `DEQUEUED` means the local worker did not pick up the run. Worker logs appear as `[trigger]` lines in the `pnpm dev:all` terminal.

### Inbound vs outbound addressing

| Role | Example | Config |
|------|---------|--------|
| Inbound (customers email this address) | `hello@support.readbetter.io` | Resend receiving domain + MX |
| Outbound From | `SUPPORT_EMAIL` in harness (e.g. verified sender on `readbetter.io`) | Resend domain verification |

These are separate Resend settings. Inbound needs receiving enabled; outbound needs a verified sender. Both must match what customers and the app expect.

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

`pnpm lint`, `pnpm build`, `pnpm dev`, `pnpm dev:all`, `pnpm env:sync`, `pnpm env:verify`, `pnpm db:start`, `pnpm db:stop`, `pnpm db:reset`, `pnpm db:env`, `pnpm db:seed-admin`, `pnpm trigger:login`, `pnpm trigger:create`, `pnpm trigger:env`, `pnpm trigger:dev`, `pnpm trigger:clean`, `pnpm trigger:smoke`, `pnpm trigger:watchdog`, `pnpm test:message-reads`.

### Agent workflow: finish work locally

When implementing features in this cloud VM, **be proactive** — do not stop at code + PR. Before handing off:

1. **Apply migrations locally (local only)** — After adding or changing files under `supabase/migrations/`, apply them to the **local** Supabase instance only:
   ```bash
   pnpm db:reset          # clean apply of all migrations + seed
   # or, if DB is already up and you only need pending migrations:
   pnpm db:start          # applies new migrations on start when possible
   ```
   **Never** run migrations against production or a remote Supabase project from the agent. Local DB is `127.0.0.1:54322`.

   If `db:reset` fails on container restart, run `pnpm db:stop && pnpm db:start`. Confirm the new schema exists (e.g. `docker exec supabase_db_ticqex psql -U postgres -c '\d public.<table>'`).

2. **Sync environment** — After reset or first boot:
   ```bash
   pnpm env:sync
   pnpm db:seed-admin
   ```

3. **Start the app and health-check** — Use `pnpm dev` (UI/API only) or `pnpm dev:all` (email/Trigger flows). Confirm:
   ```bash
   curl -s http://127.0.0.1:3000/api/health
   ```
   Expect `"database":"ok"`.

4. **Always test the change** — Verify end-to-end before finishing:
   - Run targeted smoke scripts when they exist (e.g. `pnpm test:message-reads` for read/unread).
   - For UI work, exercise the flow in the browser (login: `admin@ticqex.local` / `ticqex-admin-change-me`).
   - For API-only changes, call the routes with a real JWT (see scripts under `scripts/`).

5. **Report what you ran** — In the PR or final message, state that migrations were applied locally and which tests passed.

Add a focused script under `scripts/test-*.ts` when a feature needs repeatable verification and wire it in `package.json` if it will be reused.
