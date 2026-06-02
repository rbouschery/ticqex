import { afterAll, expect } from "vitest";
import { getBoard, getLaneTicketsPage } from "@server/services/board";
import {
  BOARD_LANE_LOAD_MORE_SIZE,
  perLaneTicketLimit,
} from "@shared/board-limits";
import {
  describeIntegration,
  LOADTEST_TITLE_PREFIX,
  NEEDLE_SECRET,
  seedMinimalBoardLoad,
  signInAsSeedAdmin,
} from "../../tests/helpers/integration";

function boardTicketIds(data: Awaited<ReturnType<typeof getBoard>>): string[] {
  return data.lanes.flatMap((lane) => lane.tickets.map((t) => t.id));
}

function totalShown(data: Awaited<ReturnType<typeof getBoard>>): number {
  return data.lanes.reduce((sum, lane) => sum + lane.tickets.length, 0);
}

describeIntegration("board search and cap", () => {
  let cleanup: (() => Promise<void>) | undefined;
  let needleId = "";
  let needleTitle = "";

  afterAll(async () => {
    await cleanup?.();
  });

  it("caps browse results, load-more, search, and filters", async () => {
    const seed = await seedMinimalBoardLoad();
    cleanup = seed.cleanup;
    needleId = seed.needleId;
    needleTitle = seed.needleTitle;

    const { userId } = await signInAsSeedAdmin();

    const browse = await getBoard(userId);
    const laneCount = browse.lanes.length;
    const perLane = perLaneTicketLimit(laneCount);
    const maxShown = perLane * laneCount;

    expect(browse.capped).toBe(true);

    const shown = totalShown(browse);
    expect(shown).toBeLessThanOrEqual(maxShown);

    for (const lane of browse.lanes) {
      expect(lane.tickets.length).toBeLessThanOrEqual(perLane);
    }

    const loadtestOnBoard = browse.lanes
      .flatMap((lane) => lane.tickets)
      .filter((t) => t.title.startsWith(LOADTEST_TITLE_PREFIX));
    expect(loadtestOnBoard.some((t) => t.title === needleTitle)).toBe(false);

    const cappedLane = browse.lanes.find(
      (lane) =>
        lane.total_count !== undefined && lane.total_count > lane.tickets.length,
    );
    expect(cappedLane).toBeDefined();

    const firstPageIds = new Set(cappedLane!.tickets.map((ticket) => ticket.id));
    const loadMore = await getLaneTicketsPage(
      cappedLane!.status.id,
      cappedLane!.tickets.length,
      BOARD_LANE_LOAD_MORE_SIZE,
      userId,
    );
    expect(loadMore.tickets.length).toBeGreaterThan(0);
    expect(loadMore.tickets.some((ticket) => firstPageIds.has(ticket.id))).toBe(
      false,
    );
    expect(loadMore.total_count).toBe(cappedLane!.total_count);
    expect(loadMore.offset).toBe(cappedLane!.tickets.length);

    const needleSearch = await getBoard(userId, [], undefined, NEEDLE_SECRET);
    expect(needleSearch.search_active).toBe(true);
    const needleMatch = needleSearch.lanes
      .flatMap((lane) => lane.tickets)
      .find((t) => t.title === needleTitle);
    expect(needleMatch).toBeDefined();

    const titleNoise = await getBoard(
      userId,
      [],
      undefined,
      LOADTEST_TITLE_PREFIX,
    );
    expect(boardTicketIds(titleNoise).length).toBeGreaterThanOrEqual(10);

    const taskFilter = [{ field: "kind", op: "eq", value: "task" }] as const;
    const filtered = await getBoard(userId, taskFilter);
    expect(filtered.filter_active).toBe(true);
    expect(
      filtered.lanes.some((lane) =>
        lane.tickets.some((t) => t.kind !== "task"),
      ),
    ).toBe(false);
    expect(boardTicketIds(filtered)).not.toContain(needleId);

    const filteredSearch = await getBoard(
      userId,
      taskFilter,
      undefined,
      NEEDLE_SECRET,
    );
    expect(boardTicketIds(filteredSearch)).toHaveLength(0);
  });
});
