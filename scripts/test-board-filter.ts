/**
 * Smoke test for board global filter (local dev).
 * Run: tsx --env-file=.env.local scripts/test-board-filter.ts
 */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { createAdminClient } from "../server/lib/supabase-admin";
import { ticketMatchesFilter } from "../shared/ticket-filter/evaluate";
import type { TicketFilter } from "../shared/ticket-filter/schema";

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

async function apiExpectError(path: string, token: string, status: number) {
  const res = await fetch(`${BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  if (res.status !== status) {
    throw new Error(`Expected HTTP ${status} for ${path}, got ${res.status}`);
  }
}

type BoardResponse = {
  lanes: {
    status: { id: string; name: string };
    tickets: {
      id: string;
      kind: string;
      assignee_id: string | null;
      origin?: string;
    }[];
    total_count?: number;
  }[];
  filter_active?: boolean;
};

function boardTicketIds(data: BoardResponse): string[] {
  return data.lanes.flatMap((lane) => lane.tickets.map((t) => t.id));
}

function filterQuery(filter: TicketFilter): string {
  return encodeURIComponent(JSON.stringify(filter));
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
  const userId = auth.user!.id;

  const db = createAdminClient();
  const { data: status } = await db
    .from("status_types")
    .select("id")
    .order("position")
    .limit(1)
    .single();
  if (!status) throw new Error("No status found");

  const taskTitle = `Board filter smoke ${Date.now()}`;
  const { data: task, error: taskErr } = await db
    .from("tickets")
    .insert({
      title: taskTitle,
      kind: "task",
      status_id: status.id,
      assignee_id: userId,
      origin: "manual",
    })
    .select("id")
    .single();
  if (taskErr || !task) throw new Error(taskErr?.message ?? "Failed to create task");

  const { data: unassigned, error: unassignedErr } = await db
    .from("tickets")
    .insert({
      title: `Board filter unassigned ${Date.now()}`,
      kind: "task",
      status_id: status.id,
      assignee_id: null,
      origin: "manual",
    })
    .select("id")
    .single();
  if (unassignedErr || !unassigned) {
    throw new Error(unassignedErr?.message ?? "Failed to create unassigned task");
  }

  try {
    const unfiltered = await api<BoardResponse>("/api/v1/board", token);
    if (!boardTicketIds(unfiltered).includes(task.id)) {
      throw new Error("Created task not visible on unfiltered board");
    }

    const hideTaskFilter: TicketFilter = [
      { field: "kind", op: "eq", value: "conversation" },
    ];
    const hideResult = await api<BoardResponse>(
      `/api/v1/board?filter=${filterQuery(hideTaskFilter)}`,
      token,
    );
    if (!hideResult.filter_active) {
      throw new Error("Expected filter_active=true in board response");
    }
    if (boardTicketIds(hideResult).includes(task.id)) {
      throw new Error("Task should be hidden by kind equals conversation filter");
    }

    const showTaskFilter: TicketFilter = [
      { field: "kind", op: "neq", value: "conversation" },
    ];
    const showResult = await api<BoardResponse>(
      `/api/v1/board?filter=${filterQuery(showTaskFilter)}`,
      token,
    );
    if (!boardTicketIds(showResult).includes(task.id)) {
      throw new Error("Task should remain visible by kind not-equals conversation filter");
    }

    const assigneeEmptyFilter: TicketFilter = [{ field: "assignee_id", op: "empty" }];
    const emptyAssigneeResult = await api<BoardResponse>(
      `/api/v1/board?filter=${filterQuery(assigneeEmptyFilter)}`,
      token,
    );
    const emptyAssigneeIds = boardTicketIds(emptyAssigneeResult);
    if (!emptyAssigneeIds.includes(unassigned.id)) {
      throw new Error("Unassigned task should match assignee empty filter");
    }
    if (emptyAssigneeIds.includes(task.id)) {
      throw new Error("Assigned task should not match assignee empty filter");
    }

    const multiFilter: TicketFilter = [
      { field: "kind", op: "eq", value: "task" },
      { field: "origin", op: "in", values: ["manual"] },
    ];
    const multiResult = await api<BoardResponse>(
      `/api/v1/board?filter=${filterQuery(multiFilter)}`,
      token,
    );
    const multiIds = boardTicketIds(multiResult);
    if (!multiIds.includes(task.id) || !multiIds.includes(unassigned.id)) {
      throw new Error("Multi-condition AND filter should include both manual tasks");
    }

    const laneWithTotals = hideResult.lanes.find((lane) => lane.total_count !== undefined);
    if (!laneWithTotals || laneWithTotals.total_count === undefined) {
      throw new Error("Expected total_count on lanes when filter is active");
    }

    const emptyOk = hideResult.lanes.every(
      (lane) => lane.total_count === undefined || lane.total_count >= lane.tickets.length,
    );
    if (!emptyOk) {
      throw new Error("filtered ticket count exceeds total_count for a lane");
    }

    await apiExpectError("/api/v1/board?filter=not-json", token, 400);

    const inMemoryOk = ticketMatchesFilter(
      {
        kind: "task",
        channel: null,
        origin: "manual",
        assignee_id: userId,
        customer_id: null,
        custom_fields: {},
        tags: [],
        unread_count: 0,
      },
      showTaskFilter,
    );
    if (!inMemoryOk) {
      throw new Error("Shared in-memory evaluator disagrees with kind neq filter");
    }

    console.log("OK board filter smoke test passed");
  } finally {
    await db.from("tickets").delete().in("id", [task.id, unassigned.id]);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
