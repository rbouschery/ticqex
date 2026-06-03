import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { loadTicqexConfig } from "@server/config";
import { parseBody, patchSettingsSchema } from "@server/lib/validation/schemas";
import { getSettings, patchSettings } from "@server/services/settings";
import { loadTicketFieldLayout } from "@server/services/ticket-field-layout";
import { registerAuthedTool, toolResult } from "../core";

export function registerSettingsTools(server: McpServer) {
  registerAuthedTool(
    server,
    "ticqex_get_settings",
    {
      title: "Get Settings",
      description:
        "Get global settings, resolved ticket field layout, and configured channel availability.",
      inputSchema: {},
    },
    async () =>
      toolResult({
        ...(await getSettings()),
        channels: loadTicqexConfig().channels,
        ticket_field_layout: await loadTicketFieldLayout(),
      }),
  );

  registerAuthedTool(
    server,
    "ticqex_patch_settings",
    {
      title: "Patch Settings",
      description:
        "Update global settings, including ticket field visibility (`ticket_field_visibility`). Admin only.",
      inputSchema: patchSettingsSchema.shape,
      admin: true,
    },
    async (input) => toolResult(await patchSettings(parseBody(patchSettingsSchema, input))),
  );
}
