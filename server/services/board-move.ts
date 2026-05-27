import { createAdminClient } from "@server/lib/supabase-admin";
import { ApiError } from "@server/lib/errors";
import { invalidateLaneSortCache } from "@server/services/board-lane-sort-cache";
import { setLaneOrder } from "@server/services/board-lane-orders";

export type BoardMoveFilterContext = {
  source_visible_ticket_ids?: string[];
  target_visible_ticket_ids?: string[];
  removed_ticket_ids?: string[];
};

export type MoveTicketOnBoardInput = {
  ticket_id: string;
  from_status_id: string;
  to_status_id: string;
  target_ticket_ids: string[];
  source_ticket_ids?: string[];
  filter_context?: BoardMoveFilterContext;
};

function laneOrderOptions(
  visibleIds: string[] | undefined,
  removedIds?: string[],
): { visibleTicketIds: string[]; removedTicketIds?: string[] } | undefined {
  if (!visibleIds?.length) return undefined;
  return {
    visibleTicketIds: visibleIds,
    removedTicketIds: removedIds?.length ? removedIds : undefined,
  };
}

function removeOnlyLaneOrderOptions(ticketId: string) {
  return {
    visibleTicketIds: [ticketId],
    removedTicketIds: [ticketId],
  };
}

export async function moveTicketOnBoard(
  userId: string,
  input: MoveTicketOnBoardInput,
) {
  const db = createAdminClient();

  const { data: ticket, error: ticketError } = await db
    .from("tickets")
    .select("id, status_id")
    .eq("id", input.ticket_id)
    .maybeSingle();

  if (ticketError) throw ApiError.internal(ticketError.message);
  if (!ticket) throw ApiError.notFound("Ticket not found");

  const actualFromStatusId = ticket.status_id as string;
  const sourceMatchesRequest = actualFromStatusId === input.from_status_id;
  const crossLane = actualFromStatusId !== input.to_status_id;

  if (crossLane) {
    if (sourceMatchesRequest && !input.source_ticket_ids) {
      throw ApiError.badRequest(
        "source_ticket_ids is required when moving across lanes",
      );
    }

    const { error: statusError } = await db
      .from("tickets")
      .update({
        status_id: input.to_status_id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", input.ticket_id);

    if (statusError) throw ApiError.internal(statusError.message);
  }

  const fc = input.filter_context;
  let sourceTicketIds: string[] | undefined;

  if (crossLane) {
    sourceTicketIds = await setLaneOrder(
      userId,
      actualFromStatusId,
      sourceMatchesRequest ? input.source_ticket_ids! : [],
      sourceMatchesRequest
        ? laneOrderOptions(
            fc?.source_visible_ticket_ids,
            fc?.removed_ticket_ids ?? [input.ticket_id],
          )
        : removeOnlyLaneOrderOptions(input.ticket_id),
    );
  }

  const targetTicketIds = await setLaneOrder(
    userId,
    input.to_status_id,
    input.target_ticket_ids,
    laneOrderOptions(fc?.target_visible_ticket_ids),
  );

  if (crossLane) {
    invalidateLaneSortCache([actualFromStatusId, input.to_status_id]);
  }

  return {
    ticket_id: input.ticket_id,
    from_status_id: actualFromStatusId,
    to_status_id: input.to_status_id,
    source_ticket_ids: sourceTicketIds,
    target_ticket_ids: targetTicketIds,
  };
}
