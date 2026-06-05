import { describe, expect, it } from "vitest";
import {
  getLaneSortCacheEntry,
  invalidateLaneSortCache,
  setLaneSortCacheEntry,
} from "@server/services/board-lane-sort-cache";

describe("board lane sort cache", () => {
  it("invalidates entries for the affected status", () => {
    const statusId = "11111111-1111-4111-8111-111111111111";
    const otherStatusId = "22222222-2222-4222-8222-222222222222";
    const key = `${statusId}:{"mode":"manual"}::all`;
    const otherKey = `${otherStatusId}:{"mode":"manual"}::all`;

    setLaneSortCacheEntry(key, ["ticket-a"]);
    setLaneSortCacheEntry(otherKey, ["ticket-b"]);

    invalidateLaneSortCache([statusId]);

    expect(getLaneSortCacheEntry(key)).toBeNull();
    expect(getLaneSortCacheEntry(otherKey)).toEqual(["ticket-b"]);
  });
});
