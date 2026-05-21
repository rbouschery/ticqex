import { createAdminClient } from "@server/lib/supabase-admin";
import { ApiError } from "@server/lib/errors";
import { BOARD_TICKET_SELECT, type BoardTicketRow } from "@server/domain/ticket";
import { enrichTicketsForBoard } from "@server/services/board-enrichment";

export async function getBoard(userId?: string) {
  const db = createAdminClient();

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

  const visibleIds = settings.visible_status_ids?.length
    ? new Set(settings.visible_status_ids)
    : null;

  const lanes = [];
  for (const status of statuses ?? []) {
    if (visibleIds && !visibleIds.has(status.id)) continue;

    const { data: tickets } = await db
      .from("tickets")
      .select(BOARD_TICKET_SELECT)
      .eq("status_id", status.id)
      .order("updated_at", { ascending: false });

    const enriched = await enrichTicketsForBoard(
      (tickets ?? []) as BoardTicketRow[],
      userId,
    );

    lanes.push({
      status: { id: status.id, name: status.name, color: status.color },
      tickets: enriched,
    });
  }

  return { lanes, settings };
}
