import { describe, expect, it } from "vitest";
import { emailSettingsSections } from "@shared/channels/email/settings-sections";
import { getChannelDefinition } from "@server/channels";
import { collectChannelSettingsSections } from "@server/channels/settings-sections";
import { CORE_SETTINGS_SECTIONS } from "@shared/settings/core-sections";
import {
  isKnownSettingsComponentKey,
  SETTINGS_COMPONENT_KEYS,
} from "@shared/settings/types";
import {
  resolveSettingsSectionId,
  resolveSettingsSections,
} from "@shared/settings/resolve";

describe("resolveSettingsSections", () => {
  const channelsDisabled = {
    email: { enabled: false, integration: null },
  } as const;

  const channelsEnabled = {
    email: { enabled: true, integration: "resend" as const },
  } as const;

  it("returns core sections when email is disabled", () => {
    const sections = resolveSettingsSections(
      channelsDisabled,
      collectChannelSettingsSections(),
    );
    expect(sections.map((s) => s.id)).toEqual(
      CORE_SETTINGS_SECTIONS.map((s) => s.id),
    );
    expect(sections.some((s) => s.id === "email")).toBe(false);
  });

  it("appends email section when the channel is enabled", () => {
    const sections = resolveSettingsSections(
      channelsEnabled,
      collectChannelSettingsSections(),
    );
    expect(sections.at(-1)?.id).toBe("email");
    expect(sections.at(-1)?.componentKey).toBe("settings.email");
    expect(sections.at(-1)?.requiresChannel).toBe("email");
  });
});

describe("email channel settings registry", () => {
  it("registers email settings metadata on the channel definition", () => {
    const email = getChannelDefinition("email");
    expect(email?.settings).toEqual({ sections: emailSettingsSections });
  });

  it("collects channel sections with requiresChannel from channel key", () => {
    const collected = collectChannelSettingsSections();
    expect(collected).toHaveLength(1);
    expect(collected[0]).toMatchObject({
      id: "email",
      componentKey: "settings.email",
      requiresChannel: "email",
    });
  });
});

describe("isKnownSettingsComponentKey", () => {
  it("recognizes shipped renderer keys", () => {
    for (const key of SETTINGS_COMPONENT_KEYS) {
      expect(isKnownSettingsComponentKey(key)).toBe(true);
    }
  });

  it("rejects unknown keys", () => {
    expect(isKnownSettingsComponentKey("settings.unknown")).toBe(false);
  });
});

describe("resolveSettingsSectionId", () => {
  const sections = CORE_SETTINGS_SECTIONS;

  it("falls back to the first section when param is missing", () => {
    expect(resolveSettingsSectionId(sections, null)).toBe("appearance");
  });

  it("falls back when param is invalid", () => {
    expect(resolveSettingsSectionId(sections, "not-a-section")).toBe("appearance");
  });

  it("keeps a valid section id", () => {
    expect(resolveSettingsSectionId(sections, "custom-fields")).toBe(
      "custom-fields",
    );
  });
});
