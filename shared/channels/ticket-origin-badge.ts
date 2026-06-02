import type { TicketOrigin } from "./types";

export type TicketOriginBadge = {
  label: string;
  variant: "outline" | "secondary";
};

export function getConversationOriginBadge(
  origin: TicketOrigin | undefined,
): TicketOriginBadge {
  switch (origin) {
    case "api":
      return { label: "API", variant: "outline" };
    case "email":
      return { label: "Email", variant: "secondary" };
    case "manual":
    default:
      return { label: "Email conversation", variant: "secondary" };
  }
}

export function getConversationOriginCardBadge(
  origin: TicketOrigin | undefined,
): TicketOriginBadge {
  const badge = getConversationOriginBadge(origin);
  return badge.label === "API"
    ? badge
    : { label: "Email", variant: "outline" };
}
