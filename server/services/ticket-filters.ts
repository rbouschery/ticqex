import type { SupabaseClient } from "@supabase/supabase-js";
import { ApiError } from "@server/lib/errors";
import {
  normalizeCondition,
  type FilterOperator,
  type TicketFilter,
  type TicketFilterCondition,
} from "@server/domain/ticket-filter";
import { getTicketIdsByUnreadState } from "@server/services/message-reads";

type FilterContext = {
  userId?: string;
};

function intersectSets(a: Set<string> | null, b: Set<string>): Set<string> {
  if (a === null) return b;
  const next = new Set<string>();
  for (const id of a) {
    if (b.has(id)) next.add(id);
  }
  return next;
}

function formatIdInList(ids: Iterable<string>): string {
  return `(${[...ids].map((id) => `"${id}"`).join(",")})`;
}

type TicketIdQuery = ReturnType<ReturnType<SupabaseClient["from"]>["select"]>;

async function queryTicketIds(
  db: SupabaseClient,
  apply: (query: TicketIdQuery) => TicketIdQuery,
): Promise<Set<string>> {
  const { data, error } = await apply(db.from("tickets").select("id"));
  if (error) throw ApiError.internal(error.message);
  return new Set(
    (data ?? []).map((row) => (row as { id: string }).id),
  );
}

async function queryTicketIdsExcluding(
  db: SupabaseClient,
  exclude: Set<string>,
): Promise<Set<string>> {
  if (exclude.size === 0) {
    return queryTicketIds(db, (q) => q);
  }
  const list = formatIdInList(exclude);
  return queryTicketIds(db, (q) => q.not("id", "in", list));
}

async function getTicketIdsByTags(
  db: SupabaseClient,
  tagNames: string[],
): Promise<Set<string>> {
  const { data: tags, error: tagErr } = await db
    .from("tags")
    .select("id")
    .in("name", tagNames);

  if (tagErr) throw ApiError.internal(tagErr.message);
  if (!tags?.length) return new Set();

  const { data: links, error: linkErr } = await db
    .from("ticket_tags")
    .select("ticket_id")
    .in(
      "tag_id",
      tags.map((t) => t.id),
    );

  if (linkErr) throw ApiError.internal(linkErr.message);
  return new Set((links ?? []).map((row) => row.ticket_id as string));
}

async function getCustomFieldDefinition(db: SupabaseClient, key: string) {
  const { data: def, error: defErr } = await db
    .from("custom_field_definitions")
    .select("id, type")
    .eq("group", "ticket")
    .eq("key", key)
    .maybeSingle();

  if (defErr) throw ApiError.internal(defErr.message);
  return def;
}

async function getTicketIdsWithCustomFieldValue(
  db: SupabaseClient,
  key: string,
): Promise<Set<string>> {
  const def = await getCustomFieldDefinition(db, key);
  if (!def) return new Set();

  const { data, error } = await db
    .from("custom_field_values")
    .select("entity_id")
    .eq("field_id", def.id)
    .eq("entity_type", "ticket");

  if (error) throw ApiError.internal(error.message);
  return new Set((data ?? []).map((row) => row.entity_id as string));
}

async function getTicketIdsByCustomField(
  db: SupabaseClient,
  key: string,
  op: FilterOperator,
  value?: string | boolean | number,
  values?: (string | number)[],
): Promise<Set<string>> {
  const def = await getCustomFieldDefinition(db, key);
  if (!def) return new Set();

  if (op === "empty") {
    const withValue = await getTicketIdsWithCustomFieldValue(db, key);
    return queryTicketIdsExcluding(db, withValue);
  }
  if (op === "not_empty") {
    return getTicketIdsWithCustomFieldValue(db, key);
  }

  let query = db
    .from("custom_field_values")
    .select("entity_id")
    .eq("field_id", def.id)
    .eq("entity_type", "ticket");

  if (op === "contains" || op === "not_contains") {
    query = query.ilike("value_text", `%${String(value)}%`);
  } else if (op === "in" || op === "nin") {
    if (def.type === "number") {
      query = query.in(
        "value_number",
        (values ?? []).map((entry) => Number(entry)),
      );
    } else {
      query = query.in("value_text", (values ?? []).map(String));
    }
  } else if (typeof value === "boolean") {
    query = query.eq("value_boolean", value);
  } else if (typeof value === "number") {
    query = query.eq("value_number", value);
  } else {
    query = query.eq("value_text", String(value));
  }

  const { data, error } = await query;
  if (error) throw ApiError.internal(error.message);
  const matching = new Set((data ?? []).map((row) => row.entity_id as string));

  if (op === "neq" || op === "nin" || op === "not_contains") {
    return queryTicketIdsExcluding(db, matching);
  }

  return matching;
}

async function evaluateScalarCondition(
  db: SupabaseClient,
  condition: Extract<
    TicketFilterCondition,
    { field: "assignee_id" | "customer_id" | "kind" | "channel" | "origin" }
  >,
): Promise<Set<string>> {
  const column = condition.field;

  if (condition.op === "empty") {
    return queryTicketIds(db, (q) => q.is(column, null));
  }
  if (condition.op === "not_empty") {
    return queryTicketIds(db, (q) => q.not(column, "is", null));
  }
  if (condition.op === "eq") {
    return queryTicketIds(db, (q) => q.eq(column, condition.value!));
  }
  if (condition.op === "neq") {
    return queryTicketIds(db, (q) => q.neq(column, condition.value!));
  }
  if (condition.op === "in") {
    return queryTicketIds(db, (q) => q.in(column, condition.values!));
  }
  return queryTicketIds(db, (q) =>
    q.not(column, "in", formatIdInList(condition.values!)),
  );
}

async function evaluateCondition(
  db: SupabaseClient,
  condition: TicketFilterCondition,
  ctx: FilterContext,
): Promise<Set<string>> {
  const normalized = normalizeCondition(condition);

  switch (normalized.field) {
    case "assignee_id":
    case "customer_id":
    case "kind":
    case "channel":
    case "origin":
      return evaluateScalarCondition(db, normalized);
    case "tag": {
      const matching = await getTicketIdsByTags(db, normalized.values);
      if (normalized.op === "nin") {
        return queryTicketIdsExcluding(db, matching);
      }
      return matching;
    }
    case "unread": {
      if (!ctx.userId) return new Set();
      const wantsUnread =
        normalized.op === "eq" ? normalized.value : !normalized.value;
      return getTicketIdsByUnreadState(ctx.userId, wantsUnread);
    }
    case "ticket_field":
      return getTicketIdsByCustomField(
        db,
        normalized.key,
        normalized.op,
        normalized.value,
        normalized.values,
      );
    default:
      return new Set();
  }
}

/** Returns null when filter is empty (no restriction), [] when nothing matches. */
export async function resolveFilteredTicketIds(
  db: SupabaseClient,
  filter: TicketFilter,
  ctx: FilterContext = {},
): Promise<string[] | null> {
  if (filter.length === 0) return null;

  const sets = await Promise.all(
    filter.map((condition) => evaluateCondition(db, condition, ctx)),
  );

  let ids: Set<string> | null = null;
  for (const matching of sets) {
    if (matching.size === 0) return [];
    ids = intersectSets(ids, matching);
  }

  return ids ? [...ids] : [];
}
