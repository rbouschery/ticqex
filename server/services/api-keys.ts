import { createAdminClient } from "@server/lib/supabase-admin";
import { ApiError } from "@server/lib/errors";
import { generateApiKey } from "@server/lib/utils";

export async function listApiKeys() {
  const db = createAdminClient();
  const { data, error } = await db
    .from("api_keys")
    .select("id, name, key_prefix, created_by, last_used_at, revoked_at, created_at")
    .is("revoked_at", null)
    .order("created_at", { ascending: false });
  if (error) throw ApiError.internal(error.message);
  return data ?? [];
}

export async function createApiKey(name: string, createdBy: string) {
  const db = createAdminClient();
  const { fullKey, prefix, hash } = generateApiKey();

  const { data, error } = await db
    .from("api_keys")
    .insert({
      name,
      key_hash: hash,
      key_prefix: prefix,
      created_by: createdBy,
    })
    .select("id, name, key_prefix, created_at")
    .single();

  if (error) throw ApiError.internal(error.message);

  return { ...data, key: fullKey };
}

export async function revokeApiKey(id: string) {
  const db = createAdminClient();
  const { error } = await db
    .from("api_keys")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw ApiError.internal(error.message);
}
