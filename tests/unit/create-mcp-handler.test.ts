import { describe, expect, it } from "vitest";
import { createTicqexMcpHandler } from "@server/mcp/create-handler";

describe("createTicqexMcpHandler", () => {
  it("returns 405 JSON for GET without requiring a session", async () => {
    const handler = createTicqexMcpHandler();
    const res = await handler(
      new Request("https://example.com/api/mcp", {
        method: "GET",
        headers: { Accept: "text/event-stream" },
      }),
    );

    expect(res.status).toBe(405);
    expect(res.headers.get("Allow")).toBe("POST");
    expect(res.headers.get("Content-Type")).toContain("application/json");
    const body = await res.json();
    expect(body.error.message).toBe("Method not allowed.");
  });
});
