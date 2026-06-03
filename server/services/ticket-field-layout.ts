import { createAdminClient } from "@server/lib/supabase-admin";
import { listDefinitions } from "@server/services/custom-fields";
import { getSettings } from "@server/services/settings";
import type { CustomFieldDefinition } from "@shared/custom-fields";
import {
  resolveTicketFieldLayout,
  type ResolvedTicketFieldLayout,
  type TicketCustomFieldDefinition,
  type TicketFieldVisibilitySettings,
} from "@shared/ticket-fields";

export type TicketFieldLayoutContext = {
  layout: ResolvedTicketFieldLayout;
  customFieldDefinitions: TicketCustomFieldDefinition[];
};

type GlobalSettingsRow = Awaited<ReturnType<typeof getSettings>>;

export type LoadTicketFieldLayoutOptions = {
  /** When already loaded (e.g. settings API), avoids a second settings query. */
  settings?: GlobalSettingsRow;
};

function toTicketCustomFieldDefinitions(
  definitions: readonly CustomFieldDefinition[],
): TicketCustomFieldDefinition[] {
  return definitions.map((field) => ({
    id: field.id,
    key: field.key,
    label: field.label,
    type: field.type,
    position: field.position,
    required: field.required,
  }));
}

function visibilitySettingsFromRow(
  settings: GlobalSettingsRow,
): TicketFieldVisibilitySettings {
  return { ticket_field_visibility: settings.ticket_field_visibility };
}

export async function loadTicketFieldLayoutContext(
  options: LoadTicketFieldLayoutOptions = {},
): Promise<TicketFieldLayoutContext> {
  const db = createAdminClient();
  const [settings, definitions] = await Promise.all([
    options.settings ?? getSettings(),
    listDefinitions(db, "ticket"),
  ]);

  const customFieldDefinitions = toTicketCustomFieldDefinitions(definitions);
  const layout = resolveTicketFieldLayout({
    settings: visibilitySettingsFromRow(settings),
    customFields: customFieldDefinitions,
  });

  return { layout, customFieldDefinitions };
}

export async function loadTicketFieldLayout(
  options: LoadTicketFieldLayoutOptions = {},
): Promise<ResolvedTicketFieldLayout> {
  const { layout } = await loadTicketFieldLayoutContext(options);
  return layout;
}

/** @deprecated Prefer loadTicketFieldLayoutContext to avoid duplicate fetches. */
export async function loadTicketCustomFieldDefinitions(
  options: LoadTicketFieldLayoutOptions = {},
): Promise<TicketCustomFieldDefinition[]> {
  const { customFieldDefinitions } = await loadTicketFieldLayoutContext(options);
  return customFieldDefinitions;
}
