import { expect } from "vitest";
import {
  listStatuses,
  reorderStatuses,
} from "@server/services/statuses";
import { describeIntegration } from "../helpers/integration";

describeIntegration("status reorder", () => {
  it("reorders columns without position unique constraint violations", async () => {
    const before = await listStatuses();
    expect(before.length).toBeGreaterThan(1);

    const reversedIds = [...before].reverse().map((status) => status.id);
    const reversed = await reorderStatuses(reversedIds);
    expect(reversed.map((status) => status.id)).toEqual(reversedIds);
    expect(reversed.map((status) => status.position)).toEqual(
      reversedIds.map((_, index) => index),
    );

    const restoredIds = before.map((status) => status.id);
    const restored = await reorderStatuses(restoredIds);
    expect(restored.map((status) => status.id)).toEqual(restoredIds);
    expect(restored.map((status) => status.position)).toEqual(
      restoredIds.map((_, index) => index),
    );
  });
});
