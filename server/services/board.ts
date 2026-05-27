import { createAdminClient } from "@server/lib/supabase-admin";
import { ApiError } from "@server/lib/errors";
import { BOARD_TICKET_SELECT, type BoardTicketRow } from "@server/domain/ticket";
import type { TicketFilter } from "@server/domain/ticket-filter";
import { isTicketFilterActive } from "@server/domain/ticket-filter";
import type { BoardSort } from "@server/domain/board-sort";
import {
  DEFAULT_BOARD_SORT,
  serializeBoardSort,
  sortBoardTickets,
} from "@shared/board-sort";
import { perLaneTicketLimit } from "@shared/board-limits";
import { enrichTicketsForBoard } from "@server/services/board-enrichment";
import { loadLaneOrdersForUser } from "@server/services/board-lane-orders";
import { resolveFilteredTicketIds } from "@server/services/ticket-filters";
import { resolveSearchTicketIds } from "@server/services/board-search";
import { createHash } from "node:crypto";
import { CHUNK_SIZE, chunkArray } from "@server/lib/chunked-array";
import {
  getLaneSortCacheEntry,
  setLaneSortCacheEntry,
} from "@server/services/board-lane-sort-cache";

type LightweightTicketRow = {
  id: string;
  created_at: string;
  updated_at: string;
};

type StatusRow = {
  id: string;
  name: string;
  color: string;
  is_visible?: boolean | null;
};

export type BoardQueryContext = {
  db: ReturnType<typeof createAdminClient>;
  filterActive: boolean;
  searchActive: boolean;
  restrictedIds: string[] | null;
  sort: BoardSort;
  manualOrders: Map<string, string[]>;
  visibleStatuses: StatusRow[];
  perLaneLimit: number | undefined;
};

export type LaneQueryContext = {
  db: ReturnType<typeof createAdminClient>;
  filterActive: boolean;
  searchActive: boolean;
  restrictedIds: string[] | null;
  sort: BoardSort;
  manualOrder: string[] | undefined;
  status: StatusRow;
};

const LIGHTWEIGHT_TICKET_SELECT = "id, created_at, updated_at";

function asBoardTicketRows(data: unknown): BoardTicketRow[] {
  if (!Array.isArray(data)) return [];
  return data as BoardTicketRow[];
}

function asLightweightRows(data: unknown): LightweightTicketRow[] {
  if (!Array.isArray(data)) return [];
  return data as LightweightTicketRow[];
}

async function queryTicketRowsInChunks<T>(
  restrictedIds: string[] | null,
  runQuery: (
    ids: string[] | null,
  ) => PromiseLike<{ data: unknown; error: { message: string } | null }>,
  parseRows: (data: unknown) => T[],
): Promise<T[]> {
  if (restrictedIds && restrictedIds.length === 0) return [];

  if (!restrictedIds || restrictedIds.length <= CHUNK_SIZE) {
    const { data, error } = await runQuery(restrictedIds);
    if (error) throw ApiError.internal(error.message);
    return parseRows(data);
  }

  const rows: T[] = [];
  for (const chunk of chunkArray(restrictedIds, CHUNK_SIZE)) {
    const { data, error } = await runQuery(chunk);
    if (error) throw ApiError.internal(error.message);
    rows.push(...parseRows(data));
  }
  return rows;
}

async function loadLightweightTicketsInLane(
  db: ReturnType<typeof createAdminClient>,
  statusId: string,
  restrictedIds: string[] | null,
): Promise<LightweightTicketRow[]> {
  return queryTicketRowsInChunks(
    restrictedIds,
    async (ids) => {
      let query = db
        .from("tickets")
        .select(LIGHTWEIGHT_TICKET_SELECT)
        .eq("status_id", statusId);
      if (ids) query = query.in("id", ids);
      return query;
    },
    asLightweightRows,
  );
}

async function loadFullTicketsInLane(
  db: ReturnType<typeof createAdminClient>,
  statusId: string,
  restrictedIds: string[] | null,
): Promise<BoardTicketRow[]> {
  return queryTicketRowsInChunks(
    restrictedIds,
    async (ids) => {
      let query = db
        .from("tickets")
        .select(BOARD_TICKET_SELECT)
        .eq("status_id", statusId);
      if (ids) query = query.in("id", ids);
      return query;
    },
    asBoardTicketRows,
  );
}

async function loadTicketsByIds(
  db: ReturnType<typeof createAdminClient>,
  ids: string[],
): Promise<BoardTicketRow[]> {
  if (ids.length === 0) return [];

  if (ids.length <= CHUNK_SIZE) {
    const { data, error } = await db
      .from("tickets")
      .select(BOARD_TICKET_SELECT)
      .in("id", ids);
    if (error) throw ApiError.internal(error.message);
    return asBoardTicketRows(data);
  }

  const rows: BoardTicketRow[] = [];
  for (const chunk of chunkArray(ids, CHUNK_SIZE)) {
    const { data, error } = await db
      .from("tickets")
      .select(BOARD_TICKET_SELECT)
      .in("id", chunk);
    if (error) throw ApiError.internal(error.message);
    rows.push(...asBoardTicketRows(data));
  }
  return rows;
}

function intersectIdLists(a: string[] | null, b: Set<string>): string[] | null {
  if (b.size === 0) return [];
  if (a === null) return [...b];
  const allowed = new Set(a);
  return [...b].filter((id) => allowed.has(id));
}

async function resolveRestrictedTicketIds(
  db: ReturnType<typeof createAdminClient>,
  filter: TicketFilter,
  searchQuery: string,
  userId: string | undefined,
): Promise<{
  filterActive: boolean;
  searchActive: boolean;
  restrictedIds: string[] | null;
}> {
  const filterActive = isTicketFilterActive(filter);
  const searchActive = searchQuery.trim().length > 0;

  const filteredIds = filterActive
    ? await resolveFilteredTicketIds(db, filter, { userId })
    : null;

  const searchIds = searchActive
    ? await resolveSearchTicketIds(db, searchQuery)
    : null;

  const restrictedIds = searchActive
    ? intersectIdLists(filteredIds, searchIds!)
    : filteredIds;

  return { filterActive, searchActive, restrictedIds };
}

function hashRestrictedIds(ids: string[] | null): string {
  if (ids === null) return "all";
  if (ids.length === 0) return "empty";
  const canonical = [...ids].sort().join("\0");
  return createHash("sha256").update(canonical).digest("hex").slice(0, 16);
}

function laneSortCacheKey(
  statusId: string,
  restrictedIds: string[] | null,
  sort: BoardSort,
  manualOrder: string[] | undefined,
): string {
  const orderKey = manualOrder?.join(",") ?? "";
  return `${statusId}:${serializeBoardSort(sort)}:${orderKey}:${hashRestrictedIds(restrictedIds)}`;
}

async function getSortedLaneIds(
  db: ReturnType<typeof createAdminClient>,
  statusId: string,
  restrictedIds: string[] | null,
  sort: BoardSort,
  manualOrder: string[] | undefined,
): Promise<string[]> {
  const key = laneSortCacheKey(statusId, restrictedIds, sort, manualOrder);
  const cached = getLaneSortCacheEntry(key);
  if (cached) return cached;

  const lightweight = await loadLightweightTicketsInLane(
    db,
    statusId,
    restrictedIds,
  );
  const sorted = sortBoardTickets(lightweight, sort, manualOrder);
  const ids = sorted.map((row) => row.id);
  setLaneSortCacheEntry(key, ids);
  return ids;
}

async function loadLanePage(
  db: ReturnType<typeof createAdminClient>,
  statusId: string,
  restrictedIds: string[] | null,
  offset: number,
  limit: number | undefined,
  sort: BoardSort,
  manualOrder: string[] | undefined,
): Promise<{ rows: BoardTicketRow[]; total_count: number; has_more: boolean }> {
  if (limit !== undefined) {
    const sortedIds = await getSortedLaneIds(
      db,
      statusId,
      restrictedIds,
      sort,
      manualOrder,
    );
    const total_count = sortedIds.length;
    const pageIds = sortedIds.slice(offset, offset + limit);
    const has_more = offset + pageIds.length < total_count;
    const fullRows = await loadTicketsByIds(db, pageIds);
    const byId = new Map(fullRows.map((row) => [row.id, row]));
    const rows = pageIds
      .map((id) => byId.get(id))
      .filter(
        (row): row is BoardTicketRow =>
          row !== undefined && row.status_id === statusId,
      );
    return { rows, total_count, has_more };
  }

  const rows = await loadFullTicketsInLane(db, statusId, restrictedIds);
  const sorted = sortBoardTickets(rows, sort, manualOrder);
  return {
    rows: sorted,
    total_count: sorted.length,
    has_more: false,
  };
}

export async function resolveBoardQueryContext(
  userId: string | undefined,
  filter: TicketFilter = [],
  sort: BoardSort = DEFAULT_BOARD_SORT,
  searchQuery = "",
): Promise<BoardQueryContext> {
  const db = createAdminClient();
  const { filterActive, searchActive, restrictedIds } =
    await resolveRestrictedTicketIds(db, filter, searchQuery, userId);

  const { data: statuses, error: statusErr } = await db
    .from("status_types")
    .select("*")
    .order("position");

  if (statusErr) throw ApiError.internal(statusErr.message);

  const visibleStatuses = (statuses ?? []).filter((s) => s.is_visible !== false);
  const visibleStatusIds = visibleStatuses.map((s) => s.id as string);
  const perLaneLimit = searchActive
    ? undefined
    : perLaneTicketLimit(visibleStatuses.length);

  const manualOrders =
    sort.mode === "manual" && userId
      ? await loadLaneOrdersForUser(userId, visibleStatusIds)
      : new Map<string, string[]>();

  return {
    db,
    filterActive,
    searchActive,
    restrictedIds,
    sort,
    manualOrders,
    visibleStatuses: visibleStatuses as StatusRow[],
    perLaneLimit,
  };
}

export async function resolveLaneQueryContext(
  statusId: string,
  userId: string | undefined,
  filter: TicketFilter = [],
  sort: BoardSort = DEFAULT_BOARD_SORT,
  searchQuery = "",
): Promise<LaneQueryContext> {
  const db = createAdminClient();
  const { filterActive, searchActive, restrictedIds } =
    await resolveRestrictedTicketIds(db, filter, searchQuery, userId);

  const { data: statusRow, error: statusErr } = await db
    .from("status_types")
    .select("*")
    .eq("id", statusId)
    .maybeSingle();

  if (statusErr) throw ApiError.internal(statusErr.message);
  if (!statusRow || statusRow.is_visible === false) {
    throw ApiError.notFound("Status not found");
  }

  const manualOrder =
    sort.mode === "manual" && userId
      ? (await loadLaneOrdersForUser(userId, [statusId])).get(statusId)
      : undefined;

  return {
    db,
    filterActive,
    searchActive,
    restrictedIds,
    sort,
    manualOrder,
    status: statusRow as StatusRow,
  };
}

export async function getLaneTicketsPage(
  statusId: string,
  offset: number,
  limit: number,
  userId: string | undefined,
  filter: TicketFilter = [],
  sort: BoardSort = DEFAULT_BOARD_SORT,
  searchQuery = "",
) {
  if (offset < 0) throw ApiError.badRequest("offset must be >= 0");
  if (limit < 1 || limit > 100) {
    throw ApiError.badRequest("limit must be between 1 and 100");
  }

  const ctx = await resolveLaneQueryContext(
    statusId,
    userId,
    filter,
    sort,
    searchQuery,
  );

  if (ctx.searchActive) {
    throw ApiError.badRequest("Load more is not available while search is active");
  }

  if (ctx.restrictedIds !== null && ctx.restrictedIds.length === 0) {
    return {
      status: {
        id: ctx.status.id,
        name: ctx.status.name,
        color: ctx.status.color,
      },
      tickets: [],
      total_count: 0,
      has_more: false,
      offset,
    };
  }

  const { rows, total_count, has_more } = await loadLanePage(
    ctx.db,
    statusId,
    ctx.restrictedIds,
    offset,
    limit,
    ctx.sort,
    ctx.manualOrder,
  );

  const enriched = await enrichTicketsForBoard(rows, userId);

  return {
    status: {
      id: ctx.status.id,
      name: ctx.status.name,
      color: ctx.status.color,
    },
    tickets: enriched,
    total_count,
    has_more,
    offset,
  };
}

export async function getBoard(
  userId?: string,
  filter: TicketFilter = [],
  sort: BoardSort = DEFAULT_BOARD_SORT,
  searchQuery = "",
) {
  const ctx = await resolveBoardQueryContext(userId, filter, sort, searchQuery);

  const { data: settings, error: settingsErr } = await ctx.db
    .from("global_settings")
    .select("*")
    .eq("id", 1)
    .single();

  if (settingsErr) throw ApiError.internal(settingsErr.message);

  const laneResults = await Promise.all(
    ctx.visibleStatuses.map(async (status) => {
      const statusId = status.id as string;

      if (ctx.restrictedIds !== null && ctx.restrictedIds.length === 0) {
        return {
          status: { id: status.id, name: status.name, color: status.color },
          tickets: [],
          total_count: 0,
          has_more: false,
        };
      }

      const { rows, total_count, has_more } = await loadLanePage(
        ctx.db,
        statusId,
        ctx.restrictedIds,
        0,
        ctx.perLaneLimit,
        ctx.sort,
        ctx.manualOrders.get(statusId),
      );

      const enriched = await enrichTicketsForBoard(rows, userId);

      return {
        status: { id: status.id, name: status.name, color: status.color },
        tickets: enriched,
        total_count,
        has_more,
      };
    }),
  );

  const capped = laneResults.some((lane) => lane.has_more);

  return {
    lanes: laneResults,
    settings,
    filter_active: ctx.filterActive,
    search_active: ctx.searchActive,
    capped,
    sort: ctx.sort,
  };
}
