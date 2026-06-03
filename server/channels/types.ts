import type { ChannelKey } from "@shared/ticqex-keys";
import type {
  ChannelCardSurfaceBuilder,
  ChannelFieldPolicy,
} from "@shared/channels";
import type { ChannelSettingsSectionMeta } from "@shared/settings/types";

export type { ChannelKey, IntegrationKey } from "@shared/ticqex-keys";

export type {
  ChannelCardSurfaceBuilder,
  ChannelCardTicketContext,
  ChannelFieldPolicy,
  TicketCardSurface,
} from "@shared/channels";

export type ChannelCardBadgeVariant =
  import("@shared/channels").TicketCardBadgeVariant;
export type ChannelCardBadge =
  import("@shared/channels").TicketCardBadge;
export type ChannelCardChip =
  import("@shared/channels").TicketCardChip;

export type ChannelInboundWebhookPayload = unknown;

export type ChannelInboundEvent<TPayload = ChannelInboundWebhookPayload> = {
  payload: TPayload;
};

export type ChannelOutboundRequest = {
  messageId: string;
};

export type ChannelDeliveryEvent<TPayload = unknown> = {
  payload: TPayload;
};

export type ChannelInboundHandler<TPayload = ChannelInboundWebhookPayload> = {
  handle(event: ChannelInboundEvent<TPayload>): Promise<void>;
};

export type ChannelOutboundHandler = {
  send(request: ChannelOutboundRequest): Promise<void>;
};

export type ChannelDeliveryEventHandler<
  TPayload = unknown,
  TResult = Record<string, unknown>,
> = {
  handle(event: ChannelDeliveryEvent<TPayload>): Promise<TResult>;
};

export type ChannelDefinition<
  TInbound = ChannelInboundWebhookPayload,
  TDeliveryPayload = unknown,
  TDeliveryResult = Record<string, unknown>,
> = {
  key: ChannelKey;
  label: string;
  conversation: {
    canSendPublicReplies: boolean;
    contactAddressLabel: string;
  };
  fields: ChannelFieldPolicy[];
  card: ChannelCardSurfaceBuilder;
  inbound: ChannelInboundHandler<TInbound>;
  outbound: ChannelOutboundHandler;
  deliveryEvents: ChannelDeliveryEventHandler<TDeliveryPayload, TDeliveryResult>;
  /** Serializable admin settings nav metadata; UI maps componentKey locally. */
  settings?: {
    sections: readonly ChannelSettingsSectionMeta[];
  };
};
