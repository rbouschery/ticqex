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

async function loadUnreadCustomerMessages(
  userId: string,
  ticketIds?: string[],
): Promise<{ ticketId: string; messageId: string }[]> {
  if (ticketIds !== undefined && ticketIds.length === 0) return [];

  const db = createAdminClient();
  let query = db
    .from("messages")
    .select("id, ticket_id")
    .eq("author_type", "customer");

  if (ticketIds?.length) {
    query = query.in("ticket_id", ticketIds);
  }

  const { data: messages, error } = await query;
  if (error) throw ApiError.internal(error.message);
  if (!messages?.length) return [];

  const readIds = await loadReadMessageIds(
    messages.map((m) => m.id),
    userId,
  );

  return messages
    .filter((msg) => !readIds.has(msg.id))
    .map((msg) => ({ ticketId: msg.ticket_id, messageId: msg.id }));
}

export async function getUnreadCountsByTicket(
  ticketIds: string[],
  userId: string,
): Promise<Map<string, number>> {
  const unread = await loadUnreadCustomerMessages(userId, ticketIds);
  const counts = new Map<string, number>();
  for (const { ticketId } of unread) {
    counts.set(ticketId, (counts.get(ticketId) ?? 0) + 1);
  }
  return counts;
}

export async function getTicketIdsByUnreadState(
  userId: string,
  hasUnread: boolean,
): Promise<Set<string>> {
  const unreadMessages = await loadUnreadCustomerMessages(userId);
  const unreadTicketIds = new Set(unreadMessages.map((msg) => msg.ticketId));

  if (hasUnread) return unreadTicketIds;

  const db = createAdminClient();
  const { data: tickets, error } = await db.from("tickets").select("id, kind");
  if (error) throw ApiError.internal(error.message);

  const ids = new Set<string>();
  for (const ticket of tickets ?? []) {
    if (ticket.kind === "task" || !unreadTicketIds.has(ticket.id)) {
      ids.add(ticket.id);
    }
  }
  return ids;
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
    .select("id, kind")
    .eq("id", ticketId)
    .maybeSingle();
  if (!ticket) throw ApiError.notFound("Ticket not found");
  if (ticket.kind !== "conversation") {
    return { marked: 0 };
  }

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
