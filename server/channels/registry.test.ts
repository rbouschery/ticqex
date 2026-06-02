import { describe, expect, it } from "vitest";
import {
  buildTicketCardSurface,
  channelKeys,
  type ChannelDefinition,
  findMissingRequiredFields,
  getChannelDefinition,
  getChannelIntegrationEmail,
  assertChannelFields,
  assertChannelReadyToSend,
  getMissingChannelFields,
} from "@server/channels";
import { ApiError } from "@server/lib/errors";
import type { TicqexConfig } from "@server/config";
import {
  type EmailDeliveryEvent,
  type EmailDeliveryEventResult,
  type ParsedEmail,
} from "@shared/channels/email/transport";

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

const unboundEmailConfig: TicqexConfig = {
  version: 1,
  channels: {
    email: {
      enabled: true,
      integration: null,
    },
  },
  integrations: {
    resend: {
      enabled: true,
    },
  },
};

describe("channel registry", () => {
  it("registers email as the only channel", () => {
    expect(channelKeys).toEqual(["email"]);

    const email = getChannelDefinition("email");
    expect(email).toBeDefined();
    expect(email.key).toBe("email");
    expect("integrationKey" in email).toBe(false);
    expect(email.conversation.canSendPublicReplies).toBe(true);
    expect(email.inbound).toBeDefined();
    expect(email.outbound).toBeDefined();
    expect(email.deliveryEvents).toBeDefined();

    const neutralEmail: ChannelDefinition<
      ParsedEmail,
      EmailDeliveryEvent,
      EmailDeliveryEventResult
    > = email;
    expect(neutralEmail.key).toBe("email");
  });
});

describe("email card surface", () => {
  it("builds badges and chips for conversation tickets", () => {
    const email = getChannelDefinition("email");
    expect(email).toBeDefined();

    const built = email!.card.build({
      kind: "conversation",
      channel: "email",
      contact_address: "user@example.com",
      custom_fields: {},
    });

    expect(built.badges[0]?.label).toBe("Email");
    expect(built.badges[0]?.variant).toBe("outline");
    expect(built.chips).toEqual([
      { label: "Email address", value: "user@example.com" },
    ]);
    expect(built.warning_badges).toHaveLength(0);
  });
});

describe("field policy helpers", () => {
  it("finds missing required fields and builds task card surfaces", () => {
    const email = getChannelDefinition("email");
    expect(email).toBeDefined();

    const missing = findMissingRequiredFields(
      email!.fields,
      { contact_address: null, custom_fields: {} },
      "on_create",
    );
    expect(missing).toHaveLength(1);
    expect(missing[0]?.key).toBe("contact_address");

    const taskSurface = buildTicketCardSurface({
      kind: "task",
      channel: null,
      contact_address: null,
      custom_fields: { priority: "high", region: "eu" },
      preview: "Task preview",
    });
    expect(taskSurface.chips).toEqual([
      { label: "priority", value: "high" },
      { label: "region", value: "eu" },
    ]);
    expect(taskSurface.preview).toBe("Task preview");
  });
});

describe("channel integration email", () => {
  const env = {
    RESEND_API_KEY: "re_test",
    RESEND_INBOUND_WEBHOOK_SECRET: "whsec_test",
    SUPPORT_EMAIL: "support@example.com",
    SUPPORT_FROM_NAME: "Support",
    NEXT_PUBLIC_APP_URL: "https://example.com",
  };

  it("returns null when email channel has no integration binding", () => {
    expect(
      getChannelIntegrationEmail("email", {
        config: unboundEmailConfig,
        env,
      }),
    ).toBeNull();
  });

  it("returns send and resolveInbound when email is bound to resend", () => {
    const emailApi = getChannelIntegrationEmail("email", {
      config: enabledEmailConfig,
      env,
    });
    expect(emailApi).toBeDefined();
    expect(typeof emailApi!.send).toBe("function");
    expect(typeof emailApi!.resolveInbound).toBe("function");
  });
});

describe("field policy enforcement", () => {
  it("rejects missing contact_address on create and send", () => {
    expect(() =>
      assertChannelFields("email", "on_create", {
        contact_address: null,
        custom_fields: {},
      }),
    ).toThrowError(expect.any(ApiError));

    try {
      assertChannelFields("email", "on_create", {
        contact_address: null,
        custom_fields: {},
      });
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).status).toBe(400);
      expect((error as ApiError).message).toMatch(/Email address/);
    }

    expect(() =>
      assertChannelFields("email", "on_create", {
        contact_address: "user@example.com",
        custom_fields: {},
      }),
    ).not.toThrow();

    expect(() =>
      assertChannelReadyToSend("email", {
        contact_address: null,
        custom_fields: {},
      }),
    ).toThrowError(expect.any(ApiError));

    try {
      assertChannelReadyToSend("email", {
        contact_address: null,
        custom_fields: {},
      });
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).status).toBe(400);
    }

    expect(() =>
      assertChannelReadyToSend("email", {
        contact_address: "user@example.com",
        custom_fields: {},
      }),
    ).not.toThrow();
  });

  it("lists missing fields for empty contact_address", () => {
    expect(
      getMissingChannelFields("email", "on_create", {
        contact_address: "",
        custom_fields: {},
      }).map((field) => field.key),
    ).toEqual(["contact_address"]);
  });
});
