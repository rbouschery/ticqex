import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import { registerTicqexTools } from "@server/mcp/tools";

export type AuthedRequest = Request & { auth?: AuthInfo };

/**
 * Stateless Streamable HTTP MCP handler.
 *
 * Uses enableJsonResponse so tool calls return application/json instead of
 * text/event-stream. SSE POST bodies work in curl but hang some remote MCP
 * clients (notably Cursor) on serverless hosts.
 */
export function createTicqexMcpHandler() {
  return async (req: AuthedRequest): Promise<Response> => {
    if (req.method === "GET" || req.method === "DELETE") {
      return methodNotAllowed();
    }

    if (req.method !== "POST") {
      return methodNotAllowed();
    }

    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });

    const server = new McpServer({
      name: "ticqex",
      version: "0.1.0",
    });
    registerTicqexTools(server);
    await server.connect(transport);

    return transport.handleRequest(req, { authInfo: req.auth });
  };
}

function methodNotAllowed(): Response {
  return new Response(
    JSON.stringify({
      jsonrpc: "2.0",
      error: {
        code: -32000,
        message: "Method not allowed.",
      },
      id: null,
    }),
    {
      status: 405,
      headers: {
        Allow: "POST",
        "Content-Type": "application/json",
      },
    },
  );
}
