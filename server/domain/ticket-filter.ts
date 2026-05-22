export * from "@shared/ticket-filter";

import { ApiError } from "@server/lib/errors";
import {
  normalizeTicketFilter,
  ticketFilterSchema,
  type TicketFilter,
} from "@shared/ticket-filter";

export function parseTicketFilterParam(raw: string | null): TicketFilter {
  if (!raw || raw.trim() === "") return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return normalizeTicketFilter(ticketFilterSchema.parse(parsed));
  } catch {
    throw ApiError.badRequest("Invalid filter parameter");
  }
}
