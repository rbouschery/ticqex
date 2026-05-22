/**
 * Smoke tests for filtered lane order merge (no server required).
 * Run: tsx shared/board-sort/merge-lane-order.test.ts
 */
import {
  mergeFilteredLaneOrder,
  mergeFilteredLaneOrderWithRemoval,
} from "./merge-lane-order";

function assertEqual(actual: string[], expected: string[], label: string) {
  const a = actual.join("|");
  const e = expected.join("|");
  if (a !== e) {
    throw new Error(`${label}: expected [${e}], got [${a}]`);
  }
}

// Full lane A,B,C,D,E — filter shows A,C,E — reorder visible to E,A,C
assertEqual(
  mergeFilteredLaneOrder(["A", "B", "C", "D", "E"], ["A", "C", "E"], ["E", "A", "C"]),
  ["E", "B", "A", "D", "C"],
  "reorder visible preserves hidden slots",
);

// Cross-lane source: remove B from visible A,B,C
assertEqual(
  mergeFilteredLaneOrderWithRemoval(
    ["A", "B", "C", "D"],
    ["A", "B", "C"],
    ["A", "C"],
    ["B"],
  ),
  ["A", "C", "D"],
  "remove visible ticket from full order",
);

console.log("merge-lane-order: ok");
