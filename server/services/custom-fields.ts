import type { SupabaseClient } from "@supabase/supabase-js";
import { ApiError } from "@server/lib/errors";
import { chunkArray } from "@server/lib/chunked-array";
import {
  coerceCustomFieldValue,
  isOptionListType,
  normalizeSelectOptions,
  parseSelectOptions,
  validateDefinitionOptions,
  validateShowOpenInTicketForGroup,
  type CustomFieldDefinition,
  type CustomFieldType,
} from "@shared/custom-fields";

type FieldRow = {
  id: string;
  group: "ticket" | "contact";
  key: string;
  label: string;
  type: CustomFieldType;
  options: Record<string, unknown> | null;
};

type ValueRow = {
  field_id: string;
  entity_type: string;
  entity_id: string;
  value_text: string | null;
  value_number: number | null;
  value_date: string | null;
  value_boolean: boolean | null;
  value_json: unknown | null;
};

function valueFromRow(row: ValueRow, field: FieldRow): unknown {
  switch (field.type) {
    case "number":
      return row.value_number;
    case "date":
      return row.value_date;
    case "boolean":
      return row.value_boolean;
    case "json":
      return row.value_json;
    case "multiselect": {
      if (!Array.isArray(row.value_json)) return [];
      return row.value_json.filter((entry): entry is string => typeof entry === "string");
    }
    default:
      return row.value_text;
  }
}

function rowFromCoercedValue(
  field: FieldRow,
  value: unknown,
): Omit<ValueRow, "entity_type" | "entity_id" | "field_id"> {
  const base = {
    value_text: null as string | null,
    value_number: null as number | null,
    value_date: null as string | null,
    value_boolean: null as boolean | null,
    value_json: null as unknown | null,
  };

  switch (field.type) {
    case "number":
      return { ...base, value_number: value as number };
    case "date":
      return { ...base, value_date: value as string };
    case "boolean":
      return { ...base, value_boolean: value as boolean };
    case "json":
      return { ...base, value_json: value as Record<string, unknown> };
    case "multiselect":
      return { ...base, value_json: value as string[] };
    default:
      return { ...base, value_text: value == null ? null : String(value) };
  }
}

function normalizeDefinitionOptions(
  type: CustomFieldType,
  options: Record<string, unknown> | null | undefined,
): Record<string, unknown> | null {
  if (isOptionListType(type)) {
    return normalizeSelectOptions(parseSelectOptions(options));
  }
  return options && Object.keys(options).length > 0 ? options : null;
}

export function assertValidDefinitionOptions(
  type: CustomFieldType,
  options: Record<string, unknown> | null | undefined,
) {
  const message = validateDefinitionOptions(type, options);
  if (message) throw ApiError.badRequest(message);
}

function assertValidShowOpenInTicket(
  group: "ticket" | "contact",
  showOpenInTicket: boolean | undefined,
) {
  const message = validateShowOpenInTicketForGroup(group, showOpenInTicket);
  if (message) throw ApiError.badRequest(message);
}

async function countFieldValues(db: SupabaseClient, fieldId: string): Promise<number> {
  const { count, error } = await db
    .from("custom_field_values")
    .select("*", { count: "exact", head: true })
    .eq("field_id", fieldId);
  if (error) throw ApiError.internal(error.message);
  return count ?? 0;
}

export async function loadCustomFieldsMap(
  db: SupabaseClient,
  entityType: "ticket" | "contact",
  entityIds: string[],
  options?: { fieldIds?: string[] },
): Promise<Map<string, Record<string, unknown>>> {
  const result = new Map<string, Record<string, unknown>>();
  if (entityIds.length === 0) return result;
  if (options?.fieldIds && options.fieldIds.length === 0) return result;

  for (const chunk of chunkArray(entityIds)) {
    let query = db
      .from("custom_field_values")
      .select(
        "field_id, entity_id, value_text, value_number, value_date, value_boolean, value_json, custom_field_definitions!inner(id, key, type, group)",
      )
      .eq("entity_type", entityType)
      .in("entity_id", chunk);

    if (options?.fieldIds) {
      query = query.in("field_id", options.fieldIds);
    }

    const { data: values, error } = await query;

    if (error) throw ApiError.internal(error.message);

    for (const row of values ?? []) {
      const def = row.custom_field_definitions as unknown as FieldRow;
      const entityId = row.entity_id as string;
      const map = result.get(entityId) ?? {};
      map[def.key] = valueFromRow(row as unknown as ValueRow, def);
      result.set(entityId, map);
    }
  }

  return result;
}

export async function setCustomFields(
  db: SupabaseClient,
  group: "ticket" | "contact",
  entityId: string,
  fields: Record<string, unknown> | undefined,
) {
  if (!fields || Object.keys(fields).length === 0) return;

  const { data: definitions, error: defErr } = await db
    .from("custom_field_definitions")
    .select("*")
    .eq("group", group)
    .in("key", Object.keys(fields));

  if (defErr) throw ApiError.internal(defErr.message);

  const defByKey = new Map(
    (definitions ?? []).map((d) => [d.key, d as FieldRow]),
  );

  for (const [key, rawValue] of Object.entries(fields)) {
    const def = defByKey.get(key);
    if (!def) throw ApiError.badRequest(`Unknown custom field: ${key}`);

    let coerced;
    try {
      coerced = coerceCustomFieldValue(def.type, rawValue, def.options);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Invalid custom field value";
      throw ApiError.badRequest(`${key}: ${message}`);
    }

    if (coerced.kind === "clear") {
      const { error } = await db
        .from("custom_field_values")
        .delete()
        .eq("field_id", def.id)
        .eq("entity_type", group)
        .eq("entity_id", entityId);
      if (error) throw ApiError.internal(error.message);
      continue;
    }

    const typed = rowFromCoercedValue(def, coerced.value);
    const { error } = await db.from("custom_field_values").upsert(
      {
        field_id: def.id,
        entity_type: group,
        entity_id: entityId,
        ...typed,
      },
      { onConflict: "field_id,entity_type,entity_id" },
    );
    if (error) throw ApiError.internal(error.message);
  }
}

export async function listDefinitions(
  db: SupabaseClient,
  group?: "ticket" | "contact",
  options?: { showOpenInTicket?: boolean },
): Promise<CustomFieldDefinition[]> {
  let q = db.from("custom_field_definitions").select("*").order("position");
  if (group) q = q.eq("group", group);
  if (options?.showOpenInTicket) q = q.eq("show_open_in_ticket", true);
  const { data, error } = await q;
  if (error) throw ApiError.internal(error.message);
  return (data ?? []) as CustomFieldDefinition[];
}

export async function createDefinition(
  db: SupabaseClient,
  input: {
    group: "ticket" | "contact";
    key: string;
    label: string;
    type: CustomFieldType;
    options?: Record<string, unknown> | null;
    required?: boolean;
    position?: number;
    show_open_in_ticket?: boolean;
  },
) {
  assertValidDefinitionOptions(input.type, input.options ?? null);
  assertValidShowOpenInTicket(input.group, input.show_open_in_ticket);
  const options = normalizeDefinitionOptions(input.type, input.options);

  const { data, error } = await db
    .from("custom_field_definitions")
    .insert({
      group: input.group,
      key: input.key,
      label: input.label,
      type: input.type,
      options,
      required: input.required ?? false,
      show_open_in_ticket:
        input.group === "contact" ? (input.show_open_in_ticket ?? false) : false,
      position: input.position ?? 0,
    })
    .select()
    .single();
  if (error) {
    if (error.code === "23505") throw ApiError.conflict("Field key already exists");
    throw ApiError.internal(error.message);
  }
  return data;
}

export async function updateDefinition(
  db: SupabaseClient,
  id: string,
  patch: Record<string, unknown>,
) {
  const { data: existing, error: loadErr } = await db
    .from("custom_field_definitions")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (loadErr) throw ApiError.internal(loadErr.message);
  if (!existing) throw ApiError.notFound("Custom field not found");

  const nextType = (patch.type ?? existing.type) as CustomFieldType;
  const nextOptions =
    patch.options !== undefined
      ? (patch.options as Record<string, unknown> | null)
      : (existing.options as Record<string, unknown> | null);

  assertValidDefinitionOptions(nextType, nextOptions);
  assertValidShowOpenInTicket(
    existing.group as "ticket" | "contact",
    patch.show_open_in_ticket as boolean | undefined,
  );

  if (patch.type !== undefined && patch.type !== existing.type) {
    const valueCount = await countFieldValues(db, id);
    if (valueCount > 0) {
      throw ApiError.conflict(
        "Cannot change field type while values exist. Delete existing values first.",
      );
    }
  }

  const normalizedPatch = { ...patch };
  if (patch.options !== undefined || patch.type !== undefined) {
    normalizedPatch.options = normalizeDefinitionOptions(nextType, nextOptions);
  }

  const { data, error } = await db
    .from("custom_field_definitions")
    .update(normalizedPatch)
    .eq("id", id)
    .select()
    .single();
  if (error) throw ApiError.internal(error.message);
  if (!data) throw ApiError.notFound("Custom field not found");
  return data;
}

export async function deleteDefinition(db: SupabaseClient, id: string) {
  const { error } = await db.from("custom_field_definitions").delete().eq("id", id);
  if (error) throw ApiError.internal(error.message);
}

export async function reorderDefinitions(
  db: SupabaseClient,
  group: "ticket" | "contact",
  orderedIds: string[],
) {
  const { data: defs, error: loadErr } = await db
    .from("custom_field_definitions")
    .select("id")
    .eq("group", group);
  if (loadErr) throw ApiError.internal(loadErr.message);

  const knownIds = new Set((defs ?? []).map((d) => d.id as string));
  if (orderedIds.length !== knownIds.size) {
    throw ApiError.badRequest("Reorder list must include every field in the group");
  }
  for (const id of orderedIds) {
    if (!knownIds.has(id)) {
      throw ApiError.badRequest("Reorder list contains unknown field id");
    }
  }

  await Promise.all(
    orderedIds.map((id, position) =>
      db
        .from("custom_field_definitions")
        .update({ position })
        .eq("id", id)
        .eq("group", group),
    ),
  );

  return listDefinitions(db, group);
}

export async function filterTicketIdsByCustomFields(
  db: SupabaseClient,
  filters: Record<string, string>,
): Promise<string[] | null> {
  if (Object.keys(filters).length === 0) return null;

  const keys = Object.keys(filters);
  const { data: defs } = await db
    .from("custom_field_definitions")
    .select("id, key")
    .eq("group", "ticket")
    .in("key", keys);

  if (!defs?.length) return [];

  const defByKey = new Map(defs.map((d) => [d.key, d.id]));
  let ticketIds: Set<string> | null = null;

  for (const [key, value] of Object.entries(filters)) {
    const fieldId = defByKey.get(key);
    if (!fieldId) return [];

    const { data: rows } = await db
      .from("custom_field_values")
      .select("entity_id")
      .eq("field_id", fieldId)
      .eq("entity_type", "ticket")
      .eq("value_text", value);

    const ids = new Set<string>((rows ?? []).map((r) => r.entity_id as string));
    if (ticketIds === null) {
      ticketIds = ids;
    } else {
      const intersection = new Set<string>();
      for (const id of ticketIds) {
        if (ids.has(id)) intersection.add(id);
      }
      ticketIds = intersection;
    }
  }

  return ticketIds ? [...ticketIds] : [];
}
