import { describe, expect, it } from "vitest";
import { patchSettingsSchema } from "@server/lib/validation/schemas";
import { buildTicketContextMarkdown } from "@server/services/ticket-context";
import {
  DEFAULT_COPY_CONTEXT_SETTINGS,
  mergeCopyContextPatch,
  resolveCopyContextSettings,
} from "@shared/copy-context";

describe("resolveCopyContextSettings", () => {
  it("returns defaults for missing or invalid values", () => {
    expect(resolveCopyContextSettings(undefined)).toEqual(
      DEFAULT_COPY_CONTEXT_SETTINGS,
    );
    expect(resolveCopyContextSettings(null)).toEqual(DEFAULT_COPY_CONTEXT_SETTINGS);
    expect(resolveCopyContextSettings("invalid")).toEqual(
      DEFAULT_COPY_CONTEXT_SETTINGS,
    );
  });

  it("merges partial objects with defaults", () => {
    expect(resolveCopyContextSettings({ visible: false })).toEqual({
      ...DEFAULT_COPY_CONTEXT_SETTINGS,
      visible: false,
    });
  });
});

describe("mergeCopyContextPatch", () => {
  it("deep-merges onto existing settings", () => {
    const merged = mergeCopyContextPatch(
      { visible: true, append_contact: false, prepend_text: "Hi" },
      { append_custom_fields: false },
    );

    expect(merged).toEqual({
      ...DEFAULT_COPY_CONTEXT_SETTINGS,
      append_contact: false,
      append_custom_fields: false,
      prepend_text: "Hi",
    });
  });
});

describe("patchSettingsSchema copy_context", () => {
  it("accepts partial copy_context patches", () => {
    const parsed = patchSettingsSchema.parse({
      copy_context: { visible: false },
    });

    expect(parsed.copy_context).toEqual({ visible: false });
  });
});

describe("buildTicketContextMarkdown", () => {
  const ticket = {
    id: "ticket-1",
    title: "Billing issue",
    kind: "task" as const,
    body: "Customer cannot update card.",
    contact_address: "user@example.com",
    contact_id: "contact-1",
    contact: { id: "contact-1", username: "user@example.com" },
    status: { id: "status-1", name: "Open" },
    custom_fields: { priority: "High" },
    tags: [{ id: "tag-1", name: "billing", color: "#000" }],
    messages: [],
  };

  it("includes prepend text and ticket custom fields by default", () => {
    const markdown = buildTicketContextMarkdown(
      ticket,
      {
        ...DEFAULT_COPY_CONTEXT_SETTINGS,
        prepend_text: "Project: Acme",
      },
      [],
      [{ id: "f1", key: "priority", label: "Priority", type: "text", group: "ticket", options: null, required: false, position: 0, created_at: "", updated_at: "" }],
      {},
      new Map(),
    );

    expect(markdown.startsWith("Project: Acme\n\n# Billing issue")).toBe(true);
    expect(markdown).toContain("**Priority:** High");
    expect(markdown).toContain("**Contact:** user@example.com");
  });

  it("formats contact custom fields with shared value formatting", () => {
    const markdown = buildTicketContextMarkdown(
      ticket,
      DEFAULT_COPY_CONTEXT_SETTINGS,
      [
        {
          id: "c1",
          key: "tier",
          label: "Tier",
          type: "text",
          group: "contact",
          options: null,
          required: false,
          position: 0,
          show_open_in_ticket: false,
          created_at: "",
          updated_at: "",
        },
        {
          id: "c2",
          key: "active",
          label: "Active",
          type: "boolean",
          group: "contact",
          options: null,
          required: false,
          position: 1,
          show_open_in_ticket: false,
          created_at: "",
          updated_at: "",
        },
        {
          id: "c3",
          key: "tags",
          label: "Tags",
          type: "multiselect",
          group: "contact",
          options: null,
          required: false,
          position: 2,
          show_open_in_ticket: false,
          created_at: "",
          updated_at: "",
        },
      ],
      [],
      { tier: "Gold", active: false, tags: ["vip", "beta"], notes: "   " },
      new Map(),
    );

    expect(markdown).toContain("**Tier:** Gold");
    expect(markdown).toContain("**Active:** No");
    expect(markdown).toContain("**Tags:** vip, beta");
    expect(markdown).not.toContain("**Notes:**");
  });

  it("omits contact and custom fields when disabled", () => {
    const markdown = buildTicketContextMarkdown(
      ticket,
      {
        ...DEFAULT_COPY_CONTEXT_SETTINGS,
        append_contact: false,
        append_custom_fields: false,
      },
      [],
      [],
      {},
      new Map(),
    );

    expect(markdown).not.toContain("**Contact:**");
    expect(markdown).not.toContain("**Priority:**");
    expect(markdown).toContain("**Status:** Open");
  });
});
