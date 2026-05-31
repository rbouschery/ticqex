import type { SupabaseClient } from "@supabase/supabase-js";
import { ApiError } from "@server/lib/errors";
import { CHUNK_SIZE, chunkArray } from "@server/lib/chunked-array";

function escapeIlikePattern(raw: string): string {
  return raw.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

function ilikePattern(query: string): string {
  return `%${escapeIlikePattern(query.trim())}%`;
}

type IdRow = { id?: string; ticket_id?: string; entity_id?: string };

function addRows(ids: Set<string>, rows: IdRow[] | null) {
  for (const row of rows ?? []) {
    const id = row.id ?? row.ticket_id ?? row.entity_id;
    if (id) ids.add(id);
  }
}

/** Returns ticket IDs whose searchable fields match `query` (case-insensitive). */
export async function resolveSearchTicketIds(
  db: SupabaseClient,
  query: string,
): Promise<Set<string>> {
  const normalized = query.trim();
  if (!normalized) return new Set();

  const pattern = ilikePattern(normalized);
  const ids = new Set<string>();

  const [
    ticketMatches,
    customerMatches,
    assigneeMatches,
    tagRows,
    messageMatches,
    fieldMatches,
  ] = await Promise.all([
    db
      .from("tickets")
      .select("id")
      .or(
        `title.ilike.${pattern},body.ilike.${pattern},contact_address.ilike.${pattern}`,
      ),
    db
      .from("tickets")
      .select("id, customers!inner(username)")
      .ilike("customers.username", pattern),
    db
      .from("tickets")
      .select("id, users:assignee_id!inner(username)")
      .ilike("users.username", pattern),
    db.from("tags").select("id").ilike("name", pattern),
    db
      .from("messages")
      .select("ticket_id")
      .eq("visibility", "public")
      .or("email_delivery_status.is.null,email_delivery_status.neq.draft")
      .ilike("body", pattern),
    db
      .from("custom_field_values")
      .select("entity_id")
      .eq("entity_type", "ticket")
      .ilike("value_text", pattern),
  ]);

  if (ticketMatches.error) throw ApiError.internal(ticketMatches.error.message);
  if (customerMatches.error) throw ApiError.internal(customerMatches.error.message);
  if (assigneeMatches.error) throw ApiError.internal(assigneeMatches.error.message);
  if (tagRows.error) throw ApiError.internal(tagRows.error.message);
  if (messageMatches.error) throw ApiError.internal(messageMatches.error.message);
  if (fieldMatches.error) throw ApiError.internal(fieldMatches.error.message);

  addRows(ids, ticketMatches.data);
  addRows(ids, customerMatches.data);
  addRows(ids, assigneeMatches.data);
  addRows(
    ids,
    messageMatches.data?.map((row) => ({ id: row.ticket_id as string })) ?? null,
  );
  addRows(
    ids,
    fieldMatches.data?.map((row) => ({ id: row.entity_id as string })) ?? null,
  );

  if (tagRows.data?.length) {
    const tagIds = tagRows.data.map((t) => t.id as string);
    const chunks =
      tagIds.length > CHUNK_SIZE ? chunkArray(tagIds, CHUNK_SIZE) : [tagIds];

    const tagLinkResults = await Promise.all(
      chunks.map((chunk) =>
        db.from("ticket_tags").select("ticket_id").in("tag_id", chunk),
      ),
    );

    for (const { data, error } of tagLinkResults) {
      if (error) throw ApiError.internal(error.message);
      addRows(
        ids,
        data?.map((row) => ({ id: row.ticket_id as string })) ?? null,
      );
    }
  }

  return ids;
}
