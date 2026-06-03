import type { ChannelKey } from "@shared/ticqex-keys";

/** Client registry keys for section renderers (see settings-section-content). */
export const SETTINGS_COMPONENT_KEYS = [
  "settings.appearance",
  "settings.api-mcp",
  "settings.board",
  "settings.custom-fields",
  "settings.email",
] as const;

/** Known renderer keys shipped in the admin UI (see settings-section-registry). */
export type SettingsComponentKey = (typeof SETTINGS_COMPONENT_KEYS)[number];

export function isKnownSettingsComponentKey(
  key: string,
): key is SettingsComponentKey {
  return (SETTINGS_COMPONENT_KEYS as readonly string[]).includes(key);
}

export type SettingsSectionId = string;

/** Serializable settings nav entry; safe to pass over the API. */
export type SettingsSectionDescriptor = {
  id: SettingsSectionId;
  label: string;
  description?: string;
  /** Registry lookup key; unknown keys render a safe fallback in the client. */
  componentKey: string;
  order: number;
  /** When set, section is omitted unless this channel is enabled in config. */
  requiresChannel?: ChannelKey;
};

/** Channel registry meta (requiresChannel is added when collecting sections). */
export type ChannelSettingsSectionMeta = Omit<
  SettingsSectionDescriptor,
  "requiresChannel"
>;
