import { describe, expect, it } from "vitest";
import {
  getEmailChannelRuntime,
  isChannelOperational,
  validateTicqexConfig,
  type TicqexConfig,
} from "@server/config";

const enabledEmailConfig: TicqexConfig = {
  version: 1,
  channels: {
    email: {
      enabled: true,
      integration: "resend",
    },
  },
  integrations: {
    resend: {
      enabled: true,
    },
  },
};

describe("validateTicqexConfig", () => {
  it("binds email to resend when env is complete", () => {
    const result = validateTicqexConfig(enabledEmailConfig, {
      RESEND_API_KEY: "re_test",
      RESEND_INBOUND_WEBHOOK_SECRET: "whsec_test",
      SUPPORT_EMAIL: "support@example.com",
      SUPPORT_FROM_NAME: "Support",
      NEXT_PUBLIC_APP_URL: "https://example.com",
    });

    expect(result.ok).toBe(true);
    expect(enabledEmailConfig.channels.email.integration).toBe("resend");
  });

  it("requires NEXT_PUBLIC_APP_URL when email is enabled", () => {
    const result = validateTicqexConfig(enabledEmailConfig, {
      RESEND_API_KEY: "re_test",
      RESEND_INBOUND_WEBHOOK_SECRET: "whsec_test",
      SUPPORT_EMAIL: "support@example.com",
      SUPPORT_FROM_NAME: "Support",
    });

    expect(result.ok).toBe(false);
    expect(
      result.issues.some((issue) => issue.path === "env.NEXT_PUBLIC_APP_URL"),
    ).toBe(true);
  });

  it("surfaces missing env vars", () => {
    const result = validateTicqexConfig(enabledEmailConfig, {});
    expect(result.ok).toBe(false);
    expect(
      result.issues.some((issue) => issue.path === "env.RESEND_API_KEY"),
    ).toBe(true);
  });
});

describe("getEmailChannelRuntime", () => {
  it("returns a configured email runtime", () => {
    const runtime = getEmailChannelRuntime({
      config: enabledEmailConfig,
      env: {
        RESEND_API_KEY: "re_test",
        RESEND_INBOUND_WEBHOOK_SECRET: "whsec_test",
        SUPPORT_EMAIL: "support@example.com",
        SUPPORT_FROM_NAME: "Support",
        NEXT_PUBLIC_APP_URL: "https://example.com",
      },
    });

    expect(runtime).toBeDefined();
    expect(runtime!.channel.key).toBe("email");
    expect(runtime!.integrationKey).toBe("resend");
    expect(runtime!.integration?.configured).toBe(true);
  });
});

describe("isChannelOperational", () => {
  const env = {
    RESEND_API_KEY: "re_test",
    RESEND_INBOUND_WEBHOOK_SECRET: "whsec_test",
    SUPPORT_EMAIL: "support@example.com",
    SUPPORT_FROM_NAME: "Support",
    NEXT_PUBLIC_APP_URL: "https://example.com",
  };

  it("returns true when email channel env is complete", () => {
    expect(
      isChannelOperational("email", { env, config: enabledEmailConfig }),
    ).toBe(true);
  });

  it("returns false when env is missing", () => {
    expect(
      isChannelOperational("email", { env: {}, config: enabledEmailConfig }),
    ).toBe(false);
  });
});
