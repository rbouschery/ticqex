import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@server/lib/supabase-admin";
import { ApiError } from "@server/lib/errors";
import { mergeFilteredLaneOrder, mergeFilteredLaneOrderWithRemoval } from "@shared/board-sort/merge-lane-order";

export async function loadLaneOrdersForUser(
  userId: string,
  statusIds: string[],
): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>();
  if (!statusIds.length) return map;

  const db = createAdminClient();
  const { data, error } = await db
    .from("board_lane_orders")
    .select("status_id, ticket_ids")
    .eq("user_id", userId)
    .in("status_id", statusIds);

  if (error) throw ApiError.internal(error.message);

  for (const row of data ?? []) {
    map.set(row.status_id as string, (row.ticket_ids as string[]) ?? []);
  }

  return map;
}

async function fetchLaneTicketIds(
  db: SupabaseClient,
  statusId: string,
): Promise<{ validIds: Set<string>; orderedIds: string[] }> {
  const { data, error } = await db
    .from("tickets")
    .select("id")
    .eq("status_id", statusId)
    .order("updated_at", { ascending: false });
  if (error) throw ApiError.internal(error.message);

  const orderedIds = (data ?? []).map((row) => row.id as string);
  return { validIds: new Set(orderedIds), orderedIds };
}

function normalizeLaneTicketOrder(
  ticketIds: string[],
  validIds: Set<string>,
): string[] {
  const seen = new Set<string>();
  const ordered: string[] = [];

  for (const id of ticketIds) {
    if (!validIds.has(id) || seen.has(id)) continue;
    seen.add(id);
    ordered.push(id);
  }

  for (const id of validIds) {
    if (!seen.has(id)) ordered.push(id);
  }

  return ordered;
}

async function validateLaneTicketIds(
  db: SupabaseClient,
  statusId: string,
  ticketIds: string[],
  validIds?: Set<string>,
): Promise<string[]> {
  const ids = validIds ?? (await fetchLaneTicketIds(db, statusId)).validIds;
  return normalizeLaneTicketOrder(ticketIds, ids);
}

async function allTicketIdsInLane(db: SupabaseClient, statusId: string) {
  return (await fetchLaneTicketIds(db, statusId)).orderedIds;
}

async function resolveFullLaneOrder(
  db: SupabaseClient,
  userId: string,
  statusId: string,
  fallbackOrder?: string[],
): Promise<string[]> {
  const existing = (await loadLaneOrdersForUser(userId, [statusId])).get(statusId);
  if (existing?.length) return [...existing];
  if (fallbackOrder?.length) return [...fallbackOrder];
  return allTicketIdsInLane(db, statusId);
}

export async function setLaneOrder(
  userId: string,
  statusId: string,
  ticketIds: string[],
  options?: { visibleTicketIds?: string[]; removedTicketIds?: string[] },
) {
  const db = createAdminClient();
  let ordered: string[];

  if (options?.visibleTicketIds?.length) {
    const { validIds, orderedIds } = await fetchLaneTicketIds(db, statusId);
    const fullOrder = await resolveFullLaneOrder(
      db,
      userId,
      statusId,
      orderedIds,
    );
    ordered = options.removedTicketIds?.length
      ? mergeFilteredLaneOrderWithRemoval(
          fullOrder,
          options.visibleTicketIds,
          ticketIds,
          options.removedTicketIds,
        )
      : mergeFilteredLaneOrder(
          fullOrder,
          options.visibleTicketIds,
          ticketIds,
        );
    ordered = normalizeLaneTicketOrder(ordered, validIds);
  } else {
    ordered = await validateLaneTicketIds(db, statusId, ticketIds);
  }

  const { error } = await db.from("board_lane_orders").upsert(
    {
      user_id: userId,
      status_id: statusId,
      ticket_ids: ordered,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,status_id" },
  );
  if (error) throw ApiError.internal(error.message);

  return ordered;
}

export async function seedManualLaneOrders(
  userId: string,
  lanes: Record<string, string[]>,
  options?: { onlyIfEmpty?: boolean; mergeVisible?: boolean },
) {
  const db = createAdminClient();
  const statusIds = Object.keys(lanes);
  const existing =
    options?.onlyIfEmpty && statusIds.length
      ? await loadLaneOrdersForUser(userId, statusIds)
      : new Map<string, string[]>();

  const results: Record<string, string[]> = {};

  for (const [statusId, ticketIds] of Object.entries(lanes)) {
    if (options?.onlyIfEmpty && existing.has(statusId)) {
      results[statusId] = existing.get(statusId)!;
      continue;
    }

    if (options?.mergeVisible && ticketIds.length) {
      const fullOrder = await resolveFullLaneOrder(db, userId, statusId);
      results[statusId] = await validateLaneTicketIds(
        db,
        statusId,
        mergeFilteredLaneOrder(fullOrder, ticketIds, ticketIds),
      );
      continue;
    }

    results[statusId] = await validateLaneTicketIds(db, statusId, ticketIds);
  }

  const rows = Object.entries(results)
    .filter(([statusId]) => !options?.onlyIfEmpty || !existing.has(statusId))
    .map(([statusId, ticketIds]) => ({
      user_id: userId,
      status_id: statusId,
      ticket_ids: ticketIds,
      updated_at: new Date().toISOString(),
    }));

  if (rows.length) {
    const { error } = await db.from("board_lane_orders").upsert(rows, {
      onConflict: "user_id,status_id",
    });
    if (error) throw ApiError.internal(error.message);
  }

  return results;
}

export async function syncTicketLaneOrderOnStatusChange(
  userId: string,
  ticketId: string,
  oldStatusId: string,
  newStatusId: string,
  insertIndex?: number,
) {
  if (oldStatusId === newStatusId) return;

  const db = createAdminClient();
  const statusIds = [oldStatusId, newStatusId];
  const orders = await loadLaneOrdersForUser(userId, statusIds);

  const oldOrder = (orders.get(oldStatusId) ?? []).filter((id) => id !== ticketId);
  let newOrder = (orders.get(newStatusId) ?? []).filter((id) => id !== ticketId);

  const idx =
    insertIndex === undefined
      ? newOrder.length
      : Math.max(0, Math.min(insertIndex, newOrder.length));
  newOrder = [...newOrder.slice(0, idx), ticketId, ...newOrder.slice(idx)];

  const rows = [
    {
      user_id: userId,
      status_id: oldStatusId,
      ticket_ids: oldOrder,
      updated_at: new Date().toISOString(),
    },
    {
      user_id: userId,
      status_id: newStatusId,
      ticket_ids: newOrder,
      updated_at: new Date().toISOString(),
    },
  ];

  const { error } = await db.from("board_lane_orders").upsert(rows, {
    onConflict: "user_id,status_id",
  });
  if (error) throw ApiError.internal(error.message);
}
