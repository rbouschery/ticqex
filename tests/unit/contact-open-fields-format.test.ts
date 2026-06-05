import { describe, expect, it } from "vitest";
import { resolveOpenContactFieldsForDisplay } from "@shared/custom-fields/format";

describe("resolveOpenContactFieldsForDisplay", () => {
  it("returns only show_open_in_ticket fields in position order", () => {
    const result = resolveOpenContactFieldsForDisplay(
      [
        {
          key: "hidden",
          label: "Hidden",
          type: "text",
          position: 0,
          show_open_in_ticket: false,
        },
        {
          key: "tier",
          label: "Tier",
          type: "text",
          position: 2,
          show_open_in_ticket: true,
        },
        {
          key: "plan",
          label: "Plan",
          type: "text",
          position: 1,
          show_open_in_ticket: true,
        },
      ],
      { tier: "Gold" },
    );

    expect(result).toEqual([
      { label: "Plan", value: "—" },
      { label: "Tier", value: "Gold" },
    ]);
  });

  it("formats field types for board open-field display", () => {
    const result = resolveOpenContactFieldsForDisplay(
      [
        {
          key: "active",
          label: "Active",
          type: "boolean",
          position: 0,
          show_open_in_ticket: true,
        },
        {
          key: "joined",
          label: "Joined",
          type: "date",
          position: 1,
          show_open_in_ticket: true,
        },
        {
          key: "meta",
          label: "Meta",
          type: "json",
          position: 2,
          show_open_in_ticket: true,
        },
        {
          key: "plans",
          label: "Plans",
          type: "multiselect",
          position: 3,
          show_open_in_ticket: true,
        },
      ],
      {
        active: false,
        joined: "2024-01-10",
        meta: { tier: "gold" },
        plans: ["pro", "support"],
      },
    );

    expect(result[0]).toEqual({ label: "Active", value: "No" });
    expect(result[1]?.value).toMatch(/Jan/);
    expect(result[2]).toEqual({ label: "Meta", value: '{"tier":"gold"}' });
    expect(result[3]).toEqual({ label: "Plans", value: "pro, support" });
  });
});
