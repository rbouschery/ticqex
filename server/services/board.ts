import { createAdminClient } from "@server/lib/supabase-admin";
import { ApiError } from "@server/lib/errors";
import { BOARD_TICKET_SELECT, type BoardTicketRow } from "@server/domain/ticket";
import type { TicketFilter } from "@server/domain/ticket-filter";
import { isTicketFilterActive } from "@server/domain/ticket-filter";
import type { BoardSort } from "@server/domain/board-sort";
import { DEFAULT_BOARD_SORT } from "@shared/board-sort";
import { sortBoardTickets } from "@shared/board-sort";
import { enrichTicketsForBoard } from "@server/services/board-enrichment";
import { loadLaneOrdersForUser } from "@server/services/board-lane-orders";
import { resolveFilteredTicketIds } from "@server/services/ticket-filters";

export async function getBoard(
  userId?: string,
  filter: TicketFilter = [],
  sort: BoardSort = DEFAULT_BOARD_SORT,
) {
  const db = createAdminClient();
  const filterActive = isTicketFilterActive(filter);

  const { data: settings, error: settingsErr } = await db
    .from("global_settings")
    .select("*")
    .eq("id", 1)
    .single();

  if (settingsErr) throw ApiError.internal(settingsErr.message);

  const { data: statuses, error: statusErr } = await db
    .from("status_types")
    .select("*")
    .order("position");

  if (statusErr) throw ApiError.internal(statusErr.message);

  const visibleStatuses = (statuses ?? []).filter((s) => s.is_visible !== false);
  const visibleStatusIds = visibleStatuses.map((s) => s.id as string);

  const filteredIds = filterActive
    ? await resolveFilteredTicketIds(db, filter, { userId })
    : null;

  const manualOrders =
    sort.mode === "manual" && userId
      ? await loadLaneOrdersForUser(userId, visibleStatusIds)
      : new Map<string, string[]>();

  const lanes = [];
  for (const status of visibleStatuses) {
    let totalCount: number | undefined;
    if (filterActive) {
      const { count, error: countErr } = await db
        .from("tickets")
        .select("*", { count: "exact", head: true })
        .eq("status_id", status.id);
      if (countErr) throw ApiError.internal(countErr.message);
      totalCount = count ?? 0;
    }

    if (filteredIds !== null && filteredIds.length === 0) {
      lanes.push({
        status: { id: status.id, name: status.name, color: status.color },
        tickets: [],
        total_count: totalCount,
      });
      continue;
    }

    let query = db
      .from("tickets")
      .select(BOARD_TICKET_SELECT)
      .eq("status_id", status.id);

    if (filteredIds) {
      query = query.in("id", filteredIds);
    }

    const { data: tickets, error: ticketErr } = await query;
    if (ticketErr) throw ApiError.internal(ticketErr.message);

    const enriched = await enrichTicketsForBoard(
      (tickets ?? []) as unknown as BoardTicketRow[],
      userId,
    );

    const sorted = sortBoardTickets(
      enriched,
      sort,
      manualOrders.get(status.id as string),
    );

    lanes.push({
      status: { id: status.id, name: status.name, color: status.color },
      tickets: sorted,
      total_count: totalCount,
    });
  }

  return { lanes, settings, filter_active: filterActive, sort };
}
