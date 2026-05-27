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
| Next.js dev server | `pnpm dev` | 3000 | App UI + API routes + background email via `after()` |
| Supabase local | `pnpm db:start` | 54321 (API), 54322 (DB), 54323 (Studio) | Requires Docker |
| Cloudflare tunnel | `cloudflared tunnel run --token "$CLOUDFLARE_TUNNEL_TOKEN"` | — | Proxies public hostname → `localhost:3000` |

### Secrets: Cursor Cloud

The cloud agent injects secrets into **process.env** (not committed to git). Next.js and scripts read them directly — no file sync step. Inspect names with:

```bash
echo "$CLOUD_AGENT_ALL_SECRET_NAMES"
echo "$CLOUD_AGENT_INJECTED_SECRET_NAMES"
```

Typically provided:

| Variable | In Cursor Cloud | Notes |
|----------|-----------------|-------|
| `RESEND_API_KEY` | Yes | Outbound + Resend API |
| `RESEND_INBOUND_WEBHOOK_SECRET` | Yes | Svix signing secret (`whsec_...`) from Resend webhook details |
| `CLOUDFLARE_TUNNEL_TOKEN` | Yes | Run token for named tunnel `ticqex-dev` |
| `SUPPORT_EMAIL` | Yes | Verified Resend sender |
| `SUPPORT_FROM_NAME` | Yes | |
| `NEXT_PUBLIC_APP_URL` | Yes | Set to `https://readbetter.rbouschery.de` when tunnel is up |
| Supabase keys | **No** | Written by `pnpm db:env` into `.env.local` after `pnpm db:start` (`PUBLISHABLE_KEY` / `SECRET_KEY`) |

Local Supabase keys still go in **`.env.local`** via `pnpm db:env`. Email and tunnel secrets come from Cursor Cloud (or set manually in `.env.local` for non-cloud dev).

After Supabase is up:

```bash
cd /workspace
pnpm db:start          # if not already running
pnpm db:env            # Supabase JWT keys → .env.local
pnpm env:verify        # optional sanity check
```

If `RESEND_INBOUND_WEBHOOK_SECRET` is wrong or missing, copy the **signing secret** from [Resend → Webhooks](https://resend.com/webhooks) (webhook details page) or fetch it via `resend.webhooks.get(id)` using `RESEND_API_KEY`. If you recreate the webhook, update the Cursor Cloud secret to match.

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

# 3. Verify environment (optional)
pnpm db:env
pnpm env:verify
pnpm db:seed-admin

# 4. App
pnpm dev

# 5. Named tunnel (NOT quick tunnel) — separate terminal or background
cloudflared tunnel run --token "$CLOUDFLARE_TUNNEL_TOKEN"
```

Do **not** start a second `pnpm dev` on the same port.

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

Preferred on cloud VMs: set `CLOUDFLARE_TUNNEL_TOKEN` in Cursor Cloud secrets (Cloudflare Zero Trust → **Networks** → **Tunnels** → **ticqex-dev** → copy the **run token**).

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
| Signing secret | → `RESEND_INBOUND_WEBHOOK_SECRET` in Cursor Cloud or `.env.local` |

**Webhook signature verification** uses **Svix**, not a plain HMAC of the body. Resend sends `svix-id`, `svix-timestamp`, and `svix-signature` headers. The app verifies via `resend.webhooks.verify()` in `server/adapters/email/resend.ts`. A wrong secret or incorrect verification algorithm returns `401 {"error":{"code":"unauthorized","message":"Invalid webhook signature"}}`.

Use the **raw request body** (string) when verifying — re-stringifying parsed JSON breaks the signature.

**Metadata-only webhooks:** `email.received` payloads do not include the body. The app calls `resend.emails.receiving.get(email_id)` in `resolveInbound()` before creating the ticket message. Without this, tickets are created with an empty body.

Inbound receiving (MX/domain) must be enabled in Resend separately from the webhook.

### Email architecture (Vercel `after()`)

Async email work runs in the same Next.js process via [`after()`](https://nextjs.org/docs/app/api-reference/functions/after) from `next/server` — no external job runner.

| Direction | Entry | Background work | Notes |
|-----------|-------|-----------------|-------|
| Inbound | `POST /api/webhooks/resend/inbound` | `enqueueInboundEmail()` | Svix verify → `200`; body fetched in `resolveInbound()` |
| Outbound | `POST /api/v1/tickets/:id/messages` (public) | `enqueueOutboundEmail()` | After DB insert; Resend send in background |

Implementation: `server/adapters/email/background.ts`. DB dedupe: `messages.resend_inbound_id`, `messages.email_message_id`.

**Verify delivery in the database** — a webhook `200 {"accepted":true}` means processing was scheduled, not necessarily finished:

| Direction | Success signal |
|-----------|----------------|
| Inbound | New row in `tickets` / `messages`; body populated (not empty) |
| Outbound | `messages.email_message_id` set (e.g. `<uuid@resend.dev>`) |

Errors are logged to the Next.js server console. Resend retries inbound webhooks on non-2xx responses.

### Inbound vs outbound addressing

| Role | Example | Config |
|------|---------|--------|
| Inbound (customers email this address) | `hello@support.readbetter.io` | Resend receiving domain + MX |
| Outbound From | `SUPPORT_EMAIL` in Cursor Cloud (e.g. verified sender on `readbetter.io`) | Resend domain verification |

These are separate Resend settings. Inbound needs receiving enabled; outbound needs a verified sender. Both must match what customers and the app expect.

### Key gotchas

- **Docker in cloud VM**: Requires `fuse-overlayfs` storage driver and `iptables-legacy`. `/etc/docker/daemon.json` should include `{"storage-driver": "fuse-overlayfs"}`.
- **Supabase stale state**: `supabase start` may report “already running” while DB container exited → `pnpm db:stop && pnpm db:start`.
- **Supabase keys format**: Use publishable + secret keys from `pnpm db:env` (`PUBLISHABLE_KEY` / `SECRET_KEY` in `supabase status -o json`). Do not use legacy JWT `ANON_KEY` / `SERVICE_ROLE_KEY`.
- **Nothing on :3000** → tunnel returns **502**; health URL fails publicly even if tunnel is up.
- **`ticqex-dev` not running** → **1033/530** from Cloudflare.
- **esbuild build scripts**: pnpm ignores esbuild postinstall by default; `tsx` seed scripts still work.
- **Admin credentials**: `admin@ticqex.local` / `ticqex-admin-change-me` via `pnpm db:seed-admin`.
- **Resend webhook 401**: Check `RESEND_INBOUND_WEBHOOK_SECRET` matches the signing secret on the Resend webhook; verification must use Svix headers, not raw HMAC.

### Standard commands

`pnpm lint`, `pnpm build`, `pnpm dev`, `pnpm env:verify`, `pnpm db:start`, `pnpm db:stop`, `pnpm db:reset`, `pnpm db:env`, `pnpm db:seed-admin`, `pnpm test:message-reads`.

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

2. **Sync Supabase env** — After reset or first boot:
   ```bash
   pnpm db:env
   pnpm db:seed-admin
   ```

3. **Start the app and health-check** — Use `pnpm dev`. Confirm:
   ```bash
   curl -s http://127.0.0.1:3000/api/health
   ```
   Expect `"database":"ok"`.

   **Restart the dev server yourself** — Do not tell the user to restart. After server-side, API, or config changes (or when Turbopack shows stale parse/build errors), stop and restart locally:
   ```bash
   pnpm dev
   ```
   Then re-run the health check before handing off. Only one `pnpm dev` at a time.

4. **Always test the change** — Verify end-to-end before finishing:
   - Run targeted smoke scripts when they exist (e.g. `pnpm test:message-reads` for read/unread).
   - For UI work, exercise the flow in the browser (login: `admin@ticqex.local` / `ticqex-admin-change-me`).
   - For API-only changes, call the routes with a real JWT (see scripts under `scripts/`).

5. **Report what you ran** — In the PR or final message, state that migrations were applied locally and which tests passed.

Add a focused script under `scripts/test-*.ts` when a feature needs repeatable verification and wire it in `package.json` if it will be reused.
