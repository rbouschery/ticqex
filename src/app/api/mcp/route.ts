import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import { authenticateApiKeyToken } from "@server/middleware/auth";
import { createTicqexMcpHandler } from "@server/mcp/create-handler";
import { withApiKeyMcpAuth } from "@server/mcp/with-api-key-auth";
import { recordFailedAuthActivity } from "@server/services/activity";

export const runtime = "nodejs";
export const maxDuration = 60;

const handler = createTicqexMcpHandler();

async function verifyApiKey(
  _request: Request,
  bearerToken?: string,
): Promise<AuthInfo | undefined> {
  if (!bearerToken) return undefined;

  const auth = await authenticateApiKeyToken(bearerToken);
  if (!auth) {
    const invalidKeyPrefix =
      bearerToken.startsWith("tq_live_") && bearerToken.length >= 12
        ? bearerToken.slice(0, 12)
        : null;
    await recordFailedAuthActivity({
      requestMethod: "POST",
      requestPath: "/api/mcp",
      operation: null,
      statusCode: 401,
      message: "Unauthorized MCP request",
      invalidKeyPrefix,
    });
    return undefined;
  }

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

const authHandler = withApiKeyMcpAuth(handler, verifyApiKey);

export { authHandler as DELETE, authHandler as GET, authHandler as POST };
