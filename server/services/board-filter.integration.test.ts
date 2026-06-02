import { afterEach, expect } from "vitest";
import { parseTicketFilterParam } from "@server/domain/ticket-filter";
import { ApiError } from "@server/lib/errors";
import { getBoard } from "@server/services/board";
import { ticketMatchesFilter } from "@shared/ticket-filter/evaluate";
import type { TicketFilter } from "@shared/ticket-filter/schema";
import {
  adminDb,
  describeIntegration,
  insertMinimalTicket,
  signInAsSeedAdmin,
} from "../../tests/helpers/integration";

function boardTicketIds(data: Awaited<ReturnType<typeof getBoard>>): string[] {
  return data.lanes.flatMap((lane) => lane.tickets.map((t) => t.id));
}

describeIntegration("board filter", () => {
  const createdIds: string[] = [];

  afterEach(async () => {
    if (createdIds.length) {
      await adminDb().from("tickets").delete().in("id", [...createdIds]);
      createdIds.length = 0;
    }
  });

  it("filters board lanes and validates filter parsing", async () => {
    const { userId } = await signInAsSeedAdmin();

    const task = await insertMinimalTicket({
      title: `Board filter integration ${Date.now()}`,
      kind: "task",
      assignee_id: userId,
    });
    const unassigned = await insertMinimalTicket({
      title: `Board filter unassigned ${Date.now()}`,
      kind: "task",
      assignee_id: null,
    });
    createdIds.push(task.id, unassigned.id);

    const unfiltered = await getBoard(userId);
    expect(boardTicketIds(unfiltered)).toContain(task.id);

    const hideTaskFilter: TicketFilter = [
      { field: "kind", op: "eq", value: "conversation" },
    ];
    const hideResult = await getBoard(userId, hideTaskFilter);
    expect(hideResult.filter_active).toBe(true);
    expect(boardTicketIds(hideResult)).not.toContain(task.id);

    const showTaskFilter: TicketFilter = [
      { field: "kind", op: "neq", value: "conversation" },
    ];
    const showResult = await getBoard(userId, showTaskFilter);
    expect(boardTicketIds(showResult)).toContain(task.id);

    const assigneeEmptyFilter: TicketFilter = [{ field: "assignee_id", op: "empty" }];
    const emptyAssigneeResult = await getBoard(userId, assigneeEmptyFilter);
    const emptyAssigneeIds = boardTicketIds(emptyAssigneeResult);
    expect(emptyAssigneeIds).toContain(unassigned.id);
    expect(emptyAssigneeIds).not.toContain(task.id);

    const multiFilter: TicketFilter = [
      { field: "kind", op: "eq", value: "task" },
      { field: "origin", op: "in", values: ["manual"] },
    ];
    const multiResult = await getBoard(userId, multiFilter);
    const multiIds = boardTicketIds(multiResult);
    expect(multiIds).toContain(task.id);
    expect(multiIds).toContain(unassigned.id);

    const laneWithTotals = hideResult.lanes.find(
      (lane) => lane.total_count !== undefined,
    );
    expect(laneWithTotals?.total_count).toBeDefined();

    const emptyOk = hideResult.lanes.every(
      (lane) =>
        lane.total_count === undefined || lane.total_count >= lane.tickets.length,
    );
    expect(emptyOk).toBe(true);

    expect(() => parseTicketFilterParam("not-json")).toThrow(ApiError);

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
    expect(inMemoryOk).toBe(true);
  });
});
