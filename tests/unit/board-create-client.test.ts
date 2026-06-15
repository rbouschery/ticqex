import { describe, expect, it } from "vitest";
import { buildOptimisticBoardTicket } from "@/components/board/board-create-client";

describe("buildOptimisticBoardTicket", () => {
  it("marks temporary tickets as pending so the board does not open them", () => {
    const ticket = buildOptimisticBoardTicket(
      {
        title: "New issue",
        body: "Needs attention",
        statusId: "todo",
        tags: [],
      },
      "temporary-id",
      "2026-06-15T09:00:00.000Z",
    );

    expect(ticket.id).toBe("temporary-id");
    expect(ticket.is_pending).toBe(true);
  });
});
