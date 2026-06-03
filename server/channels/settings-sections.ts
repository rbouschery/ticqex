import type { SettingsSectionDescriptor } from "@shared/settings/types";
import { listChannelDefinitions } from "@server/channels/index";

export function collectChannelSettingsSections(): SettingsSectionDescriptor[] {
  return listChannelDefinitions().flatMap((channel) =>
    (channel.settings?.sections ?? []).map((section) => ({
      ...section,
      order: section.order ?? 0,
      requiresChannel: channel.key,
    })),
  );
}
