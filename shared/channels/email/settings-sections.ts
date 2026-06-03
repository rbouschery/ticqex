import type { ChannelSettingsSectionMeta } from "@shared/settings/types";

export const emailSettingsSections: readonly ChannelSettingsSectionMeta[] = [
  {
    id: "email",
    label: "Email",
    description:
      "Thread order, inbound ticket status, signatures, and reply snippets.",
    componentKey: "settings.email",
    order: 50,
  },
] as const;
