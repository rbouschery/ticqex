import { arrayMove } from "@dnd-kit/sortable";
import type { BoardLane, BoardTicket } from "./types";

export function laneOrderPayload(
  lanes: BoardLane[],
): Record<string, string[]> {
  return Object.fromEntries(
    lanes.map((lane) => [
      lane.status.id,
      lane.tickets.map((ticket) => ticket.id),
    ]),
  );
}

export function findTicketInLanes(
  lanes: BoardLane[],
  ticketId: string,
): { ticket: BoardTicket; laneId: string } | null {
  for (const lane of lanes) {
    const ticket = lane.tickets.find((entry) => entry.id === ticketId);
    if (ticket) return { ticket, laneId: lane.status.id };
  }
  return null;
}

export function findLaneIdForTicket(
  lanes: BoardLane[],
  ticketId: string,
): string | null {
  for (const lane of lanes) {
    if (lane.tickets.some((ticket) => ticket.id === ticketId)) {
      return lane.status.id;
    }
  }
  return null;
}

export function isLaneId(lanes: BoardLane[], id: string): boolean {
  return lanes.some((lane) => lane.status.id === id);
}

export function resolveDropLaneId(lanes: BoardLane[], overId: string): string | null {
  if (isLaneId(lanes, overId)) return overId;
  return findLaneIdForTicket(lanes, overId);
}

export function reorderTicketInLane(
  lanes: BoardLane[],
  laneId: string,
  ticketId: string,
  overTicketId: string,
): BoardLane[] | null {
  const lane = lanes.find((entry) => entry.status.id === laneId);
  if (!lane) return null;

  const oldIndex = lane.tickets.findIndex((ticket) => ticket.id === ticketId);
  const newIndex = lane.tickets.findIndex((ticket) => ticket.id === overTicketId);
  if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return null;

  const nextTickets = arrayMove(lane.tickets, oldIndex, newIndex);
  return lanes.map((entry) =>
    entry.status.id === laneId ? { ...entry, tickets: nextTickets } : entry,
  );
}

export function moveTicketBetweenLanes(
  lanes: BoardLane[],
  ticketId: string,
  fromLaneId: string,
  toLaneId: string,
  overId: string,
): BoardLane[] | null {
  if (fromLaneId === toLaneId) return null;

  const sourceLane = lanes.find((entry) => entry.status.id === fromLaneId);
  const targetLane = lanes.find((entry) => entry.status.id === toLaneId);
  if (!sourceLane || !targetLane) return null;

  const activeIndex = sourceLane.tickets.findIndex((ticket) => ticket.id === ticketId);
  if (activeIndex === -1) return null;

  const ticket = sourceLane.tickets[activeIndex]!;
  let insertIndex = targetLane.tickets.length;
  if (overId !== toLaneId) {
    const overIndex = targetLane.tickets.findIndex((ticket) => ticket.id === overId);
    if (overIndex >= 0) insertIndex = overIndex;
  }

  const nextSourceTickets = sourceLane.tickets.filter((entry) => entry.id !== ticketId);
  const nextTargetTickets = [...targetLane.tickets];
  nextTargetTickets.splice(insertIndex, 0, ticket);

  return lanes.map((entry) => {
    if (entry.status.id === fromLaneId) {
      return { ...entry, tickets: nextSourceTickets };
    }
    if (entry.status.id === toLaneId) {
      return { ...entry, tickets: nextTargetTickets };
    }
    return entry;
  });
}
