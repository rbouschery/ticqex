# @ticqex/api-client

TypeScript client for headless access to the [Ticqex](https://github.com/rbouschery/ticqex) REST API (`/api/v1`).

## Install

```bash
pnpm add @ticqex/api-client
```

## Quickstart

```typescript
import { TicqexClient } from "@ticqex/api-client";

const client = new TicqexClient({
  baseUrl: "https://your-instance.example.com",
  apiKey: process.env.TICQEX_API_KEY!,
});

const ticket = await client.get<{ id: string }>("/tickets/550e8400-e29b-41d4-a716-446655440000");

const created = await client.post("/tickets", {
  subject: "Login issue",
  contact_email: "user@example.com",
});

const tickets = await client.get("/tickets", { page: 1, per_page: 25 });
```

Create API keys in Ticqex under **Settings → API & MCP**. Use the same key for REST, MCP, the CLI, and this client when running Ticqex headlessly.

## API

- `get(path, query?)`, `post(path, body?)`, `patch(path, body?)`, `put(path, body?)`, `delete(path, body?)`
- `request({ method, path, query?, body? })` for full control
- Paths are relative to `/api/v1` (e.g. `/tickets`, not `/api/v1/tickets`)
- `baseUrl` may include or omit a trailing slash and `/api/v1` suffix; both are normalized
- Errors throw `TicqexApiError` with `status`, `code`, and `message`

## Error handling

```typescript
import { TicqexApiError, TicqexClient } from "@ticqex/api-client";

const client = new TicqexClient({
  baseUrl: "https://your-instance.example.com",
  apiKey: process.env.TICQEX_API_KEY!,
});

try {
  await client.post("/tickets", { subject: "Missing contact" });
} catch (error) {
  if (error instanceof TicqexApiError) {
    console.error(error.status, error.code, error.message);
  }
}
```

## Common calls

```typescript
await client.get("/users/me");
await client.get("/board");
await client.get("/tickets", { page: 1, per_page: 25 });
await client.post("/tickets", {
  subject: "Login issue",
  contact_email: "user@example.com",
});
await client.patch("/tickets/<ticket-id>", {
  status_id: "<status-id>",
});
```

## Requirements

Node.js 20+ (uses native `fetch`).

## Development

```bash
pnpm build
pnpm test
```
