import { describe, expect, it } from "vitest";
import {
  buildContactFieldRows,
  hasCustomFieldDisplayValue,
  isContactFieldProminent,
  resolveContactFieldVisibility,
} from "@shared/custom-fields/contact-visibility";

type TestDef = {
  id: string;
  key: string;
  label: string;
  type: string;
  position: number;
  show_open_in_ticket: boolean;
};

function def(
  key: string,
  position: number,
  showOpen = false,
): TestDef {
  return {
    id: key,
    key,
    label: key,
    type: "text",
    position,
    show_open_in_ticket: showOpen,
  };
}

describe("contact field visibility", () => {
  it("detects display values", () => {
    expect(hasCustomFieldDisplayValue("")).toBe(false);
    expect(hasCustomFieldDisplayValue("   ")).toBe(false);
    expect(hasCustomFieldDisplayValue(null)).toBe(false);
    expect(hasCustomFieldDisplayValue([])).toBe(false);
    expect(hasCustomFieldDisplayValue(["a"])).toBe(true);
    expect(hasCustomFieldDisplayValue("x")).toBe(true);
    expect(hasCustomFieldDisplayValue(false)).toBe(true);
  });

  it("marks prominent fields by value or show_open_in_ticket", () => {
    expect(isContactFieldProminent(def("a", 0), "filled")).toBe(true);
    expect(isContactFieldProminent(def("a", 0, true), null)).toBe(true);
    expect(isContactFieldProminent(def("a", 0), null)).toBe(false);
  });

  it("shows only prominent rows by default", () => {
    const rows = buildContactFieldRows(
      [def("open", 0, true), def("hidden", 1), def("filled", 2)],
      { filled: "yes" },
    );
    const result = resolveContactFieldVisibility(rows, false);
    expect(result.visibleRows.map((row) => row.def.key)).toEqual([
      "open",
      "filled",
    ]);
    expect(result.hasHiddenFields).toBe(true);
    expect(result.hiddenCount).toBe(1);
  });

  it("shows all rows when expanded", () => {
    const rows = buildContactFieldRows(
      [def("open", 0, true), def("hidden", 1)],
      {},
    );
    const result = resolveContactFieldVisibility(rows, true);
    expect(result.visibleRows).toHaveLength(2);
    expect(result.hasHiddenFields).toBe(true);
  });
});
