import type { BoardSort } from "./schema";

/** Where a ticket should land in a lane after a status change (visible slice). */
export function statusChangeInsertIndex(
  sort: BoardSort,
  laneTicketCount: number,
): number {
  if (sort.mode === "updated_at") {
    return sort.direction === "desc" ? 0 : laneTicketCount;
  }
  if (sort.mode === "manual") {
    return 0;
  }
  return laneTicketCount;
}

/** Target lane ticket id order sent to move-ticket for a status change. */
export function statusChangeTargetIds(
  sort: BoardSort,
  ticketId: string,
  visibleIds: string[],
): string[] {
  const rest = visibleIds.filter((id) => id !== ticketId);
  if (
    sort.mode === "updated_at" &&
    sort.direction === "desc"
  ) {
    return [ticketId, ...rest];
  }
  if (sort.mode === "manual") {
    return [ticketId, ...rest];
  }
  return [...rest, ticketId];
}
