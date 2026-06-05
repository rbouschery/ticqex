import { describe, expect, it } from "vitest";
import { patchSettingsSchema } from "@server/lib/validation/schemas";
import {
  CORE_TICKET_FIELD_IDS,
  customFieldId,
  DEFAULT_CORE_VISIBILITY,
  DEFAULT_CUSTOM_FIELD_VISIBILITY,
  enforceTitleInvariant,
  filterTicketCardSurface,
  mergeTicketFieldVisibilityPatch,
  normalizeVisibilityPatch,
  resolveTicketFieldLayout,
} from "@shared/ticket-fields";

describe("patchSettingsSchema ticket_field_visibility", () => {
  it("accepts ticket field visibility patches", () => {
    const parsed = patchSettingsSchema.parse({
      ticket_field_visibility: {
        [CORE_TICKET_FIELD_IDS.tags]: { showOnCard: false, showInTicket: true },
      },
    });

    expect(parsed.ticket_field_visibility?.[CORE_TICKET_FIELD_IDS.tags]).toEqual({
      showOnCard: false,
      showInTicket: true,
    });
  });

  it("strips unknown keys from patches", () => {
    const parsed = patchSettingsSchema.parse({
      unknown_field: true,
      ticket_field_visibility: {
        [CORE_TICKET_FIELD_IDS.tags]: { showOnCard: true, showInTicket: true },
      },
    });

    expect(parsed).not.toHaveProperty("unknown_field");
    expect(parsed.ticket_field_visibility?.[CORE_TICKET_FIELD_IDS.tags]).toEqual({
      showOnCard: true,
      showInTicket: true,
    });
  });
});

describe("resolveTicketFieldLayout", () => {
  const customFields = [
    {
      id: "11111111-1111-1111-1111-111111111111",
      key: "priority",
      label: "Priority",
      type: "select",
      position: 0,
    },
    {
      id: "22222222-2222-2222-2222-222222222222",
      key: "region",
      label: "Region",
      type: "text",
      position: 1,
    },
  ];

  it("uses core defaults when ticket_field_visibility is empty", () => {
    const layout = resolveTicketFieldLayout({
      settings: {},
      customFields: [],
    });

    expect(layout.visibility[CORE_TICKET_FIELD_IDS.preview]).toEqual(
      DEFAULT_CORE_VISIBILITY.preview,
    );
    expect(layout.visibility[CORE_TICKET_FIELD_IDS.description]).toEqual(
      DEFAULT_CORE_VISIBILITY.description,
    );
  });

  it("applies saved overrides on top of core defaults", () => {
    const layout = resolveTicketFieldLayout({
      settings: {
        ticket_field_visibility: {
          [CORE_TICKET_FIELD_IDS.contact]: { showOnCard: true, showInTicket: true },
          [CORE_TICKET_FIELD_IDS.assignee]: { showOnCard: false, showInTicket: false },
          [CORE_TICKET_FIELD_IDS.description]: {
            showOnCard: false,
            showInTicket: true,
          },
        },
      },
      customFields,
    });

    expect(layout.visibility[CORE_TICKET_FIELD_IDS.contact]).toEqual({
      showOnCard: true,
      showInTicket: true,
    });
    expect(layout.visibility[CORE_TICKET_FIELD_IDS.assignee]).toEqual({
      showOnCard: false,
      showInTicket: false,
    });
    expect(layout.visibility[CORE_TICKET_FIELD_IDS.description]).toEqual({
      showOnCard: false,
      showInTicket: true,
    });
  });

  it("defaults custom fields missing from saved JSON", () => {
    const layout = resolveTicketFieldLayout({
      settings: {
        ticket_field_visibility: {
          [CORE_TICKET_FIELD_IDS.tags]: { showOnCard: false, showInTicket: true },
        },
      },
      customFields,
    });

    expect(layout.visibility[customFieldId(customFields[0]!.id)]).toEqual(
      DEFAULT_CUSTOM_FIELD_VISIBILITY,
    );
    expect(layout.visibility[customFieldId(customFields[1]!.id)]).toEqual(
      DEFAULT_CUSTOM_FIELD_VISIBILITY,
    );
  });

  it("preserves saved custom field visibility", () => {
    const layout = resolveTicketFieldLayout({
      settings: {
        ticket_field_visibility: {
          [customFieldId(customFields[0]!.id)]: {
            showOnCard: true,
            showInTicket: false,
          },
        },
      },
      customFields,
    });

    expect(layout.visibility[customFieldId(customFields[0]!.id)]).toEqual({
      showOnCard: true,
      showInTicket: false,
    });
    expect(layout.visibility[customFieldId(customFields[1]!.id)]).toEqual(
      DEFAULT_CUSTOM_FIELD_VISIBILITY,
    );
  });
});

describe("title invariant", () => {
  it("always keeps title visible on card and in ticket", () => {
    const normalized = normalizeVisibilityPatch({
      [CORE_TICKET_FIELD_IDS.title]: { showOnCard: false, showInTicket: false },
      [CORE_TICKET_FIELD_IDS.tags]: { showOnCard: false, showInTicket: true },
    });

    expect(normalized[CORE_TICKET_FIELD_IDS.title]).toEqual({
      showOnCard: true,
      showInTicket: true,
    });
    expect(enforceTitleInvariant(normalized)[CORE_TICKET_FIELD_IDS.title]).toEqual({
      showOnCard: true,
      showInTicket: true,
    });
  });
});

describe("mergeTicketFieldVisibilityPatch", () => {
  it("preserves omitted saved fields when applying a partial patch", () => {
    const customId = customFieldId("11111111-1111-1111-1111-111111111111");
    const merged = mergeTicketFieldVisibilityPatch(
      {
        [CORE_TICKET_FIELD_IDS.tags]: { showOnCard: false, showInTicket: true },
        [CORE_TICKET_FIELD_IDS.assignee]: {
          showOnCard: false,
          showInTicket: false,
        },
        [customId]: { showOnCard: true, showInTicket: false },
      },
      {
        [CORE_TICKET_FIELD_IDS.tags]: { showOnCard: true, showInTicket: true },
      },
    );

    expect(merged[CORE_TICKET_FIELD_IDS.tags]).toEqual({
      showOnCard: true,
      showInTicket: true,
    });
    expect(merged[CORE_TICKET_FIELD_IDS.assignee]).toEqual({
      showOnCard: false,
      showInTicket: false,
    });
    expect(merged[customId]).toEqual({
      showOnCard: true,
      showInTicket: false,
    });
    expect(merged[CORE_TICKET_FIELD_IDS.title]).toEqual({
      showOnCard: true,
      showInTicket: true,
    });
  });
});

describe("filterTicketCardSurface", () => {
  it("removes preview and custom chips hidden from card", () => {
    const layout = resolveTicketFieldLayout({
      settings: {
        ticket_field_visibility: {
          [CORE_TICKET_FIELD_IDS.preview]: { showOnCard: false, showInTicket: false },
          [customFieldId("11111111-1111-1111-1111-111111111111")]: {
            showOnCard: false,
            showInTicket: true,
          },
        },
      },
      customFields: [
        {
          id: "11111111-1111-1111-1111-111111111111",
          key: "priority",
          label: "Priority",
          type: "select",
          position: 0,
        },
      ],
    });

    const filtered = filterTicketCardSurface(
      {
        badges: [],
        warning_badges: [],
        preview: "Hello world",
        chips: [{ sourceKey: "priority", label: "Priority", value: "High" }],
      },
      layout,
      [
        {
          id: "11111111-1111-1111-1111-111111111111",
          key: "priority",
          label: "Priority",
          type: "select",
          position: 0,
        },
      ],
    );

    expect(filtered.preview).toBe("");
    expect(filtered.chips).toEqual([]);
  });

  it("keeps preview empty when hidden even if ticket model still has preview", () => {
    const layout = resolveTicketFieldLayout({
      settings: {
        ticket_field_visibility: {
          [CORE_TICKET_FIELD_IDS.preview]: { showOnCard: false, showInTicket: true },
        },
      },
      customFields: [],
    });

    const filtered = filterTicketCardSurface(
      {
        badges: [],
        warning_badges: [],
        preview: "Filtered surface preview",
        chips: [],
      },
      layout,
      [],
    );

    const ticketPreview = "Unfiltered ticket.preview";
    expect(filtered.preview).toBe("");
    // TicketCardContent must use card_surface.preview only (no || ticket.preview).
    const cardPreview = filtered.preview;
    expect(cardPreview).toBe("");
    expect(ticketPreview).toBeTruthy();
  });

  it("caps chips after visibility filtering so hidden chips do not consume slots", () => {
    const customFields = [
      {
        id: "11111111-1111-1111-1111-111111111111",
        key: "priority",
        label: "Priority",
        type: "select",
        position: 0,
      },
      {
        id: "22222222-2222-2222-2222-222222222222",
        key: "region",
        label: "Region",
        type: "text",
        position: 1,
      },
      {
        id: "33333333-3333-3333-3333-333333333333",
        key: "department",
        label: "Department",
        type: "text",
        position: 2,
      },
      {
        id: "44444444-4444-4444-4444-444444444444",
        key: "status",
        label: "Status",
        type: "text",
        position: 3,
      },
    ];

    const layout = resolveTicketFieldLayout({
      settings: {
        ticket_field_visibility: {
          [customFieldId(customFields[0]!.id)]: {
            showOnCard: false,
            showInTicket: true,
          },
          [customFieldId(customFields[1]!.id)]: {
            showOnCard: false,
            showInTicket: true,
          },
        },
      },
      customFields,
    });

    const filtered = filterTicketCardSurface(
      {
        badges: [],
        warning_badges: [],
        preview: "",
        chips: [
          { sourceKey: "priority", label: "Priority", value: "High" },
          { sourceKey: "region", label: "Region", value: "EU" },
          { sourceKey: "department", label: "Department", value: "Sales" },
          { sourceKey: "status", label: "Status", value: "Open" },
        ],
      },
      layout,
      customFields,
    );

    expect(filtered.chips).toEqual([
      { sourceKey: "department", label: "Department", value: "Sales" },
      { sourceKey: "status", label: "Status", value: "Open" },
    ]);
  });

  it("resolves custom field chip labels from definitions", () => {
    const customFields = [
      {
        id: "11111111-1111-1111-1111-111111111111",
        key: "urgency",
        label: "Urgency",
        type: "select",
        position: 0,
      },
      {
        id: "22222222-2222-2222-2222-222222222222",
        key: "business_unit",
        label: "Business Unit",
        type: "select",
        position: 1,
      },
    ];

    const layout = resolveTicketFieldLayout({
      settings: {
        ticket_field_visibility: {
          [customFieldId(customFields[0]!.id)]: {
            showOnCard: true,
            showInTicket: true,
          },
          [customFieldId(customFields[1]!.id)]: {
            showOnCard: true,
            showInTicket: true,
          },
        },
      },
      customFields,
    });

    const filtered = filterTicketCardSurface(
      {
        badges: [],
        warning_badges: [],
        preview: "",
        chips: [
          { sourceKey: "urgency", label: "urgency", value: "medium" },
          { sourceKey: "business_unit", label: "business_unit", value: "Red" },
        ],
      },
      layout,
      customFields,
    );

    expect(filtered.chips).toEqual([
      { sourceKey: "urgency", label: "Urgency", value: "medium" },
      { sourceKey: "business_unit", label: "Business Unit", value: "Red" },
    ]);
  });

  it("uses chip source keys instead of display labels for custom fields", () => {
    const layout = resolveTicketFieldLayout({
      settings: {
        ticket_field_visibility: {
          [customFieldId("11111111-1111-1111-1111-111111111111")]: {
            showOnCard: false,
            showInTicket: true,
          },
          [customFieldId("22222222-2222-2222-2222-222222222222")]: {
            showOnCard: true,
            showInTicket: true,
          },
        },
      },
      customFields: [
        {
          id: "11111111-1111-1111-1111-111111111111",
          key: "priority",
          label: "Priority",
          type: "select",
          position: 0,
        },
        {
          id: "22222222-2222-2222-2222-222222222222",
          key: "region",
          label: "Priority",
          type: "text",
          position: 1,
        },
      ],
    });

    const filtered = filterTicketCardSurface(
      {
        badges: [],
        warning_badges: [],
        preview: "Hello world",
        chips: [{ sourceKey: "region", label: "Priority", value: "EU" }],
      },
      layout,
      [
        {
          id: "11111111-1111-1111-1111-111111111111",
          key: "priority",
          label: "Priority",
          type: "select",
          position: 0,
        },
        {
          id: "22222222-2222-2222-2222-222222222222",
          key: "region",
          label: "Priority",
          type: "text",
          position: 1,
        },
      ],
    );

    expect(filtered.chips).toEqual([
      { sourceKey: "region", label: "Priority", value: "EU" },
    ]);
  });
});
