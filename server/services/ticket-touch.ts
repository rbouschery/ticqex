import { createAdminClient } from "@server/lib/supabase-admin";
import { ApiError } from "@server/lib/errors";

export async function touchTicket(ticketId: string) {
  const db = createAdminClient();
  const { error } = await db
    .from("tickets")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", ticketId);
  if (error) throw ApiError.internal(error.message);
}
