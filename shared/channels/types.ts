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
  group: "ticket" | "customer";
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
