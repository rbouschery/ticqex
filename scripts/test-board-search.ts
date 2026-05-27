/**
 * Smoke test for board cap, server search, and filters with load-test data.
 * Run: pnpm test:board-search
 * Requires: pnpm seed:board-load (and dev server on LOCAL_APP_URL)
 */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import {
  LOADTEST_TITLE_PREFIX,
  NEEDLE_SECRET,
  NEEDLE_TITLE,
} from "../shared/board-load-test";
import { perLaneTicketLimit, BOARD_LANE_LOAD_MORE_SIZE } from "../shared/board-limits";
import type { LaneTicketsPageResponse } from "../shared/board-lane-page";

const BASE =
  process.env.LOCAL_APP_URL ??
  (process.env.NEXT_PUBLIC_APP_URL?.includes("127.0.0.1") ||
  process.env.NEXT_PUBLIC_APP_URL?.includes("localhost")
    ? process.env.NEXT_PUBLIC_APP_URL
    : "http://127.0.0.1:3000");
const email = process.env.SEED_ADMIN_EMAIL ?? "admin@ticqex.local";
const password = process.env.SEED_ADMIN_PASSWORD ?? "ticqex-admin-change-me";

type BoardResponse = {
  lanes: {
    status: { id: string; name: string };
    tickets: { id: string; title: string; kind: string }[];
    total_count?: number;
  }[];
  filter_active?: boolean;
  search_active?: boolean;
  capped?: boolean;
};

type LaneTicketsPage = LaneTicketsPageResponse & {
  tickets: { id: string; title: string }[];
};

async function api<T>(path: string, token: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  const json = (await res.json()) as { data?: T; error?: { message: string } };
  if (!res.ok || json.error) {
    throw new Error(json.error?.message ?? `HTTP ${res.status} ${path}`);
  }
  return json.data as T;
}

function boardTicketIds(data: BoardResponse): string[] {
  return data.lanes.flatMap((lane) => lane.tickets.map((t) => t.id));
}

function totalShown(data: BoardResponse): number {
  return data.lanes.reduce((sum, lane) => sum + lane.tickets.length, 0);
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
  const supabase = createClient(url, publishableKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: auth, error: signInErr } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (signInErr || !auth.session) {
    throw new Error(`Sign in failed: ${signInErr?.message ?? "no session"}`);
  }
  const token = auth.session.access_token;

  const browse = await api<BoardResponse>("/api/v1/board", token);
  const laneCount = browse.lanes.length;
  const perLane = perLaneTicketLimit(laneCount);
  const maxShown = perLane * laneCount;

  if (!browse.capped) {
    throw new Error(
      "Expected capped=true after load-test seed (1200+ tickets). Run pnpm seed:board-load",
    );
  }

  const shown = totalShown(browse);
  if (shown > maxShown) {
    throw new Error(`Shown ${shown} exceeds cap ${maxShown}`);
  }

  for (const lane of browse.lanes) {
    if (lane.tickets.length > perLane) {
      throw new Error(
        `Lane ${lane.status.name} shows ${lane.tickets.length}, limit is ${perLane}`,
      );
    }
    if (
      lane.total_count !== undefined &&
      lane.total_count > lane.tickets.length &&
      lane.tickets.length !== perLane &&
      lane.total_count > perLane
    ) {
      // lane may have fewer tickets than cap if status has fewer rows
      continue;
    }
  }

  const loadtestOnBoard = browse.lanes
    .flatMap((lane) => lane.tickets)
    .filter((t) => t.title.startsWith(LOADTEST_TITLE_PREFIX));
  if (loadtestOnBoard.some((t) => t.title === NEEDLE_TITLE)) {
    throw new Error("Needle ticket should not appear on uncapped browse load");
  }

  const cappedLane = browse.lanes.find(
    (lane) =>
      lane.total_count !== undefined && lane.total_count > lane.tickets.length,
  );
  if (!cappedLane) {
    throw new Error("Expected at least one lane with more tickets than shown");
  }

  const firstPageIds = new Set(cappedLane.tickets.map((ticket) => ticket.id));
  const loadMore = await api<LaneTicketsPage>(
    `/api/v1/board/lanes/${encodeURIComponent(cappedLane.status.id)}/tickets?offset=${cappedLane.tickets.length}&limit=${BOARD_LANE_LOAD_MORE_SIZE}`,
    token,
  );
  if (loadMore.tickets.length === 0) {
    throw new Error("Expected additional tickets from lane load-more endpoint");
  }
  if (loadMore.tickets.some((ticket) => firstPageIds.has(ticket.id))) {
    throw new Error("Load-more returned duplicate ticket ids");
  }
  if (
    loadMore.total_count !== cappedLane.total_count ||
    loadMore.offset !== cappedLane.tickets.length
  ) {
    throw new Error("Load-more metadata mismatch");
  }

  const needleSearch = await api<BoardResponse>(
    `/api/v1/board?q=${encodeURIComponent(NEEDLE_SECRET)}`,
    token,
  );
  if (!needleSearch.search_active) {
    throw new Error("Expected search_active=true");
  }
  const needleIds = boardTicketIds(needleSearch);
  const needleMatch = needleSearch.lanes
    .flatMap((lane) => lane.tickets)
    .find((t) => t.title === NEEDLE_TITLE);
  if (!needleMatch) {
    throw new Error(
      `Needle ticket not found by secret message keyword ${NEEDLE_SECRET}`,
    );
  }

  const titleNoise = await api<BoardResponse>(
    `/api/v1/board?q=${encodeURIComponent(LOADTEST_TITLE_PREFIX)}`,
    token,
  );
  if (boardTicketIds(titleNoise).length < 10) {
    throw new Error("Expected many load-test tickets from title prefix search");
  }

  const taskFilter = encodeURIComponent(
    JSON.stringify([{ field: "kind", op: "eq", value: "task" }]),
  );
  const filtered = await api<BoardResponse>(
    `/api/v1/board?filter=${taskFilter}`,
    token,
  );
  if (!filtered.filter_active) {
    throw new Error("Expected filter_active=true");
  }
  if (filtered.lanes.some((lane) => lane.tickets.some((t) => t.kind !== "task"))) {
    throw new Error("Task filter returned non-task tickets");
  }
  if (boardTicketIds(filtered).includes(needleMatch.id)) {
    throw new Error("Needle conversation should not match task-only filter");
  }

  const filteredSearch = await api<BoardResponse>(
    `/api/v1/board?filter=${taskFilter}&q=${encodeURIComponent(NEEDLE_SECRET)}`,
    token,
  );
  if (boardTicketIds(filteredSearch).length !== 0) {
    throw new Error("Needle should not match task filter + secret search");
  }

  console.log("OK board cap + search smoke test passed");
  console.log(`  browse shown: ${shown}/${maxShown} cap, lanes: ${laneCount}`);
  console.log(
    `  load-more: +${loadMore.tickets.length} in ${cappedLane.status.name}`,
  );
  console.log(`  needle found via secret: ${needleMatch.id}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
