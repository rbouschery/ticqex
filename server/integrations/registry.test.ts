import { describe, expect, it } from "vitest";
import {
  configureIntegration,
  getIntegrationDefinition,
  integrationKeys,
} from "@server/integrations";

describe("integration registry", () => {
  it("registers resend as the only integration", () => {
    expect(integrationKeys).toEqual(["resend"]);

    const resend = getIntegrationDefinition("resend");
    expect(resend).toBeDefined();
    expect(resend!.capabilities).toContain("email.inbound");
    expect(resend!.email?.send).toBeDefined();
    expect(resend!.email?.resolveInbound).toBeDefined();
    expect(resend!.webhooks?.inbound).toBeDefined();
    expect(resend!.webhooks?.events).toBeDefined();
  });
});

describe("configureIntegration", () => {
  it("marks resend configured when env is complete", () => {
    const runtime = configureIntegration(
      "resend",
      {
        RESEND_API_KEY: "re_test",
        RESEND_INBOUND_WEBHOOK_SECRET: "whsec_test",
        SUPPORT_EMAIL: "support@example.com",
        SUPPORT_FROM_NAME: "Support",
      },
      { enabled: true },
    );

    expect(runtime?.configured).toBe(true);
    expect(runtime?.missingEnv).toEqual([]);
  });
});
