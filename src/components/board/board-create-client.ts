import { sortBoardTickets, type BoardSort } from "@shared/board-sort";
import {
  ticketMatchesFilter,
  type TicketFilter,
  type TicketFilterMatchTicket,
} from "@shared/ticket-filter";
import type { Tag } from "@/components/tags/types";
import type { BoardLane, BoardTicket, TicketDetail } from "./types";

export type CreateTicketPayload = {
  title: string;
  body?: string;
  customerUsername?: string;
  statusId: string;
  tags: Tag[];
};

function initials(name: string): string {
  const parts = name.trim().split(/[\s@._-]+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
}

function bodyPreview(body: string, maxLen = 120): string {
  const oneLine = body.replace(/\s+/g, " ").trim();
  if (oneLine.length <= maxLen) return oneLine;
  return `${oneLine.slice(0, maxLen - 1)}…`;
}

export function buildOptimisticBoardTicket(
  payload: CreateTicketPayload,
  tempId: string,
  now: string,
): BoardTicket {
  const body = payload.body?.trim() ?? "";
  const customerUsername = payload.customerUsername?.trim();

  return {
    id: tempId,
    title: payload.title,
    kind: "task",
    channel: null,
    origin: "manual",
    customer_id: null,
    assignee_id: null,
    preview: body ? bodyPreview(body) : "",
    customer: customerUsername
      ? { username: customerUsername, initials: initials(customerUsername) }
      : null,
    assignee: null,
    custom_fields: {},
    tags: payload.tags.map((tag) => ({
      id: tag.id ?? tag.name,
      name: tag.name,
      color: tag.color,
    })),
    created_at: now,
    updated_at: now,
    unread_count: 0,
  };
}

export function ticketDetailToBoardTicket(detail: TicketDetail): BoardTicket {
  const body = detail.body ?? "";
  return {
    id: detail.id,
    title: detail.title,
    kind: detail.kind,
    channel: detail.channel,
    origin: detail.origin,
    customer_id: detail.customer_id,
    assignee_id: detail.assignee_id,
    preview: body ? bodyPreview(body) : "",
    customer: detail.customer
      ? {
          username: detail.customer.username,
          initials: initials(detail.customer.username),
        }
      : null,
    assignee: detail.assignee
      ? {
          username: detail.assignee.username,
          initials: initials(detail.assignee.username),
        }
      : null,
    custom_fields: detail.custom_fields,
    tags: detail.tags,
    created_at: detail.created_at,
    updated_at: detail.updated_at,
    unread_count: "unread_count" in detail ? (detail.unread_count ?? 0) : 0,
  };
}

function ticketMatchesSearch(
  ticket: Pick<BoardTicket, "title" | "preview" | "customer">,
  searchQuery: string,
): boolean {
  const q = searchQuery.trim().toLowerCase();
  if (!q) return true;
  if (ticket.title.toLowerCase().includes(q)) return true;
  if (ticket.preview.toLowerCase().includes(q)) return true;
  if (ticket.customer?.username.toLowerCase().includes(q)) return true;
  return false;
}

function asFilterMatchTicket(ticket: BoardTicket): TicketFilterMatchTicket {
  return {
    kind: ticket.kind,
    channel: ticket.channel,
    origin: ticket.origin,
    assignee_id: ticket.assignee_id,
    customer_id: ticket.customer_id,
    custom_fields: ticket.custom_fields,
    tags: ticket.tags,
    unread_count: ticket.unread_count,
  };
}

export function shouldOptimisticallyShowTicket({
  ticket,
  filter,
  searchQuery,
  searchActive,
  capped,
}: {
  ticket: BoardTicket;
  filter: TicketFilter;
  searchQuery: string;
  searchActive: boolean;
  capped: boolean;
}): boolean {
  if (capped) return false;
  if (!ticketMatchesFilter(asFilterMatchTicket(ticket), filter)) return false;
  if (searchActive && !ticketMatchesSearch(ticket, searchQuery)) return false;
  return true;
}

export function insertNewTicketIntoLane(
  lanes: BoardLane[],
  statusId: string,
  ticket: BoardTicket,
  sort: BoardSort,
): BoardLane[] {
  const lane = lanes.find((entry) => entry.status.id === statusId);
  if (!lane) return lanes;

  const manualOrder = lane.tickets.map((entry) => entry.id);
  const nextTickets = sortBoardTickets(
    [...lane.tickets, ticket],
    sort,
    manualOrder,
  );

  return lanes.map((entry) => {
    if (entry.status.id !== statusId) return entry;
    return {
      ...entry,
      tickets: nextTickets,
      total_count:
        entry.total_count != null ? entry.total_count + 1 : undefined,
    };
  });
}

export function removeTicketFromLanes(
  lanes: BoardLane[],
  ticketId: string,
): BoardLane[] {
  return lanes.map((lane) => {
    const had = lane.tickets.some((ticket) => ticket.id === ticketId);
    if (!had) return lane;
    return {
      ...lane,
      tickets: lane.tickets.filter((ticket) => ticket.id !== ticketId),
      total_count:
        lane.total_count != null
          ? Math.max(0, lane.total_count - 1)
          : undefined,
    };
  });
}

export function replaceTicketInLanes(
  lanes: BoardLane[],
  tempId: string,
  ticket: BoardTicket,
): BoardLane[] {
  return lanes.map((lane) => ({
    ...lane,
    tickets: lane.tickets.map((entry) => (entry.id === tempId ? ticket : entry)),
  }));
}
