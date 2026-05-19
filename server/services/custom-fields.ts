import type { SupabaseClient } from "@supabase/supabase-js";
import { ApiError } from "@server/lib/errors";

type FieldRow = {
  id: string;
  group: "ticket" | "customer";
  key: string;
  label: string;
  type: string;
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
  value_json: Record<string, unknown> | null;
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
    default:
      return row.value_text;
  }
}

function rowFromValue(
  field: FieldRow,
  value: unknown,
): Omit<ValueRow, "entity_type" | "entity_id" | "field_id"> {
  const base = {
    value_text: null as string | null,
    value_number: null as number | null,
    value_date: null as string | null,
    value_boolean: null as boolean | null,
    value_json: null as Record<string, unknown> | null,
  };

  switch (field.type) {
    case "number":
      return { ...base, value_number: Number(value) };
    case "date":
      return { ...base, value_date: String(value) };
    case "boolean":
      return { ...base, value_boolean: Boolean(value) };
    case "json":
      return {
        ...base,
        value_json:
          typeof value === "object" && value !== null
            ? (value as Record<string, unknown>)
            : null,
      };
    default:
      return { ...base, value_text: value == null ? null : String(value) };
  }
}

export async function loadCustomFieldsMap(
  db: SupabaseClient,
  entityType: "ticket" | "customer",
  entityIds: string[],
): Promise<Map<string, Record<string, unknown>>> {
  const result = new Map<string, Record<string, unknown>>();
  if (entityIds.length === 0) return result;

  const { data: values, error } = await db
    .from("custom_field_values")
    .select(
      "field_id, entity_id, value_text, value_number, value_date, value_boolean, value_json, custom_field_definitions!inner(id, key, type, group)",
    )
    .eq("entity_type", entityType)
    .in("entity_id", entityIds);

  if (error) throw ApiError.internal(error.message);

  for (const row of values ?? []) {
    const def = row.custom_field_definitions as unknown as FieldRow;
    const entityId = row.entity_id as string;
    const map = result.get(entityId) ?? {};
    map[def.key] = valueFromRow(row as unknown as ValueRow, def);
    result.set(entityId, map);
  }

  return result;
}

export async function setCustomFields(
  db: SupabaseClient,
  group: "ticket" | "customer",
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

  for (const [key, value] of Object.entries(fields)) {
    const def = defByKey.get(key);
    if (!def) throw ApiError.badRequest(`Unknown custom field: ${key}`);

    const typed = rowFromValue(def, value);
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
  group?: "ticket" | "customer",
) {
  let q = db.from("custom_field_definitions").select("*").order("position");
  if (group) q = q.eq("group", group);
  const { data, error } = await q;
  if (error) throw ApiError.internal(error.message);
  return data ?? [];
}

export async function createDefinition(db: SupabaseClient, input: {
  group: "ticket" | "customer";
  key: string;
  label: string;
  type: string;
  options?: Record<string, unknown>;
  required?: boolean;
  position?: number;
}) {
  const { data, error } = await db
    .from("custom_field_definitions")
    .insert({
      group: input.group,
      key: input.key,
      label: input.label,
      type: input.type,
      options: input.options ?? null,
      required: input.required ?? false,
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
  const { data, error } = await db
    .from("custom_field_definitions")
    .update(patch)
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
