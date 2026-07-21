import { afterEach, expect } from "vitest";
import { createApiKey, revokeApiKey } from "@server/services/api-keys";
import {
  requireSupabaseEnv,
  resolveLocalAppUrl,
  signInAsSeedAdmin,
} from "../helpers/integration";

const LOCAL_APP_URL = resolveLocalAppUrl();

const describeMcp = describe.skipIf(
  !requireSupabaseEnv() || process.env.SKIP_MCP_INTEGRATION === "1",
);

type McpResponse<T> = {
  jsonrpc: "2.0";
  id: number;
  result?: T;
  error?: { code: number; message: string };
};

function parseMcpResponse<T>(raw: string): McpResponse<T> {
  const dataLine = raw.split("\n").find((line) => line.startsWith("data: "));
  const json = dataLine ? dataLine.slice("data: ".length) : raw;
  return JSON.parse(json) as McpResponse<T>;
}

async function mcp<T>(apiKey: string, id: number, method: string, params = {}) {
  const res = await fetch(`${LOCAL_APP_URL}/api/mcp`, {
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
  const contentType = res.headers.get("content-type") ?? "";
  expect(contentType).toContain("application/json");
  expect(contentType).not.toContain("text/event-stream");
  const json = parseMcpResponse<T>(text);
  if (json.error) {
    throw new Error(`MCP ${method} failed: ${json.error.message}`);
  }
  return json.result as T;
}

describeMcp("MCP route", () => {
  let apiKeyId: string | undefined;

  afterEach(async () => {
    if (apiKeyId) await revokeApiKey(apiKeyId);
  });

  it("initializes, lists tools, and returns structured get_me", async () => {
    const health = await fetch(`${LOCAL_APP_URL}/api/health`).then((r) => r.json());
    if (health.checks?.database !== "ok") {
      throw new Error(
        `Dev server health check failed (${LOCAL_APP_URL}): ${JSON.stringify(health)}`,
      );
    }

    const { userId } = await signInAsSeedAdmin();
    const created = await createApiKey("MCP integration test", userId);
    apiKeyId = created.id;

    await mcp(created.key, 1, "initialize", {
      protocolVersion: "2025-03-26",
      capabilities: {},
      clientInfo: { name: "ticqex-vitest", version: "0.1.0" },
    });

    const tools = await mcp<{ tools: { name: string }[] }>(
      created.key,
      2,
      "tools/list",
    );
    expect(tools.tools.some((tool) => tool.name === "ticqex_list_tickets")).toBe(
      true,
    );

    const forbiddenTools = new Set([
      "ticqex_list_api_keys",
      "ticqex_create_api_key",
      "ticqex_revoke_api_key",
    ]);
    const exposedForbiddenTools = tools.tools
      .map((tool) => tool.name)
      .filter((name) => forbiddenTools.has(name));
    expect(exposedForbiddenTools).toHaveLength(0);

    const me = await mcp<{ structuredContent?: unknown }>(created.key, 3, "tools/call", {
      name: "ticqex_get_me",
      arguments: {},
    });
    expect(me.structuredContent).toBeDefined();
  });
});
