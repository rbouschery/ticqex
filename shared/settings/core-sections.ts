import type { SettingsSectionDescriptor } from "@shared/settings/types";

/** Admin settings sections owned by the core product (not channels). */
export const CORE_SETTINGS_SECTIONS: readonly SettingsSectionDescriptor[] = [
  {
    id: "appearance",
    label: "Appearance",
    description: "Theme and display preferences for your account.",
    componentKey: "settings.appearance",
    order: 10,
  },
  {
    id: "api-mcp",
    label: "API & MCP",
    description: "Programmatic access and MCP client connection.",
    componentKey: "settings.api-mcp",
    order: 20,
  },
  {
    id: "board",
    label: "Board",
    description: "Kanban columns, tags, lane order, and visibility.",
    componentKey: "settings.board",
    order: 30,
  },
  {
    id: "custom-fields",
    label: "Custom fields",
    description: "Typed metadata fields for tickets and contacts.",
    componentKey: "settings.custom-fields",
    order: 40,
  },
] as const;

export const CORE_ADMIN_SETTINGS_SECTIONS = CORE_SETTINGS_SECTIONS;

/** Sections available to any signed-in user (non-admin). */
export const NON_ADMIN_SETTINGS_SECTIONS: readonly SettingsSectionDescriptor[] =
  [CORE_SETTINGS_SECTIONS[0]];
