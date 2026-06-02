import { describe, expect, it } from "vitest";
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
    card_surface: {
      badges: [],
      warning_badges: [],
      preview: "",
      chips: [],
    },
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

describe("applyTicketDrop", () => {
  it("keeps total_count in sync with visible tickets on cross-lane move", () => {
    const lanes = [lane("a", ["t1", "t2"], 2), lane("b", [], 0)];
    const result = applyTicketDrop(lanes, "t1", "a", "b", 0);

    expect(result).not.toBeNull();

    const sourceLane = result!.find((entry) => entry.status.id === "a");
    const destinationLane = result!.find((entry) => entry.status.id === "b");

    expect(sourceLane?.tickets).toHaveLength(1);
    expect(sourceLane?.total_count).toBe(1);
    expect(destinationLane?.tickets).toHaveLength(1);
    expect(destinationLane?.total_count).toBe(1);
  });

  it("leaves total_count unchanged on same-lane reorder", () => {
    const lanes = [lane("a", ["t1", "t2", "t3"], 3), lane("b", [], 0)];
    const result = applyTicketDrop(lanes, "t1", "a", "a", 2);

    expect(result).not.toBeNull();

    const laneA = result!.find((entry) => entry.status.id === "a");
    expect(laneA?.tickets).toHaveLength(3);
    expect(laneA?.total_count).toBe(3);
    expect(laneA?.tickets.map((entry) => entry.id)).toEqual(["t2", "t1", "t3"]);
  });

  it("leaves total_count undefined when lanes do not track totals", () => {
    const lanes = [lane("a", ["t1", "t2"]), lane("b", [])];
    const result = applyTicketDrop(lanes, "t1", "a", "b", 0);

    expect(result).not.toBeNull();

    const sourceLane = result!.find((entry) => entry.status.id === "a");
    const destinationLane = result!.find((entry) => entry.status.id === "b");

    expect(sourceLane?.tickets).toHaveLength(1);
    expect(sourceLane?.total_count).toBeUndefined();
    expect(destinationLane?.tickets).toHaveLength(1);
    expect(destinationLane?.total_count).toBeUndefined();
  });
});
