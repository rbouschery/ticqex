import { expect } from "vitest";
import { listTags, updateTag } from "@server/services/tags";
import { describeIntegration } from "../helpers/integration";

describeIntegration("tags API", () => {
  it("updates tag color without error", async () => {
    const tags = await listTags();
    expect(tags.length).toBeGreaterThan(0);

    const tag = tags[0]!;
    const nextColor = tag.color === "#112233" ? "#445566" : "#112233";

    const updated = await updateTag(tag.id, { color: nextColor });
    expect(updated.color).toBe(nextColor);

    await updateTag(tag.id, { color: tag.color });
  });
});
