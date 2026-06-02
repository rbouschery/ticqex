import { createAdminClient } from "@server/lib/supabase-admin";
import { ApiError } from "@server/lib/errors";
import type { TicketOrigin } from "@shared/channels/types";

export type { TicketOrigin } from "@shared/channels/types";

export type TicketKind = "task" | "conversation";

export type TicketChannel = "email";

/** Nested shapes from `tickets` list/detail select with joins. */
export type TicketListCustomer = {
  id: string;
  username: string;
};

export type TicketListAssignee = {
  id: string;
  username: string;
  email?: string;
};

export type TicketListStatus = {
  id: string;
  name: string;
  color: string;
};

/** Row shape for `*, customers(...), users:assignee_id(...), status_types(...)`. */
export type TicketListRow = {
  id: string;
  title: string;
  kind: TicketKind;
  body: string | null;
  channel: string | null;
  contact_address: string | null;
  customer_id: string | null;
  status_id: string;
  assignee_id: string | null;
  origin: TicketOrigin;
  created_at: string;
  updated_at: string;
  customers: TicketListCustomer | null;
  users: TicketListAssignee | null;
  status_types: TicketListStatus | null;
};

export const TICKET_LIST_SELECT =
  "*, customers(id, username), users:assignee_id(id, username), status_types(id, name, color)";

/** Row shape for board lane ticket select (preview enrichment input). */
export type BoardTicketRow = {
  id: string;
  title: string;
  kind: TicketKind;
  channel: string | null;
  origin: TicketOrigin;
  customer_id: string | null;
  status_id: string;
  assignee_id: string | null;
  body: string | null;
  contact_address: string | null;
  created_at: string;
  updated_at: string;
  customers: { id: string; username: string } | null;
  users: { id: string; username: string } | null;
};

export const BOARD_TICKET_SELECT =
  "id, title, kind, channel, origin, customer_id, status_id, assignee_id, body, contact_address, created_at, updated_at, customers(id, username), users:assignee_id(id, username)";

export type TicketRow = {
  id: string;
  kind: TicketKind;
  body: string | null;
  channel: string | null;
  contact_address: string | null;
  customer_id: string | null;
  status_id: string;
  title: string;
  origin?: TicketOrigin;
};

export function isTaskTicket(ticket: Pick<TicketRow, "kind">): boolean {
  return ticket.kind === "task";
}

export function isConversationTicket(
  ticket: Pick<TicketRow, "kind">,
): boolean {
  return ticket.kind === "conversation";
}

export function canSendEmail(
  ticket: Pick<TicketRow, "kind" | "channel">,
): boolean {
  return (
    isConversationTicket(ticket) && ticket.channel === "email"
  );
}

export async function loadTicketRow(id: string): Promise<TicketRow> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("tickets")
    .select(
      "id, kind, body, channel, contact_address, customer_id, status_id, title, origin",
    )
    .eq("id", id)
    .single();
  if (error || !data) throw ApiError.notFound("Ticket not found");
  return data as TicketRow;
}
