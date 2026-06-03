"use client";

import type { SettingsSectionDescriptor } from "@shared/settings/types";
import { resolveSettingsSectionComponent } from "@/components/settings/settings-section-registry";

type ApiKey = {
  id: string;
  name: string;
  key_prefix: string;
  created_at: string;
};

export type SettingsSectionContentProps = {
  section: SettingsSectionDescriptor;
  settings: {
    email_signature?: string;
  } | null;
  apiKeys: ApiKey[];
  newKey: string | null;
  onNewKey: (key: string) => void;
  onReload: () => void;
  onCopyNewKey: () => void;
  onError: (message: string | null) => void;
};

export function SettingsSectionContent(props: SettingsSectionContentProps) {
  const Section = resolveSettingsSectionComponent(props.section.componentKey);
  if (!Section) {
    return (
      <p className="text-sm text-muted-foreground">
        This settings section is not available in this build.
      </p>
    );
  }
  return <Section {...props} />;
}
