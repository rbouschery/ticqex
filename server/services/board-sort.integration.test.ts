import { expect } from "vitest";
import { getBoard } from "@server/services/board";
import { moveTicketOnBoard } from "@server/services/board-move";
import { setLaneOrder } from "@server/services/board-lane-orders";
import { describeIntegration, signInAsSeedAdmin } from "../../tests/helpers/integration";

describeIntegration("board sort", () => {
  it("applies created_at, manual, and cross-lane ordering", async () => {
    const { userId } = await signInAsSeedAdmin();

    const defaultBoard = await getBoard(userId);
    const lane = defaultBoard.lanes.find((entry) => entry.tickets.length >= 2);
    if (!lane) return;

    const createdSort = await getBoard(userId, [], {
      mode: "created_at",
      direction: "asc",
    });
    const createdLane = createdSort.lanes.find(
      (entry) => entry.tickets.length >= 2,
    );
    if (createdLane) {
      const createdTimestamps = createdLane.tickets.map((t) => t.created_at);
      const createdSorted = [...createdTimestamps].sort();
      expect(createdTimestamps.join("|")).toBe(createdSorted.join("|"));
    }

    const originalIds = lane.tickets.map((ticket) => ticket.id);
    const reversed = [...originalIds].reverse();
    await setLaneOrder(userId, lane.status.id, reversed);

    const manualBoard = await getBoard(userId, [], { mode: "manual" });
    const manualLane = manualBoard.lanes.find(
      (entry) => entry.status.id === lane.status.id,
    );
    expect(manualLane).toBeDefined();
    const manualIds = manualLane!.tickets.map((ticket) => ticket.id);
    const expectedPrefix = reversed.filter((id) => manualIds.includes(id));
    const actualPrefix = manualIds.filter((id) => reversed.includes(id));
    expect(actualPrefix.join("|")).toBe(expectedPrefix.join("|"));

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
      const targetIds = [ticketId, ...targetLane.tickets.map((ticket) => ticket.id)];

      await moveTicketOnBoard(userId, {
        ticket_id: ticketId,
        from_status_id: sourceLane.status.id,
        to_status_id: targetLane.status.id,
        source_ticket_ids: sourceIds,
        target_ticket_ids: targetIds,
      });

      const afterEditedSort = await getBoard(userId);
      const editedLane = afterEditedSort.lanes.find(
        (entry) => entry.status.id === targetLane.status.id,
      );
      const movedTicket = editedLane?.tickets.find((ticket) => ticket.id === ticketId);
      expect(movedTicket).toBeDefined();
      expect(editedLane!.tickets[0]?.id).toBe(ticketId);

      const afterMove = await getBoard(userId, [], { mode: "manual" });
      const movedFrom = afterMove.lanes.find(
        (entry) => entry.status.id === sourceLane.status.id,
      );
      const movedTo = afterMove.lanes.find(
        (entry) => entry.status.id === targetLane.status.id,
      );
      expect(movedFrom?.tickets.some((ticket) => ticket.id === ticketId)).toBe(
        false,
      );
      expect(movedTo?.tickets.some((ticket) => ticket.id === ticketId)).toBe(true);

      const restoreSourceIds = [...sourceIds, ticketId];
      const restoreTargetIds = targetLane.tickets.map((ticket) => ticket.id);
      await moveTicketOnBoard(userId, {
        ticket_id: ticketId,
        from_status_id: targetLane.status.id,
        to_status_id: sourceLane.status.id,
        source_ticket_ids: restoreTargetIds,
        target_ticket_ids: restoreSourceIds,
      });
    }

  });
});
