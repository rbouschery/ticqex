import { createAdminClient } from "@server/lib/supabase-admin";
import { ApiError } from "@server/lib/errors";
import { BOARD_TICKET_SELECT, type BoardTicketRow } from "@server/domain/ticket";
import type { TicketFilter } from "@server/domain/ticket-filter";
import { isTicketFilterActive } from "@server/domain/ticket-filter";
import { enrichTicketsForBoard } from "@server/services/board-enrichment";
import { resolveFilteredTicketIds } from "@server/services/ticket-filters";

export async function getBoard(userId?: string, filter: TicketFilter = []) {
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

  const filteredIds = filterActive
    ? await resolveFilteredTicketIds(db, filter, { userId })
    : null;

  const lanes = [];
  for (const status of statuses ?? []) {
    if (status.is_visible === false) continue;

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
      .eq("status_id", status.id)
      .order("updated_at", { ascending: false });

    if (filteredIds) {
      query = query.in("id", filteredIds);
    }

    const { data: tickets, error: ticketErr } = await query;
    if (ticketErr) throw ApiError.internal(ticketErr.message);

    const enriched = await enrichTicketsForBoard(
      (tickets ?? []) as unknown as BoardTicketRow[],
      userId,
    );

    lanes.push({
      status: { id: status.id, name: status.name, color: status.color },
      tickets: enriched,
      total_count: totalCount,
    });
  }

  return { lanes, settings, filter_active: filterActive };
}
