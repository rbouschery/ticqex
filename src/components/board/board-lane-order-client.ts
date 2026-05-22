import { apiFetch } from "@/lib/api-client";
import { laneOrderPayload } from "@/components/board/board-dnd-utils";
import type { BoardLane } from "@/components/board/types";

export type MoveTicketFilterContext = {
  source_visible_ticket_ids?: string[];
  target_visible_ticket_ids?: string[];
  removed_ticket_ids?: string[];
};

export type MoveTicketInput = {
  ticket_id: string;
  from_status_id: string;
  to_status_id: string;
  target_ticket_ids: string[];
  source_ticket_ids?: string[];
  filter_context?: MoveTicketFilterContext;
};

export function visibleIdsForLane(lanes: BoardLane[], laneId: string): string[] {
  return (
    lanes.find((lane) => lane.status.id === laneId)?.tickets.map((t) => t.id) ??
    []
  );
}

export function buildFilterContext({
  filterActive,
  startLanes,
  fromLaneId,
  toLaneId,
  ticketId,
  crossLane,
}: {
  filterActive: boolean;
  startLanes: BoardLane[];
  fromLaneId: string;
  toLaneId: string;
  ticketId: string;
  crossLane: boolean;
}): MoveTicketFilterContext | undefined {
  if (!filterActive) return undefined;

  if (crossLane) {
    const targetVisible = visibleIdsForLane(startLanes, toLaneId);
    const targetVisibleWithTicket = targetVisible.includes(ticketId)
      ? targetVisible
      : [...targetVisible, ticketId];

    return {
      source_visible_ticket_ids: visibleIdsForLane(startLanes, fromLaneId),
      target_visible_ticket_ids: targetVisibleWithTicket,
      removed_ticket_ids: [ticketId],
    };
  }

  return {
    target_visible_ticket_ids: visibleIdsForLane(startLanes, fromLaneId),
  };
}

export async function seedManualOrder(
  lanes: BoardLane[],
  options: { onlyIfEmpty?: boolean; mergeVisible?: boolean } = {},
) {
  const payload = laneOrderPayload(lanes);
  if (!Object.keys(payload).length) return;
  await apiFetch("/api/v1/board/manual-order", {
    method: "PUT",
    body: JSON.stringify({
      lanes: payload,
      only_if_empty: options.onlyIfEmpty,
      merge_visible: options.mergeVisible,
    }),
  });
}

export async function moveTicketOnBoard(input: MoveTicketInput) {
  await apiFetch("/api/v1/board/move-ticket", {
    method: "POST",
    body: JSON.stringify(input),
  });
}
