# @ticqex/cli

Command-line interface for the Ticqex REST API (`/api/v1`).

Full request schemas: [`docs/openapi.yaml`](../../docs/openapi.yaml) in the repo root (regenerate with `pnpm openapi:generate`).

## Install

From the monorepo:

```bash
pnpm --filter @ticqex/cli build
node packages/cli/dist/main.js --help
```

For other local monorepo commands, replace `ticqex` with
`node packages/cli/dist/main.js`.

When published to npm:

```bash
pnpm dlx @ticqex/cli --help
```

## Authentication

```bash
ticqex auth login --instance https://your-instance.example.com
ticqex auth status
ticqex auth logout
```

Credentials are stored in `~/.config/ticqex/config.json` (or `$XDG_CONFIG_HOME/ticqex/config.json`).

Precedence: CLI flags (`--instance`, `--api-key`) → env (`TICQEX_INSTANCE`, `TICQEX_API_KEY`) → stored config.

## Usage

Execute any MCP-parity operation by name:

```bash
ticqex call ticqex_get_me
ticqex call ticqex_list_tickets --input '{"page":1,"per_page":20}'
```

Friendly command groups mirror the API:

```bash
ticqex users me
ticqex tickets list --page 1 --per-page 20
ticqex board get
```

Output is JSON on stdout. Errors are JSON on stderr with exit code `1` (API) or `2` (usage).
