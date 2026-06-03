"use client";

import type { ComponentType } from "react";
import type { SettingsSectionContentProps } from "@/components/settings/settings-section-content";
import { AppearanceSettingsSection } from "@/components/settings/sections/appearance-section";
import { ApiMcpSettingsSection } from "@/components/settings/sections/api-mcp-section";
import { BoardSettingsSection } from "@/components/settings/sections/board-section";
import { CustomFieldsSettingsSection } from "@/components/settings/sections/custom-fields-section";
import { EmailSettingsSection } from "@/components/settings/sections/email-section";

const SETTINGS_SECTION_COMPONENTS: Record<
  string,
  ComponentType<SettingsSectionContentProps>
> = {
  "settings.appearance": function AppearanceSectionContent() {
    return <AppearanceSettingsSection />;
  },
  "settings.api-mcp": function ApiMcpSectionContent(props) {
    return (
      <ApiMcpSettingsSection
        apiKeys={props.apiKeys}
        newKey={props.newKey}
        onNewKey={props.onNewKey}
        onReload={props.onReload}
        onCopyNewKey={props.onCopyNewKey}
        onError={props.onError}
      />
    );
  },
  "settings.board": function BoardSectionContent() {
    return <BoardSettingsSection />;
  },
  "settings.custom-fields": function CustomFieldsSectionContent() {
    return <CustomFieldsSettingsSection />;
  },
  "settings.email": function EmailSectionContent(props) {
    return (
      <EmailSettingsSection
        emailSignature={props.settings?.email_signature ?? ""}
        onSignatureSaved={props.onReload}
      />
    );
  },
};

export function resolveSettingsSectionComponent(
  componentKey: string,
): ComponentType<SettingsSectionContentProps> | null {
  return SETTINGS_SECTION_COMPONENTS[componentKey] ?? null;
}
