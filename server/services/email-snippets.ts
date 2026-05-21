import { createAdminClient } from "@server/lib/supabase-admin";
import { ApiError } from "@server/lib/errors";

export async function listEmailSnippets() {
  const db = createAdminClient();
  const { data, error } = await db
    .from("email_snippets")
    .select("id, title, body, created_at")
    .order("created_at", { ascending: false });
  if (error) throw ApiError.internal(error.message);
  return data ?? [];
}

export async function createEmailSnippet(input: {
  title: string;
  body: string;
  createdBy: string;
}) {
  const db = createAdminClient();
  const { data, error } = await db
    .from("email_snippets")
    .insert({
      title: input.title,
      body: input.body,
      created_by: input.createdBy,
    })
    .select("id, title, body, created_at")
    .single();
  if (error) throw ApiError.internal(error.message);
  return data;
}

export async function deleteEmailSnippet(id: string) {
  const db = createAdminClient();
  const { error } = await db.from("email_snippets").delete().eq("id", id);
  if (error) throw ApiError.internal(error.message);
}
