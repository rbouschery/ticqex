import type { ChannelDefinition } from "@server/channels/types";
import {
  emailCardSurface,
  emailFieldPolicies,
} from "@shared/channels/email";
import { emailSettingsSections } from "@shared/channels/email/settings-sections";
import { emailInboundHandler } from "@server/channels/email/inbound";
import { emailOutboundHandler } from "@server/channels/email/outbound";
import { emailDeliveryHandler } from "@server/channels/email/delivery";
import type {
  EmailDeliveryEvent,
  EmailDeliveryEventResult,
  ParsedEmail,
} from "@server/channels/email/types";

export const emailChannel: ChannelDefinition<
  ParsedEmail,
  EmailDeliveryEvent,
  EmailDeliveryEventResult
> = {
  key: "email",
  label: "Email",
  conversation: {
    canSendPublicReplies: true,
    contactAddressLabel: "Email address",
  },
  fields: emailFieldPolicies,
  card: emailCardSurface,
  inbound: emailInboundHandler,
  outbound: emailOutboundHandler,
  deliveryEvents: emailDeliveryHandler,
  settings: {
    sections: emailSettingsSections,
  },
};
