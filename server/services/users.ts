import { createAdminClient } from "@server/lib/supabase-admin";
import { ApiError } from "@server/lib/errors";

export async function listUsers() {
  const db = createAdminClient();
  const { data, error } = await db
    .from("users")
    .select("id, username, email, role, created_at")
    .order("username");
  if (error) throw ApiError.internal(error.message);
  return data ?? [];
}

export async function getMe(userId: string) {
  const db = createAdminClient();
  const { data, error } = await db
    .from("users")
    .select("id, username, email, role, created_at")
    .eq("id", userId)
    .single();
  if (error || !data) throw ApiError.notFound("User not found");
  return data;
}
