/**
 * Smoke test for board sorting (local dev).
 * Run: tsx --env-file=.env.local scripts/test-board-sort.ts
 */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { serializeBoardSort } from "../shared/board-sort";

const BASE =
  process.env.LOCAL_APP_URL ??
  (process.env.NEXT_PUBLIC_APP_URL?.includes("127.0.0.1") ||
  process.env.NEXT_PUBLIC_APP_URL?.includes("localhost")
    ? process.env.NEXT_PUBLIC_APP_URL
    : "http://127.0.0.1:3000");
const email = process.env.SEED_ADMIN_EMAIL ?? "admin@ticqex.local";
const password = process.env.SEED_ADMIN_PASSWORD ?? "ticqex-admin-change-me";

async function api<T>(
  path: string,
  token: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...init?.headers,
    },
  });
  const json = (await res.json()) as { data?: T; error?: { message: string } };
  if (!res.ok || json.error) {
    throw new Error(json.error?.message ?? `HTTP ${res.status} ${path}`);
  }
  return json.data as T;
}

type BoardResponse = {
  lanes: {
    status: { id: string; name: string };
    tickets: { id: string; created_at: string; updated_at: string }[];
  }[];
  sort?: { mode: string; direction?: string };
};

function sortQuery(sort: unknown): string {
  return encodeURIComponent(serializeBoardSort(sort as never));
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const supabase = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: auth, error: signInErr } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (signInErr || !auth.session) {
    throw new Error(`Sign-in failed: ${signInErr?.message ?? "no session"}`);
  }
  const token = auth.session.access_token;

  const defaultBoard = await api<BoardResponse>("/api/v1/board", token);
  const lane = defaultBoard.lanes.find((entry) => entry.tickets.length >= 2);
  if (!lane) {
    console.log("board-sort: skipped manual reorder (need lane with 2+ tickets)");
    return;
  }

  const createdSort = await api<BoardResponse>(
    `/api/v1/board?sort=${sortQuery({ mode: "created_at", direction: "asc" })}`,
    token,
  );
  const createdLane = createdSort.lanes.find((entry) => entry.tickets.length >= 2);
  if (createdLane) {
    const createdTimestamps = createdLane.tickets.map((ticket) => ticket.created_at);
    const createdSorted = [...createdTimestamps].sort();
    if (createdTimestamps.join("|") !== createdSorted.join("|")) {
      throw new Error("created_at asc sort failed within lane");
    }
  }

  const originalIds = lane.tickets.map((ticket) => ticket.id);
  const reversed = [...originalIds].reverse();
  await api(`/api/v1/board/lanes/${lane.status.id}/order`, token, {
    method: "PUT",
    body: JSON.stringify({ ticket_ids: reversed }),
  });

  const manualBoard = await api<BoardResponse>(
    `/api/v1/board?sort=${sortQuery({ mode: "manual" })}`,
    token,
  );
  const manualLane = manualBoard.lanes.find(
    (entry) => entry.status.id === lane.status.id,
  );
  if (!manualLane) throw new Error("manual lane missing");
  const manualIds = manualLane.tickets.map((ticket) => ticket.id);
  const expectedPrefix = reversed.filter((id) => manualIds.includes(id));
  const actualPrefix = manualIds.filter((id) => reversed.includes(id));
  if (expectedPrefix.join("|") !== actualPrefix.join("|")) {
    throw new Error(
      `manual sort mismatch: expected ${expectedPrefix.join(",")}, got ${actualPrefix.join(",")}`,
    );
  }

  const sourceLane = defaultBoard.lanes.find((entry) => entry.tickets.length >= 1);
  const targetLane = defaultBoard.lanes.find(
    (entry) =>
      entry.status.id !== sourceLane?.status.id && entry.tickets.length >= 0,
  );
  if (sourceLane && targetLane) {
    const ticketId = sourceLane.tickets[0]!.id;
    const sourceIds = sourceLane.tickets
      .map((ticket) => ticket.id)
      .filter((id) => id !== ticketId);
    const targetIds = [...targetLane.tickets.map((ticket) => ticket.id), ticketId];

    await api("/api/v1/board/move-ticket", token, {
      method: "POST",
      body: JSON.stringify({
        ticket_id: ticketId,
        from_status_id: sourceLane.status.id,
        to_status_id: targetLane.status.id,
        source_ticket_ids: sourceIds,
        target_ticket_ids: targetIds,
      }),
    });

    const afterMove = await api<BoardResponse>(
      `/api/v1/board?sort=${sortQuery({ mode: "manual" })}`,
      token,
    );
    const movedFrom = afterMove.lanes.find(
      (entry) => entry.status.id === sourceLane.status.id,
    );
    const movedTo = afterMove.lanes.find(
      (entry) => entry.status.id === targetLane.status.id,
    );
    if (movedFrom?.tickets.some((ticket) => ticket.id === ticketId)) {
      throw new Error("cross-lane move: ticket still in source lane");
    }
    if (!movedTo?.tickets.some((ticket) => ticket.id === ticketId)) {
      throw new Error("cross-lane move: ticket missing from target lane");
    }

    const restoreSourceIds = [...sourceIds, ticketId];
    const restoreTargetIds = targetLane.tickets.map((ticket) => ticket.id);
    await api("/api/v1/board/move-ticket", token, {
      method: "POST",
      body: JSON.stringify({
        ticket_id: ticketId,
        from_status_id: targetLane.status.id,
        to_status_id: sourceLane.status.id,
        source_ticket_ids: restoreTargetIds,
        target_ticket_ids: restoreSourceIds,
      }),
    });
  }

  console.log("board-sort: ok");
  console.log(`  lanes: ${defaultBoard.lanes.length}`);
  if (createdLane) {
    console.log(`  created sort checked lane ${createdLane.status.name}`);
  }
  console.log(`  manual sort checked lane ${lane.status.name}`);
  if (sourceLane && targetLane) {
    console.log(
      `  cross-lane move checked ${sourceLane.status.name} → ${targetLane.status.name}`,
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
