import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const BASE =
  process.env.LOCAL_APP_URL ??
  (process.env.NEXT_PUBLIC_APP_URL?.includes("127.0.0.1") ||
  process.env.NEXT_PUBLIC_APP_URL?.includes("localhost")
    ? process.env.NEXT_PUBLIC_APP_URL
    : "http://127.0.0.1:3000");

const email = process.env.SEED_ADMIN_EMAIL ?? "admin@ticqex.local";
const password = process.env.SEED_ADMIN_PASSWORD ?? "ticqex-admin-change-me";

type ApiResponse<T> = { data?: T; error?: { message: string } };
type CreatedApiKey = { id: string; key: string };
type McpResponse<T> = {
  jsonrpc: "2.0";
  id: number;
  result?: T;
  error?: { code: number; message: string };
};

async function api<T>(
  path: string,
  token: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...init?.headers,
    },
  });
  const json = (await res.json()) as ApiResponse<T>;
  if (!res.ok || json.error) {
    throw new Error(json.error?.message ?? `HTTP ${res.status} ${path}`);
  }
  return json.data as T;
}

function parseMcpResponse<T>(raw: string): McpResponse<T> {
  const dataLine = raw
    .split("\n")
    .find((line) => line.startsWith("data: "));
  const json = dataLine ? dataLine.slice("data: ".length) : raw;
  return JSON.parse(json) as McpResponse<T>;
}

async function mcp<T>(apiKey: string, id: number, method: string, params = {}) {
  const res = await fetch(`${BASE}/api/mcp`, {
    method: "POST",
    headers: {
      Accept: "application/json, text/event-stream",
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ jsonrpc: "2.0", id, method, params }),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`MCP ${method} failed with HTTP ${res.status}: ${text}`);
  }
  const json = parseMcpResponse<T>(text);
  if (json.error) {
    throw new Error(`MCP ${method} failed: ${json.error.message}`);
  }
  return json.result as T;
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
  const supabase = createClient(url, publishableKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: auth, error: signInErr } =
    await supabase.auth.signInWithPassword({ email, password });
  if (signInErr || !auth.session?.access_token) {
    throw new Error(signInErr?.message ?? "Admin sign-in failed");
  }

  const token = auth.session.access_token;
  const created = await api<CreatedApiKey>("/api/v1/api-keys", token, {
    method: "POST",
    body: JSON.stringify({ name: "MCP smoke test" }),
  });

  try {
    await mcp(created.key, 1, "initialize", {
      protocolVersion: "2025-03-26",
      capabilities: {},
      clientInfo: { name: "ticqex-smoke", version: "0.1.0" },
    });

    const tools = await mcp<{ tools: { name: string }[] }>(
      created.key,
      2,
      "tools/list",
    );
    if (!tools.tools.some((tool) => tool.name === "ticqex_list_tickets")) {
      throw new Error("Expected ticqex_list_tickets in MCP tools/list");
    }
    const forbiddenTools = new Set([
      "ticqex_list_api_keys",
      "ticqex_create_api_key",
      "ticqex_revoke_api_key",
    ]);
    const exposedForbiddenTools = tools.tools
      .map((tool) => tool.name)
      .filter((name) => forbiddenTools.has(name));
    if (exposedForbiddenTools.length > 0) {
      throw new Error(
        `MCP tools/list exposed API-key management tools: ${exposedForbiddenTools.join(", ")}`,
      );
    }

    const me = await mcp<{ content: unknown[]; structuredContent?: unknown }>(
      created.key,
      3,
      "tools/call",
      {
        name: "ticqex_get_me",
        arguments: {},
      },
    );
    if (!me.structuredContent) {
      throw new Error("Expected structured content from ticqex_get_me");
    }

    console.log(
      `MCP smoke passed (${tools.tools.length} tools, endpoint ${BASE}/api/mcp)`,
    );
  } finally {
    await api(`/api/v1/api-keys/${created.id}`, token, { method: "DELETE" });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
