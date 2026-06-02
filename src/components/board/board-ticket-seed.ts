import type { TicketOrigin } from "@shared/channels";
import type { BoardLane, BoardTicket } from "./types";

export type TicketModalSeed = {
  id: string;
  title: string;
  kind: BoardTicket["kind"];
  origin: TicketOrigin;
  unread_count: number;
  status_id: string;
  status: { id: string; name: string; color: string };
};

export function findBoardTicketWithStatus(
  lanes: BoardLane[],
  ticketId: string,
): { ticket: BoardTicket; status: BoardLane["status"] } | undefined {
  for (const lane of lanes) {
    const ticket = lane.tickets.find((t) => t.id === ticketId);
    if (ticket) return { ticket, status: lane.status };
  }
  return undefined;
}

export function findBoardTicket(
  lanes: BoardLane[],
  ticketId: string,
): BoardTicket | undefined {
  return findBoardTicketWithStatus(lanes, ticketId)?.ticket;
}

export function boardTicketToModalSeed(
  ticket: BoardTicket,
  status: { id: string; name: string; color: string },
): TicketModalSeed {
  return {
    id: ticket.id,
    title: ticket.title,
    kind: ticket.kind,
    origin: ticket.origin,
    unread_count: ticket.unread_count,
    status_id: status.id,
    status,
  };
}
