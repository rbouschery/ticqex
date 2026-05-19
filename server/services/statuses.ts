import { createAdminClient } from "@server/lib/supabase-admin";
import { ApiError } from "@server/lib/errors";

export async function listStatuses() {
  const db = createAdminClient();
  const { data, error } = await db
    .from("status_types")
    .select("*")
    .order("position");
  if (error) throw ApiError.internal(error.message);
  return data ?? [];
}

export async function getDefaultStatusId() {
  const statuses = await listStatuses();
  if (!statuses.length) throw ApiError.internal("No status types configured");
  return statuses[0]!.id;
}

export async function createStatus(input: {
  name: string;
  color?: string;
  position?: number;
}) {
  const db = createAdminClient();
  let position = input.position;
  if (position === undefined) {
    const { data: max } = await db
      .from("status_types")
      .select("position")
      .order("position", { ascending: false })
      .limit(1)
      .maybeSingle();
    position = (max?.position ?? -1) + 1;
  }

  const { data, error } = await db
    .from("status_types")
    .insert({
      name: input.name,
      color: input.color ?? "#6366f1",
      position,
    })
    .select()
    .single();

  if (error) throw ApiError.internal(error.message);
  return data;
}

export async function updateStatus(
  id: string,
  patch: { name?: string; color?: string; position?: number },
) {
  const db = createAdminClient();
  const { data, error } = await db
    .from("status_types")
    .update(patch)
    .eq("id", id)
    .select()
    .single();
  if (error) throw ApiError.internal(error.message);
  if (!data) throw ApiError.notFound("Status not found");
  return data;
}

export async function deleteStatus(id: string) {
  const db = createAdminClient();
  const { count } = await db
    .from("tickets")
    .select("*", { count: "exact", head: true })
    .eq("status_id", id);
  if ((count ?? 0) > 0) {
    throw ApiError.conflict("Cannot delete status with tickets");
  }
  const { error } = await db.from("status_types").delete().eq("id", id);
  if (error) throw ApiError.internal(error.message);
}

export async function reorderStatuses(ids: string[]) {
  const db = createAdminClient();
  for (let i = 0; i < ids.length; i++) {
    const { error } = await db
      .from("status_types")
      .update({ position: i })
      .eq("id", ids[i]!);
    if (error) throw ApiError.internal(error.message);
  }
  return listStatuses();
}
