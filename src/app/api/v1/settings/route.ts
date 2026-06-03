import { NextRequest } from "next/server";
import { jsonData } from "@server/lib/response";
import { withAuth, parseJsonBody } from "@server/lib/route-handler";
import {
  patchSettingsSchema,
  parseBody,
} from "@server/lib/validation/schemas";
import { getSettings, patchSettings } from "@server/services/settings";
import { loadTicketFieldLayoutContext } from "@server/services/ticket-field-layout";
import { loadTicqexConfig } from "@server/config";
import { collectChannelSettingsSections } from "@server/channels/settings-sections";
import { resolveSettingsSections } from "@shared/settings/resolve";

export async function GET(request: NextRequest) {
  return withAuth(request, async () => {
    const channels = loadTicqexConfig().channels;
    const settings = await getSettings();
    const { layout: ticket_field_layout } = await loadTicketFieldLayoutContext({
      settings,
    });

    return jsonData({
      ...settings,
      channels,
      ticket_field_layout,
      sections: resolveSettingsSections(
        channels,
        collectChannelSettingsSections(),
      ),
    });
  });
}

export async function PATCH(request: NextRequest) {
  return withAuth(
    request,
    async () => {
      const body = parseBody(patchSettingsSchema, await parseJsonBody(request));
      const settings = await patchSettings(body);
      const { layout: ticket_field_layout } = await loadTicketFieldLayoutContext({
        settings,
      });
      return jsonData({ ...settings, ticket_field_layout });
    },
    { admin: true },
  );
}
