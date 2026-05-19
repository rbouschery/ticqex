import { createAdminClient } from "@server/lib/supabase-admin";
import { ApiError } from "@server/lib/errors";

export async function getSettings() {
  const db = createAdminClient();
  const { data, error } = await db
    .from("global_settings")
    .select("*")
    .eq("id", 1)
    .single();
  if (error) throw ApiError.internal(error.message);
  return data;
}

export async function patchSettings(patch: Record<string, unknown>) {
  const db = createAdminClient();
  const { data, error } = await db
    .from("global_settings")
    .update(patch)
    .eq("id", 1)
    .select()
    .single();
  if (error) throw ApiError.internal(error.message);
  return data;
}
