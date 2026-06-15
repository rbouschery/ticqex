import { buildTicketCardSurface } from "@shared/channels";
import { sortBoardTickets, type BoardSort } from "@shared/board-sort";
import {
  ticketMatchesFilter,
  type TicketFilter,
  type TicketFilterMatchTicket,
} from "@shared/ticket-filter";
import {
  filterTicketCardSurface,
  parseCustomFieldId,
  type ResolvedTicketFieldLayout,
  type TicketCustomFieldDefinition,
} from "@shared/ticket-fields";
import type { Tag } from "@/components/tags/types";
import type {
  BoardLane,
  BoardTicket,
  TicketDetail,
} from "./types";

export type CreateTicketPayload = {
  title: string;
  body?: string;
  contactUsername?: string;
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

function buildCardSurfaceForTicket(
  detail: Pick<
    TicketDetail,
    | "kind"
    | "channel"
    | "contact_address"
    | "custom_fields"
    | "card_surface"
    | "origin"
  >,
  preview: string,
) {
  if (detail.card_surface) return detail.card_surface;

  return buildTicketCardSurface({
    kind: detail.kind,
    channel: detail.kind === "conversation" ? detail.channel : null,
    contact_address: detail.contact_address ?? null,
    custom_fields: detail.custom_fields,
    preview,
    origin: detail.origin,
  });
}

export function buildOptimisticBoardTicket(
  payload: CreateTicketPayload,
  tempId: string,
  now: string,
): BoardTicket {
  const body = payload.body?.trim() ?? "";
  const contactUsername = payload.contactUsername?.trim();
  const preview = body ? bodyPreview(body) : "";

  return {
    id: tempId,
    title: payload.title,
    is_pending: true,
    kind: "task",
    channel: null,
    origin: "manual",
    contact_id: null,
    assignee_id: null,
    preview,
    contact: contactUsername
      ? { username: contactUsername, initials: initials(contactUsername) }
      : null,
    assignee: null,
    custom_fields: {},
    contact_open_fields: [],
    tags: payload.tags.map((tag) => ({
      id: tag.id ?? tag.name,
      name: tag.name,
      color: tag.color,
    })),
    card_surface: buildTicketCardSurface({
      kind: "task",
      channel: null,
      contact_address: null,
      custom_fields: {},
      preview,
    }),
    created_at: now,
    updated_at: now,
    unread_count: 0,
  };
}

export function ticketDetailToBoardTicket(detail: TicketDetail): BoardTicket {
  const body = detail.body ?? "";
  const preview = body ? bodyPreview(body) : "";
  const card_surface = buildCardSurfaceForTicket(detail, preview);

  const base = {
    id: detail.id,
    title: detail.title,
    origin: detail.origin,
    contact_id: detail.contact_id,
    assignee_id: detail.assignee_id,
    preview,
    contact: detail.contact
      ? {
          username: detail.contact.username,
          initials: initials(detail.contact.username),
        }
      : null,
    assignee: detail.assignee
      ? {
          username: detail.assignee.username,
          initials: initials(detail.assignee.username),
        }
      : null,
    custom_fields: detail.custom_fields,
    contact_open_fields: [],
    tags: detail.tags.map((tag) => ({
      id: tag.id ?? tag.name,
      name: tag.name,
      color: tag.color,
    })),
    card_surface,
    created_at: detail.created_at,
    updated_at: detail.updated_at,
    unread_count: "unread_count" in detail ? (detail.unread_count ?? 0) : 0,
  };
  if (detail.kind === "task") {
    return { ...base, kind: "task", channel: null };
  }
  return { ...base, kind: "conversation", channel: detail.channel };
}

function ticketMatchesSearch(
  ticket: Pick<BoardTicket, "title" | "preview" | "contact">,
  searchQuery: string,
): boolean {
  const q = searchQuery.trim().toLowerCase();
  if (!q) return true;
  if (ticket.title.toLowerCase().includes(q)) return true;
  if (ticket.preview.toLowerCase().includes(q)) return true;
  if (ticket.contact?.username.toLowerCase().includes(q)) return true;
  return false;
}

function asFilterMatchTicket(ticket: BoardTicket): TicketFilterMatchTicket {
  return {
    kind: ticket.kind,
    channel: ticket.channel,
    origin: ticket.origin,
    assignee_id: ticket.assignee_id,
    contact_id: ticket.contact_id,
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

export function ticketCustomFieldDefinitionsFromLayout(
  layout: ResolvedTicketFieldLayout,
): TicketCustomFieldDefinition[] {
  return layout.catalog.flatMap((entry) => {
    if (entry.kind !== "custom" || !entry.key || !entry.type) return [];
    const id = parseCustomFieldId(entry.id);
    if (!id) return [];
    return [
      {
        id,
        key: entry.key,
        label: entry.label,
        type: entry.type,
        position: entry.position ?? 0,
        required: entry.required,
      },
    ];
  });
}

export function mergeBoardTicketAfterPatch(
  existing: BoardTicket,
  detail: TicketDetail,
  layout: ResolvedTicketFieldLayout | null | undefined,
): BoardTicket {
  const converted = ticketDetailToBoardTicket(detail);
  let card_surface = converted.card_surface;
  if (layout && card_surface) {
    card_surface = filterTicketCardSurface(
      card_surface,
      layout,
      ticketCustomFieldDefinitionsFromLayout(layout),
    );
  }
  return {
    ...converted,
    card_surface,
    unread_count: existing.unread_count,
  };
}
