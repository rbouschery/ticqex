import {
  findMissingRequiredFields,
  resolvePolicyFieldValue,
  sortPoliciesByCardPriority,
} from "../field-policy";
import { getConversationOriginCardBadge } from "../ticket-origin-badge";
import { emailFieldPolicies } from "./fields";
import type { ChannelCardTicketContext, TicketCardSurface } from "../types";

const MAX_CARD_CHIPS = 2;

function chipFromPolicy(
  context: ChannelCardTicketContext,
  key: string,
  label: string,
): { label: string; value: string } | null {
  const raw = resolvePolicyFieldValue(key, {
    contact_address: context.contact_address,
    custom_fields: context.custom_fields,
  });
  if (raw == null || raw === "") return null;

  return { label, value: String(raw) };
}

function buildEmailCard(context: ChannelCardTicketContext): TicketCardSurface {
  const sortedPolicies = sortPoliciesByCardPriority(emailFieldPolicies);

  const chips = sortedPolicies
    .map((policy) =>
      chipFromPolicy(context, policy.key, policy.label),
    )
    .filter((chip): chip is NonNullable<typeof chip> => chip !== null)
    .slice(0, MAX_CARD_CHIPS);

  const missingRequired = findMissingRequiredFields(
    emailFieldPolicies,
    {
      contact_address: context.contact_address,
      custom_fields: context.custom_fields,
    },
    "on_create",
  );

  const originBadge = getConversationOriginCardBadge(context.origin);

  return {
    badges: [originBadge],
    warning_badges: missingRequired.map((field) => ({
      label: `Missing ${field.label}`,
      variant: "destructive" as const,
    })),
    preview: context.preview ?? "",
    chips,
  };
}

export const emailCardSurface = {
  build: buildEmailCard,
};
