import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import type { AuthedRequest } from "@server/mcp/create-handler";

type McpHandler = (req: AuthedRequest) => Response | Promise<Response>;
type VerifyToken = (
  req: Request,
  bearerToken?: string,
) => AuthInfo | undefined | Promise<AuthInfo | undefined>;

/**
 * API-key MCP auth without OAuth Protected Resource Metadata.
 *
 * mcp-handler's withMcpAuth always advertises resource_metadata on 401, which
 * makes Cursor start OAuth discovery. Ticqex MCP is Bearer API key only.
 */
export function withApiKeyMcpAuth(
  handler: McpHandler,
  verifyToken: VerifyToken,
): McpHandler {
  return async (req) => {
    // Streamable HTTP is POST-only. Return 405 for GET/DELETE probes without
    // 401 — MCP clients treat GET 401 as "start OAuth", and GET 405 as
    // "no standalone SSE stream" (expected).
    if (req.method === "GET" || req.method === "DELETE") {
      return handler(req);
    }

    const authHeader = req.headers.get("Authorization");
    const [type, token] = authHeader?.split(" ") ?? [];
    const bearerToken =
      type?.toLowerCase() === "bearer" ? token : undefined;

    let authInfo: AuthInfo | undefined;
    try {
      authInfo = await verifyToken(req, bearerToken);
    } catch (error) {
      console.error("Unexpected error authenticating bearer token:", error);
      return unauthorizedResponse("Invalid token");
    }

    if (!authInfo) {
      return unauthorizedResponse("No authorization provided");
    }

    if (authInfo.expiresAt && authInfo.expiresAt < Date.now() / 1000) {
      return unauthorizedResponse("Token has expired");
    }

    req.auth = authInfo;
    return handler(req);
  };
}

function unauthorizedResponse(description: string): Response {
  return new Response(
    JSON.stringify({
      error: "invalid_token",
      error_description: description,
    }),
    {
      status: 401,
      headers: {
        "Content-Type": "application/json",
        // Bearer challenge only — do not advertise resource_metadata / OAuth.
        "WWW-Authenticate": `Bearer error="invalid_token", error_description="${description}"`,
      },
    },
  );
}
