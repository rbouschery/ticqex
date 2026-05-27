/**
 * Smoke tests for board drag-and-drop helpers (no server required).
 * Run: pnpm test:board-dnd
 */
import { applyTicketDrop } from "./board-dnd-utils";
import type { BoardLane, BoardTicket } from "./types";

function ticket(id: string): BoardTicket {
  return {
    id,
    title: id,
    kind: "task",
    channel: null,
    origin: "manual",
    customer_id: null,
    assignee_id: null,
    preview: "",
    customer: null,
    assignee: null,
    custom_fields: {},
    tags: [],
    created_at: "",
    updated_at: "",
    unread_count: 0,
  };
}

function lane(
  id: string,
  ticketIds: string[],
  totalCount?: number,
): BoardLane {
  return {
    status: { id, name: id, color: "#000" },
    tickets: ticketIds.map(ticket),
    total_count: totalCount,
  };
}

function assertCounts(
  entry: BoardLane | undefined,
  label: string,
  tickets: number,
  total?: number,
) {
  if (!entry) throw new Error(`${label}: lane missing`);
  if (entry.tickets.length !== tickets) {
    throw new Error(
      `${label}: expected ${tickets} tickets, got ${entry.tickets.length}`,
    );
  }
  if (entry.total_count !== total) {
    throw new Error(
      `${label}: expected total_count ${total ?? "undefined"}, got ${entry.total_count ?? "undefined"}`,
    );
  }
}

// Cross-lane move keeps total_count in sync with visible tickets.
{
  const lanes = [lane("a", ["t1", "t2"], 2), lane("b", [], 0)];
  const result = applyTicketDrop(lanes, "t1", "a", "b", 0);
  if (!result) throw new Error("cross-lane drop returned null");

  assertCounts(
    result.find((entry) => entry.status.id === "a"),
    "source lane",
    1,
    1,
  );
  assertCounts(
    result.find((entry) => entry.status.id === "b"),
    "destination lane",
    1,
    1,
  );
}

// Same-lane reorder leaves total_count unchanged.
{
  const lanes = [lane("a", ["t1", "t2", "t3"], 3), lane("b", [], 0)];
  const result = applyTicketDrop(lanes, "t1", "a", "a", 2);
  if (!result) throw new Error("same-lane drop returned null");

  const laneA = result.find((entry) => entry.status.id === "a");
  assertCounts(laneA, "reordered lane", 3, 3);
  if (laneA?.tickets.map((entry) => entry.id).join("|") !== "t2|t1|t3") {
    throw new Error("same-lane reorder produced wrong ticket order");
  }
}

// Lanes without total_count stay undefined after cross-lane move.
{
  const lanes = [lane("a", ["t1", "t2"]), lane("b", [])];
  const result = applyTicketDrop(lanes, "t1", "a", "b", 0);
  if (!result) throw new Error("cross-lane drop without totals returned null");

  assertCounts(
    result.find((entry) => entry.status.id === "a"),
    "source lane without total",
    1,
    undefined,
  );
  assertCounts(
    result.find((entry) => entry.status.id === "b"),
    "destination lane without total",
    1,
    undefined,
  );
}

console.log("board-dnd-utils: ok");
