"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";

type ClientId = "cursor" | "codex" | "claude-code";

type ClientExample = {
  id: ClientId;
  name: string;
  description: string;
  filename: string;
  config: string;
};

const PLACEHOLDER_API_KEY = "tq_live_your_api_key_here";

function ClientLogo({ id }: { id: ClientId }) {
  const srcByClient: Record<ClientId, string> = {
    cursor: "/mcp-icons/cursor.ico",
    codex: "/mcp-icons/codex.svg",
    "claude-code": "/mcp-icons/claude.svg",
  };
  return (
    <span
      aria-hidden="true"
      className="size-6 rounded-md bg-contain bg-center bg-no-repeat"
      style={{ backgroundImage: `url(${srcByClient[id]})` }}
    />
  );
}

export function McpSettingsSection() {
  const [origin, setOrigin] = useState("");
  const [selectedClientId, setSelectedClientId] =
    useState<ClientId>("cursor");

  const endpoint = `${origin || "https://your-ticqex-app.vercel.app"}/api/mcp`;

  const clientExamples = useMemo<ClientExample[]>(
    () =>
      [
        {
          id: "cursor",
          name: "Cursor",
          description: "Remote Streamable HTTP MCP server in mcp.json.",
          filename: "mcp.json",
          config: JSON.stringify(
            {
              mcpServers: {
                ticqex: {
                  url: endpoint,
                  headers: {
                    Authorization: `Bearer ${PLACEHOLDER_API_KEY}`,
                  },
                },
              },
            },
            null,
            2,
          ),
        },
        {
          id: "codex",
          name: "Codex",
          description: "Stdio bridge for remote MCP in Codex config.",
          filename: "~/.codex/config.toml",
          config: `# ~/.codex/config.toml
[mcp_servers.ticqex]
command = "npx"
args = [
  "-y",
  "mcp-remote",
  "${endpoint}",
  "--header",
  "Authorization: Bearer ${PLACEHOLDER_API_KEY}"
]`,
        },
        {
          id: "claude-code",
          name: "Claude Code",
          description: "Add Ticqex as a remote HTTP MCP server.",
          filename: "terminal",
          config: `claude mcp add --transport http ticqex "${endpoint}" \\
  --header "Authorization: Bearer ${PLACEHOLDER_API_KEY}"`,
        },
      ],
    [endpoint],
  );

  const selectedExample =
    clientExamples.find((example) => example.id === selectedClientId) ??
    clientExamples[0]!;

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reflect current deployment URL in generated client config
    setOrigin(window.location.origin);
  }, []);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Endpoint</CardTitle>
          <CardDescription>
            Use Streamable HTTP directly, or bridge to stdio when a client does
            not support remote MCP servers yet.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <code className="block rounded-md bg-muted p-3 font-mono text-xs">
            {endpoint}
          </code>
          <p className="text-sm text-muted-foreground">
            The MCP server exposes the same core operations as the Ticqex API:
            tickets, board, customers, settings, tags, statuses, custom fields,
            snippets, users, and API keys.
            Create or copy an API key from the API keys section above, then use
            it as the bearer token in your MCP client.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Client example</CardTitle>
          <CardDescription>
            Pick the host you use and paste the generated example into its MCP
            configuration. Replace the placeholder bearer token with a key from
            the API keys section above.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <ClientLogo id={selectedExample.id} />
              <div>
                <p className="text-sm font-medium">{selectedExample.name}</p>
                <p className="text-xs text-muted-foreground">
                  {selectedExample.description}
                </p>
              </div>
            </div>
            <Select
              value={selectedClientId}
              onValueChange={(value) => setSelectedClientId(value as ClientId)}
            >
              <SelectTrigger className="w-full sm:w-48">
                <span className="flex items-center gap-2">
                  <ClientLogo id={selectedExample.id} />
                  {selectedExample.name}
                </span>
              </SelectTrigger>
              <SelectContent align="end" position="popper">
                {clientExamples.map((example) => (
                  <SelectItem key={example.id} value={example.id}>
                    <span className="flex items-center gap-2">
                      <ClientLogo id={example.id} />
                      {example.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            <span>{selectedExample.filename}</span>
            <span>Bearer API key</span>
          </div>
          <pre className="overflow-x-auto rounded-md bg-muted p-3 text-xs">
            <code>{selectedExample.config}</code>
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}
