<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Cursor Cloud specific instructions

### Services overview

| Service | Command | Port | Notes |
|---------|---------|------|-------|
| Next.js dev server | `pnpm dev` | 3000 | App UI + API routes |
| Trigger.dev dev | `pnpm trigger:dev` | — | Background jobs (optional; use with Next via `pnpm dev:all`) |
| Next + Trigger | `pnpm dev:all` | 3000 | Runs Next.js and Trigger.dev together |
| Supabase local | `pnpm db:start` | 54321 (API), 54322 (DB), 54323 (Studio) | Requires Docker |

### Startup sequence

Docker must be running before starting Supabase. Start services in this order:

1. `sudo dockerd &` (if Docker daemon is not already running)
2. `sudo chmod 666 /var/run/docker.sock` (fix socket permissions in cloud VM)
3. `pnpm db:start` — starts Supabase containers (Postgres, Auth, Realtime, Storage, Studio)
4. `pnpm trigger:login` → `pnpm trigger:create` → `pnpm trigger:env` — link Trigger.dev project and sync keys
5. `pnpm dev:all` — starts Next.js (port 3000) and Trigger.dev dev worker together (`pnpm dev` for Next.js only)

### Key gotchas

- **Docker in cloud VM**: Requires `fuse-overlayfs` storage driver and `iptables-legacy`. The daemon.json at `/etc/docker/daemon.json` must have `{"storage-driver": "fuse-overlayfs"}`.
- **Supabase keys format**: Recent Supabase CLI also shows short keys (`sb_publishable_*`, `sb_secret_*`). This app uses JWT keys from `pnpm db:env` (`ANON_KEY` / `SERVICE_ROLE_KEY` in `supabase status -o json`).
- **esbuild build scripts**: pnpm ignores esbuild's postinstall by default. The `tsx` tool still works for seeding without esbuild's native binary since it uses its own bundled engine.
- **Admin credentials**: Default local admin is `admin@ticqex.local` / `ticqex-admin-change-me`. Created via `pnpm db:seed-admin`.
- **Health check**: `GET /api/health` returns `{"status":"ok","checks":{"app":"ok","database":"ok"}}` when both Next.js and Supabase are running.

### Standard commands

See `package.json` scripts: `pnpm lint`, `pnpm build`, `pnpm dev`, `pnpm dev:all`, `pnpm db:start`, `pnpm db:stop`, `pnpm db:reset`, `pnpm db:env`, `pnpm db:seed-admin`, `pnpm trigger:login`, `pnpm trigger:create`, `pnpm trigger:env`, `pnpm trigger:dev`.
