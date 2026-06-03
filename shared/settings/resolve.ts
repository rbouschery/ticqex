import type { TicqexConfig } from "@shared/ticqex-config/types";
import { CORE_SETTINGS_SECTIONS } from "./core-sections";
import type { SettingsSectionDescriptor, SettingsSectionId } from "./types";

export function isSettingsSectionId(
  value: string | null | undefined,
): value is SettingsSectionId {
  return typeof value === "string" && value.length > 0;
}

export function resolveSettingsSections(
  channels: TicqexConfig["channels"],
  channelSections: readonly SettingsSectionDescriptor[] = [],
): SettingsSectionDescriptor[] {
  const merged: SettingsSectionDescriptor[] = [
    ...CORE_SETTINGS_SECTIONS,
    ...channelSections,
  ];

  return merged
    .filter((section) => {
      if (!section.requiresChannel) return true;
      const binding = channels[section.requiresChannel];
      return binding?.enabled === true;
    })
    .sort((a, b) => a.order - b.order);
}

export function resolveSettingsSectionId(
  sections: readonly SettingsSectionDescriptor[],
  requested: string | null | undefined,
): SettingsSectionId {
  if (
    isSettingsSectionId(requested) &&
    sections.some((section) => section.id === requested)
  ) {
    return requested;
  }
  return sections[0]?.id ?? "appearance";
}
