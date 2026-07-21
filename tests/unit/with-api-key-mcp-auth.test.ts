import { describe, expect, it, vi } from "vitest";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import { withApiKeyMcpAuth } from "@server/mcp/with-api-key-auth";

describe("withApiKeyMcpAuth", () => {
  it("returns 401 without resource_metadata when Authorization is missing", async () => {
    const handler = vi.fn(async () => new Response("ok"));
    const wrapped = withApiKeyMcpAuth(handler, async () => undefined);

    const res = await wrapped(new Request("https://example.com/api/mcp"));

    expect(res.status).toBe(401);
    const www = res.headers.get("WWW-Authenticate") ?? "";
    expect(www).toContain('error="invalid_token"');
    expect(www).not.toContain("resource_metadata");
    expect(handler).not.toHaveBeenCalled();
  });

  it("attaches auth and calls handler for a valid Bearer token", async () => {
    const authInfo: AuthInfo = {
      token: "tq_live_test",
      clientId: "key-1",
      scopes: ["ticqex:read"],
    };
    const handler = vi.fn(async (req: Request) => {
      expect(req.auth).toEqual(authInfo);
      return new Response("ok");
    });
    const wrapped = withApiKeyMcpAuth(handler, async (_req, token) =>
      token === "tq_live_test" ? authInfo : undefined,
    );

    const res = await wrapped(
      new Request("https://example.com/api/mcp", {
        headers: { Authorization: "Bearer tq_live_test" },
      }),
    );

    expect(res.status).toBe(200);
    expect(handler).toHaveBeenCalledOnce();
  });
});
