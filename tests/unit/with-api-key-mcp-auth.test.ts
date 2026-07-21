import { describe, expect, it, vi } from "vitest";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import type { AuthedRequest } from "@server/mcp/create-handler";
import { withApiKeyMcpAuth } from "@server/mcp/with-api-key-auth";

describe("withApiKeyMcpAuth", () => {
  it("returns 401 without resource_metadata when POST Authorization is missing", async () => {
    const handler = vi.fn(async () => new Response("ok"));
    const wrapped = withApiKeyMcpAuth(handler, async () => undefined);

    const res = await wrapped(
      new Request("https://example.com/api/mcp", { method: "POST" }),
    );

    expect(res.status).toBe(401);
    const www = res.headers.get("WWW-Authenticate") ?? "";
    expect(www).toContain('error="invalid_token"');
    expect(www).not.toContain("resource_metadata");
    expect(handler).not.toHaveBeenCalled();
  });

  it("lets unauthenticated GET reach the handler (SSE probe → 405, not OAuth)", async () => {
    const handler = vi.fn(
      async () =>
        new Response(JSON.stringify({ error: "method not allowed" }), {
          status: 405,
          headers: { Allow: "POST" },
        }),
    );
    const wrapped = withApiKeyMcpAuth(handler, async () => undefined);

    const res = await wrapped(
      new Request("https://example.com/api/mcp", {
        method: "GET",
        headers: { Accept: "text/event-stream" },
      }),
    );

    expect(res.status).toBe(405);
    expect(handler).toHaveBeenCalledOnce();
  });

  it("attaches auth and calls handler for a valid Bearer token on POST", async () => {
    const authInfo: AuthInfo = {
      token: "tq_live_test",
      clientId: "key-1",
      scopes: ["ticqex:read"],
    };
    const handler = vi.fn(async (req: AuthedRequest) => {
      expect(req.auth).toEqual(authInfo);
      return new Response("ok");
    });
    const wrapped = withApiKeyMcpAuth(handler, async (_req, token) =>
      token === "tq_live_test" ? authInfo : undefined,
    );

    const res = await wrapped(
      new Request("https://example.com/api/mcp", {
        method: "POST",
        headers: { Authorization: "Bearer tq_live_test" },
      }),
    );

    expect(res.status).toBe(200);
    expect(handler).toHaveBeenCalledOnce();
  });
});
