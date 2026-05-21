import { createAdminClient } from "@server/lib/supabase-admin";
import { ApiError } from "@server/lib/errors";

export async function loadReadMessageIds(
  messageIds: string[],
  userId: string,
): Promise<Set<string>> {
  if (!messageIds.length) return new Set();

  const db = createAdminClient();
  const { data, error } = await db
    .from("message_reads")
    .select("message_id")
    .eq("user_id", userId)
    .in("message_id", messageIds);

  if (error) throw ApiError.internal(error.message);
  return new Set((data ?? []).map((row) => row.message_id));
}

export async function getUnreadCountsByTicket(
  ticketIds: string[],
  userId: string,
): Promise<Map<string, number>> {
  if (!ticketIds.length) return new Map();

  const db = createAdminClient();
  const { data: messages, error } = await db
    .from("messages")
    .select("id, ticket_id")
    .in("ticket_id", ticketIds)
    .eq("author_type", "customer");

  if (error) throw ApiError.internal(error.message);
  if (!messages?.length) return new Map();

  const readIds = await loadReadMessageIds(
    messages.map((m) => m.id),
    userId,
  );

  const counts = new Map<string, number>();
  for (const msg of messages) {
    if (readIds.has(msg.id)) continue;
    counts.set(msg.ticket_id, (counts.get(msg.ticket_id) ?? 0) + 1);
  }
  return counts;
}

export async function setMessageReadState(
  messageId: string,
  userId: string,
  read?: boolean,
) {
  if (read === undefined) {
    return toggleMessageRead(messageId, userId);
  }

  const db = createAdminClient();

  const { data: message, error: msgErr } = await db
    .from("messages")
    .select("id, ticket_id, author_type")
    .eq("id", messageId)
    .single();

  if (msgErr || !message) throw ApiError.notFound("Message not found");
  if (message.author_type !== "customer") {
    throw ApiError.badRequest("Only incoming customer messages support read state");
  }

  if (read) {
    const { error } = await db.from("message_reads").upsert(
      { user_id: userId, message_id: messageId },
      { onConflict: "user_id,message_id", ignoreDuplicates: true },
    );
    if (error) throw ApiError.internal(error.message);
    return { read: true, ticket_id: message.ticket_id };
  }

  const { error } = await db
    .from("message_reads")
    .delete()
    .eq("user_id", userId)
    .eq("message_id", messageId);
  if (error) throw ApiError.internal(error.message);
  return { read: false, ticket_id: message.ticket_id };
}

export async function toggleMessageRead(messageId: string, userId: string) {
  const db = createAdminClient();

  const { data: message, error: msgErr } = await db
    .from("messages")
    .select("id, ticket_id, author_type")
    .eq("id", messageId)
    .single();

  if (msgErr || !message) throw ApiError.notFound("Message not found");
  if (message.author_type !== "customer") {
    throw ApiError.badRequest("Only incoming customer messages support read state");
  }

  const { data: existing } = await db
    .from("message_reads")
    .select("message_id")
    .eq("user_id", userId)
    .eq("message_id", messageId)
    .maybeSingle();

  if (existing) {
    const { error } = await db
      .from("message_reads")
      .delete()
      .eq("user_id", userId)
      .eq("message_id", messageId);
    if (error) throw ApiError.internal(error.message);
    return { read: false, ticket_id: message.ticket_id };
  }

  const { error } = await db.from("message_reads").insert({
    user_id: userId,
    message_id: messageId,
  });
  if (error) throw ApiError.internal(error.message);
  return { read: true, ticket_id: message.ticket_id };
}

export async function markTicketMessagesRead(ticketId: string, userId: string) {
  const db = createAdminClient();

  const { data: ticket } = await db
    .from("tickets")
    .select("id")
    .eq("id", ticketId)
    .maybeSingle();
  if (!ticket) throw ApiError.notFound("Ticket not found");

  const { data: messages, error } = await db
    .from("messages")
    .select("id")
    .eq("ticket_id", ticketId)
    .eq("author_type", "customer");

  if (error) throw ApiError.internal(error.message);
  if (!messages?.length) return { marked: 0 };

  const readIds = await loadReadMessageIds(
    messages.map((m) => m.id),
    userId,
  );
  const unread = messages.filter((m) => !readIds.has(m.id));
  if (!unread.length) return { marked: 0 };

  const { error: insertErr } = await db.from("message_reads").upsert(
    unread.map((m) => ({ user_id: userId, message_id: m.id })),
    { onConflict: "user_id,message_id", ignoreDuplicates: true },
  );
  if (insertErr) throw ApiError.internal(insertErr.message);

  return { marked: unread.length };
}
