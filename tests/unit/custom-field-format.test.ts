import { describe, expect, it } from "vitest";
import {
  formatCustomFieldDisplayValue,
  formatCustomFieldValue,
  hasCustomFieldValue,
} from "@shared/custom-fields/format";

describe("hasCustomFieldValue", () => {
  it("treats nullish, blank, and empty collections as absent", () => {
    expect(hasCustomFieldValue(null)).toBe(false);
    expect(hasCustomFieldValue(undefined)).toBe(false);
    expect(hasCustomFieldValue("")).toBe(false);
    expect(hasCustomFieldValue("   ")).toBe(false);
    expect(hasCustomFieldValue([])).toBe(false);
  });

  it("treats populated values as present", () => {
    expect(hasCustomFieldValue("x")).toBe(true);
    expect(hasCustomFieldValue(["a"])).toBe(true);
    expect(hasCustomFieldValue(false)).toBe(true);
    expect(hasCustomFieldValue(0)).toBe(true);
  });
});

describe("formatCustomFieldValue", () => {
  it("renders display empty values as an em dash", () => {
    expect(formatCustomFieldDisplayValue("text", null)).toBe("—");
    expect(formatCustomFieldValue("text", "", "display")).toBe("—");
  });

  it("renders export empty values as blank text", () => {
    expect(formatCustomFieldValue("text", null, "export")).toBe("");
    expect(formatCustomFieldValue("text", "   ", "export")).toBe("");
  });

  it("formats booleans", () => {
    expect(formatCustomFieldValue("boolean", true)).toBe("Yes");
    expect(formatCustomFieldValue("boolean", false)).toBe("No");
  });

  it("formats dates", () => {
    const formatted = formatCustomFieldValue("date", "2024-06-15");
    expect(formatted).toMatch(/Jun/);
    expect(formatted).toMatch(/15/);
    expect(formatted).toMatch(/2024/);
  });

  it("formats json values", () => {
    expect(formatCustomFieldValue("json", '{"a":1}')).toBe('{"a":1}');
    expect(formatCustomFieldValue("json", { a: 1 })).toBe('{"a":1}');
  });

  it("formats multiselect values", () => {
    expect(formatCustomFieldValue("multiselect", ["a", "b"])).toBe("a, b");
    expect(formatCustomFieldValue("multiselect", "solo")).toBe("solo");
  });

  it("formats plain scalars", () => {
    expect(formatCustomFieldValue("text", "hello")).toBe("hello");
    expect(formatCustomFieldValue("number", 42)).toBe("42");
  });
});
