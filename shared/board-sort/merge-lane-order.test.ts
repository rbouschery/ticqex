import { describe, expect, it } from "vitest";
import {
  mergeFilteredLaneOrder,
  mergeFilteredLaneOrderWithRemoval,
} from "./merge-lane-order";

describe("mergeFilteredLaneOrder", () => {
  it("reorders visible tickets while preserving hidden slots", () => {
    expect(
      mergeFilteredLaneOrder(
        ["A", "B", "C", "D", "E"],
        ["A", "C", "E"],
        ["E", "A", "C"],
      ),
    ).toEqual(["E", "B", "A", "D", "C"]);
  });
});

describe("mergeFilteredLaneOrderWithRemoval", () => {
  it("removes a visible ticket from the full order", () => {
    expect(
      mergeFilteredLaneOrderWithRemoval(
        ["A", "B", "C", "D"],
        ["A", "B", "C"],
        ["A", "C"],
        ["B"],
      ),
    ).toEqual(["A", "C", "D"]);
  });
});
