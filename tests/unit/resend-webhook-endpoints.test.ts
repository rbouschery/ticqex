import { describe, expect, it } from "vitest";
import {
  normalizeAppUrl,
  resendEventsWebhookEndpoint,
  resendInboundWebhookEndpoint,
} from "@shared/integrations/resend/webhook-endpoints";

describe("resend webhook endpoints", () => {
  it("normalizes trailing slashes on the app URL", () => {
    expect(normalizeAppUrl("https://ticqex.example.com/")).toBe(
      "https://ticqex.example.com",
    );
  });

  it("builds inbound and events webhook URLs", () => {
    expect(resendInboundWebhookEndpoint("http://localhost:3000")).toBe(
      "http://localhost:3000/api/webhooks/integrations/resend/inbound",
    );
    expect(resendEventsWebhookEndpoint("https://ticqex.example.com/")).toBe(
      "https://ticqex.example.com/api/webhooks/integrations/resend/events",
    );
  });
});
