# @ticqex/cli

Headless command-line interface for the Ticqex REST API (`/api/v1`).

Full request schemas: [`docs/openapi.yaml`](../../docs/openapi.yaml) in the repo root (regenerate with `pnpm openapi:generate`).

## Install

From npm:

```bash
pnpm dlx @ticqex/cli --help
```

If you prefer a project dependency:

```bash
pnpm add -D @ticqex/cli
pnpm exec ticqex --help
```

From the monorepo:

```bash
pnpm --filter @ticqex/cli... build
node packages/cli/dist/main.js --help
```

For other local monorepo commands, replace `ticqex` with
`node packages/cli/dist/main.js`.

## Authentication

```bash
ticqex auth login --instance https://your-instance.example.com
ticqex auth status
ticqex auth logout
```

Credentials are stored in `~/.config/ticqex/config.json` (or `$XDG_CONFIG_HOME/ticqex/config.json`).

Precedence: CLI flags (`--instance`, `--api-key`) → env (`TICQEX_INSTANCE`, `TICQEX_API_KEY`) → stored config.

Create API keys in Ticqex under **Settings → API & MCP**. `auth login` prompts for the key after you pass `--instance`.

## Usage

Execute any MCP-parity operation by name from a shell, script, or agent runtime:

```bash
ticqex call ticqex_get_me
ticqex call ticqex_list_tickets --input '{"page":1,"per_page":20}'
ticqex call ticqex_create_ticket --input '{"subject":"Login issue","contact_email":"user@example.com"}'
```

Friendly command groups mirror the API:

```bash
ticqex users me
ticqex tickets list --page 1 --per-page 20
ticqex board get
ticqex board move-ticket --input '{"ticket_id":"<uuid>","status_id":"<uuid>"}'
```

Output is JSON on stdout. Errors are JSON on stderr with exit code `1` (API) or `2` (usage).

## Notes

- The CLI talks to `/api/v1` on your Ticqex instance.
- `@ticqex/api-client` is a runtime dependency.
- `@ticqex/api-spec` is bundled into the CLI build and is not required at install time.
