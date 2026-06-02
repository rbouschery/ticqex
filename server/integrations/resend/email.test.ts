import { describe, expect, it } from "vitest";
import {
  normalizeResendDeliveryEvent,
  parseResendInbound,
} from "@server/integrations/resend/email";
import { EMAIL_PROVIDER_MESSAGE_REF_TYPE } from "@shared/channels/email/transport";

describe("parseResendInbound", () => {
  it("normalizes inbound webhook payloads", () => {
    const parsed = parseResendInbound({
      type: "email.received",
      data: {
        email_id: "resend-inbound-id",
        from: "User <user@example.com>",
        to: "support@example.com",
        subject: "Hello",
        text: "Body",
        message_id: "<message@example.com>",
        headers: {},
      },
    });

    expect(parsed.from).toBe("user@example.com");
    expect(parsed.providerRef?.provider).toBe("resend");
    expect(parsed.providerRef?.integrationKey).toBe("resend");
    expect(parsed.providerRef?.direction).toBe("inbound");
    expect(parsed.providerRef?.refType).toBe(EMAIL_PROVIDER_MESSAGE_REF_TYPE);
    expect(parsed.providerRef?.externalId).toBe("resend-inbound-id");
    expect("providerInboundId" in parsed).toBe(false);
  });
});

describe("normalizeResendDeliveryEvent", () => {
  it("normalizes delivery events and ignores unsupported types", () => {
    const event = normalizeResendDeliveryEvent({
      type: "email.delivered",
      created_at: "2026-05-29T19:30:00.000Z",
      data: {
        email_id: "resend-outbound-id",
      },
    });

    expect(event).toBeDefined();
    expect(event!.status).toBe("delivered");
    expect(event!.providerEventType).toBe("email.delivered");
    expect(event!.providerRef.provider).toBe("resend");
    expect(event!.providerRef.integrationKey).toBe("resend");
    expect(event!.providerRef.direction).toBe("outbound");
    expect(event!.providerRef.refType).toBe(EMAIL_PROVIDER_MESSAGE_REF_TYPE);
    expect(event!.providerRef.externalId).toBe("resend-outbound-id");

    expect(
      normalizeResendDeliveryEvent({
        type: "email.opened",
        data: { email_id: "ignored" },
      }),
    ).toBeNull();
  });
});
