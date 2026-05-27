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

export function resolveDropIndex(
  lanes: BoardLane[],
  toLaneId: string,
  overId: string,
): number {
  const targetLane = lanes.find((entry) => entry.status.id === toLaneId);
  if (!targetLane) return 0;

  if (overId === toLaneId) return targetLane.tickets.length;

  const overIndex = targetLane.tickets.findIndex((ticket) => ticket.id === overId);
  return overIndex >= 0 ? overIndex : targetLane.tickets.length;
}

export function applyTicketDrop(
  lanes: BoardLane[],
  ticketId: string,
  fromLaneId: string,
  toLaneId: string,
  insertIndex: number,
): BoardLane[] | null {
  const fromLane = lanes.find((entry) => entry.status.id === fromLaneId);
  const toLane = lanes.find((entry) => entry.status.id === toLaneId);
  if (!fromLane || !toLane) return null;

  const ticketIndex = fromLane.tickets.findIndex(
    (entry) => entry.id === ticketId,
  );
  if (ticketIndex === -1) return null;
  const ticket = fromLane.tickets[ticketIndex]!;

  if (fromLaneId === toLaneId) {
    const nextTickets = [...fromLane.tickets];
    nextTickets.splice(ticketIndex, 1);
    const adjustedIndex =
      ticketIndex < insertIndex ? insertIndex - 1 : insertIndex;
    nextTickets.splice(adjustedIndex, 0, ticket);
    return lanes.map((entry) =>
      entry.status.id === fromLaneId
        ? { ...entry, tickets: nextTickets }
        : entry,
    );
  }

  const nextFromTickets = fromLane.tickets.filter(
    (entry) => entry.id !== ticketId,
  );
  const nextTargetTickets = [...toLane.tickets];
  nextTargetTickets.splice(insertIndex, 0, ticket);

  return lanes.map((entry) => {
    if (entry.status.id === fromLaneId) {
      return {
        ...entry,
        tickets: nextFromTickets,
        total_count:
          entry.total_count != null
            ? Math.max(0, entry.total_count - 1)
            : undefined,
      };
    }
    if (entry.status.id === toLaneId) {
      return {
        ...entry,
        tickets: nextTargetTickets,
        total_count:
          entry.total_count != null ? entry.total_count + 1 : undefined,
      };
    }
    return entry;
  });
}
