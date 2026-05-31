import { createMcpHandler, withMcpAuth } from "mcp-handler";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import { authenticateApiKeyToken } from "@server/middleware/auth";
import { registerTicqexTools } from "@server/mcp/tools";

export const runtime = "nodejs";

const handler = createMcpHandler(
  (server) => {
    registerTicqexTools(server);
  },
  {
    serverInfo: {
      name: "ticqex",
      version: "0.1.0",
    },
  },
  {
    basePath: "/api",
    disableSse: true,
    maxDuration: 60,
  },
);

async function verifyApiKey(
  _request: Request,
  bearerToken?: string,
): Promise<AuthInfo | undefined> {
  if (!bearerToken) return undefined;

  const auth = await authenticateApiKeyToken(bearerToken);
  if (!auth) return undefined;

  return {
    token: bearerToken,
    clientId: auth.apiKeyId ?? auth.userId,
    scopes:
      auth.role === "admin"
        ? ["ticqex:read", "ticqex:write", "ticqex:admin"]
        : ["ticqex:read", "ticqex:write"],
    extra: auth,
  };
}

const authHandler = withMcpAuth(handler, verifyApiKey, {
  required: true,
});

export { authHandler as DELETE, authHandler as GET, authHandler as POST };
