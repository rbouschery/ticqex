import { describe, expect, it } from "vitest";
import { validateShowOpenInTicketForGroup } from "@shared/custom-fields";
import {
  createCustomFieldSchema,
  updateCustomFieldSchema,
} from "@server/lib/validation/schemas";

describe("show_open_in_ticket group validation", () => {
  it("allows contact fields to set show_open_in_ticket", () => {
    expect(validateShowOpenInTicketForGroup("contact", true)).toBeNull();
    expect(validateShowOpenInTicketForGroup("contact", false)).toBeNull();
  });

  it("rejects show_open_in_ticket for ticket fields", () => {
    expect(validateShowOpenInTicketForGroup("ticket", true)).toMatch(/contact fields/);
    expect(validateShowOpenInTicketForGroup("ticket", false)).toMatch(/contact fields/);
  });

  it("ignores undefined show_open_in_ticket", () => {
    expect(validateShowOpenInTicketForGroup("ticket", undefined)).toBeNull();
  });
});

describe("custom field API schemas", () => {
  it("accepts valid select definitions", () => {
    const parsed = createCustomFieldSchema.parse({
      group: "ticket",
      key: "plan",
      label: "Plan",
      type: "select",
      options: { values: ["starter", "pro"] },
    });
    expect(parsed.type).toBe("select");
  });

  it("accepts valid multiselect definitions", () => {
    const parsed = createCustomFieldSchema.parse({
      group: "ticket",
      key: "features",
      label: "Features",
      type: "multiselect",
      options: { values: ["api", "sso"] },
    });
    expect(parsed.type).toBe("multiselect");
  });

  it("rejects select definitions without options", () => {
    const result = createCustomFieldSchema.safeParse({
      group: "ticket",
      key: "plan",
      label: "Plan",
      type: "select",
    });
    expect(result.success).toBe(false);
  });

  it("rejects options on text fields", () => {
    const result = createCustomFieldSchema.safeParse({
      group: "contact",
      key: "notes",
      label: "Notes",
      type: "text",
      options: { values: ["x"] },
    });
    expect(result.success).toBe(false);
  });

  it("allows partial updates", () => {
    const parsed = updateCustomFieldSchema.parse({
      label: "Updated label",
      required: true,
    });
    expect(parsed.label).toBe("Updated label");
  });

  it("accepts show_open_in_ticket on contact field create", () => {
    const parsed = createCustomFieldSchema.parse({
      group: "contact",
      key: "company",
      label: "Company",
      type: "text",
      show_open_in_ticket: true,
    });
    expect(parsed.show_open_in_ticket).toBe(true);
  });

  it("rejects show_open_in_ticket on ticket field create", () => {
    const result = createCustomFieldSchema.safeParse({
      group: "ticket",
      key: "company",
      label: "Company",
      type: "text",
      show_open_in_ticket: true,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path.includes("show_open_in_ticket"))).toBe(
        true,
      );
    }
  });

  it("accepts show_open_in_ticket on contact field updates", () => {
    const parsed = updateCustomFieldSchema.parse({
      show_open_in_ticket: true,
    });
    expect(parsed.show_open_in_ticket).toBe(true);
  });
});
