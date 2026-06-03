export type TicketOrigin = "manual" | "api" | "email";

export type TicketCardBadgeVariant =
  | "default"
  | "outline"
  | "destructive"
  | "secondary"
  | "warning";

export type TicketCardBadge = {
  label: string;
  variant?: TicketCardBadgeVariant;
};

export type TicketCardChip = {
  /** Stable ticket field id when the chip maps directly to a ticket field. */
  fieldId?: string;
  /** Stable source key for channel/custom fields when an id is not available. */
  sourceKey?: string;
  label: string;
  value: string;
};

/** Card payload rendered on board/list ticket cards. */
export type TicketCardSurface = {
  badges: TicketCardBadge[];
  warning_badges: TicketCardBadge[];
  preview: string;
  chips: TicketCardChip[];
};

export type ChannelFieldPolicy = {
  key: string;
  label: string;
  group: "ticket" | "contact";
  type: string;
  requiredWhen?: string;
  visibleWhen?: string;
  lockedWhen?: string;
  source?: "integration" | "operator" | "system";
  cardPriority?: number;
};

export type ChannelCardTicketContext = {
  kind?: "task" | "conversation";
  channel: string | null;
  contact_address: string | null;
  custom_fields: Record<string, unknown>;
  preview?: string;
  origin?: TicketOrigin;
};

export type ChannelCardSurfaceBuilder = {
  build: (context: ChannelCardTicketContext) => TicketCardSurface;
};
