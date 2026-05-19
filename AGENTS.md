<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Cursor Cloud specific instructions

### Services overview

| Service | Command | Port | Notes |
|---------|---------|------|-------|
| Next.js dev server | `pnpm dev` | 3000 | App UI + API routes |
| Supabase local | `pnpm db:start` | 54321 (API), 54322 (DB), 54323 (Studio) | Requires Docker |

### Startup sequence

Docker must be running before starting Supabase. Start services in this order:

1. `sudo dockerd &` (if Docker daemon is not already running)
2. `sudo chmod 666 /var/run/docker.sock` (fix socket permissions in cloud VM)
3. `pnpm db:start` — starts Supabase containers (Postgres, Auth, Realtime, Storage, Studio)
4. `pnpm dev` — starts Next.js dev server on port 3000

### Key gotchas

- **Docker in cloud VM**: Requires `fuse-overlayfs` storage driver and `iptables-legacy`. The daemon.json at `/etc/docker/daemon.json` must have `{"storage-driver": "fuse-overlayfs"}`.
- **Supabase keys format**: Recent Supabase CLI uses short keys (e.g. `sb_publishable_*`, `sb_secret_*`) rather than long JWT tokens. Get them from `pnpm supabase status`.
- **esbuild build scripts**: pnpm ignores esbuild's postinstall by default. The `tsx` tool still works for seeding without esbuild's native binary since it uses its own bundled engine.
- **Admin credentials**: Default local admin is `admin@ticqex.local` / `ticqex-admin-change-me`. Created via `pnpm db:seed-admin`.
- **Health check**: `GET /api/health` returns `{"status":"ok","checks":{"app":"ok","database":"ok"}}` when both Next.js and Supabase are running.

### Standard commands

See `package.json` scripts: `pnpm lint`, `pnpm build`, `pnpm dev`, `pnpm db:start`, `pnpm db:stop`, `pnpm db:reset`, `pnpm db:seed-admin`.
