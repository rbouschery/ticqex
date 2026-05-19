import { createAdminClient } from "@server/lib/supabase-admin";
import { ApiError } from "@server/lib/errors";

export async function listTags() {
  const db = createAdminClient();
  const { data, error } = await db.from("tags").select("*").order("name");
  if (error) throw ApiError.internal(error.message);
  return data ?? [];
}

export async function createTag(input: { name: string; color?: string }) {
  const db = createAdminClient();
  const { data, error } = await db
    .from("tags")
    .insert({ name: input.name, color: input.color ?? "#64748b" })
    .select()
    .single();
  if (error) {
    if (error.code === "23505") throw ApiError.conflict("Tag already exists");
    throw ApiError.internal(error.message);
  }
  return data;
}

export async function updateTag(
  id: string,
  patch: { name?: string; color?: string },
) {
  const db = createAdminClient();
  const { data, error } = await db
    .from("tags")
    .update(patch)
    .eq("id", id)
    .select()
    .single();
  if (error) throw ApiError.internal(error.message);
  if (!data) throw ApiError.notFound("Tag not found");
  return data;
}

export async function deleteTag(id: string) {
  const db = createAdminClient();
  const { error } = await db.from("tags").delete().eq("id", id);
  if (error) throw ApiError.internal(error.message);
}

export async function resolveTagIds(names: string[]): Promise<string[]> {
  if (!names.length) return [];
  const db = createAdminClient();
  const ids: string[] = [];

  for (const name of names) {
    const { data: existing } = await db
      .from("tags")
      .select("id")
      .eq("name", name)
      .maybeSingle();
    if (existing) {
      ids.push(existing.id);
      continue;
    }
    const { data, error } = await db
      .from("tags")
      .insert({ name })
      .select("id")
      .single();
    if (error) throw ApiError.internal(error.message);
    ids.push(data.id);
  }

  return ids;
}

export async function setTicketTags(ticketId: string, tagNames: string[]) {
  const db = createAdminClient();
  const tagIds = await resolveTagIds(tagNames);

  await db.from("ticket_tags").delete().eq("ticket_id", ticketId);

  if (tagIds.length) {
    const { error } = await db.from("ticket_tags").insert(
      tagIds.map((tag_id) => ({ ticket_id: ticketId, tag_id })),
    );
    if (error) throw ApiError.internal(error.message);
  }
}

export async function loadTagsForTickets(ticketIds: string[]) {
  const db = createAdminClient();
  const map = new Map<string, { id: string; name: string; color: string }[]>();
  if (!ticketIds.length) return map;

  const { data } = await db
    .from("ticket_tags")
    .select("ticket_id, tags(id, name, color)")
    .in("ticket_id", ticketIds);

  for (const row of data ?? []) {
    const tag = row.tags as unknown as { id: string; name: string; color: string };
    const list = map.get(row.ticket_id as string) ?? [];
    list.push(tag);
    map.set(row.ticket_id as string, list);
  }
  return map;
}
