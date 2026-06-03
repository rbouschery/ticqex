import {
  findMissingRequiredFields,
  resolvePolicyFieldValue,
  sortPoliciesByCardPriority,
} from "../field-policy";
import { CORE_TICKET_FIELD_IDS } from "../../ticket-fields/ids";
import { getConversationOriginCardBadge } from "../ticket-origin-badge";
import { emailFieldPolicies } from "./fields";
import type {
  ChannelCardTicketContext,
  TicketCardChip,
  TicketCardSurface,
} from "../types";

function chipFromPolicy(
  context: ChannelCardTicketContext,
  key: string,
  label: string,
): TicketCardChip | null {
  const raw = resolvePolicyFieldValue(key, {
    contact_address: context.contact_address,
    custom_fields: context.custom_fields,
  });
  const fieldId =
    key === "contact_address" ? CORE_TICKET_FIELD_IDS.contact_address : undefined;
  const base = fieldId
    ? { fieldId, sourceKey: key, label }
    : { sourceKey: key, label };
  if (raw == null || raw === "") return null;
  if (Array.isArray(raw)) {
    if (raw.length === 0) return null;
    return { ...base, value: raw.map(String).join(", ") };
  }

  return { ...base, value: String(raw) };
}

function buildEmailCard(context: ChannelCardTicketContext): TicketCardSurface {
  const sortedPolicies = sortPoliciesByCardPriority(emailFieldPolicies);

  const chips = sortedPolicies
    .map((policy) =>
      chipFromPolicy(context, policy.key, policy.label),
    )
    .filter((chip): chip is NonNullable<typeof chip> => chip !== null);

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
