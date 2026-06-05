import { assertChannelFields } from "@server/channels/field-enforcement";
import { ApiError } from "@server/lib/errors";
import { createAdminClient } from "@server/lib/supabase-admin";
import { ensureEmailThread } from "@server/services/email-threading";
import { createContactMessage } from "@server/services/messages";
import { invalidateLaneSortCache } from "@server/services/board-lane-sort-cache";

export type OpenConversationTicketInput = {
  origin: "api" | "email";
  title: string;
  contactAddress: string;
  contactId: string;
  statusId: string;
  assigneeId?: string | null;
  threadSubject: string;
  rootMessageId?: string | null;
  firstMessage: {
    body: string;
    authorId: string;
    channel: "api" | "email";
    emailMessageId?: string | null;
    emailInReplyTo?: string | null;
    emailFrom?: string | null;
    emailTo?: string[];
    emailCc?: string[];
    emailSubject?: string | null;
    emailBodyHtml?: string | null;
  };
};

export async function openConversationTicket(
  input: OpenConversationTicketInput,
): Promise<{ ticketId: string; messageId: string }> {
  const db = createAdminClient();

  assertChannelFields("email", "on_create", {
    contact_address: input.contactAddress,
    custom_fields: {},
  });

  const { data: ticket, error } = await db
    .from("tickets")
    .insert({
      title: input.title,
      kind: "conversation",
      channel: "email",
      contact_address: input.contactAddress,
      contact_id: input.contactId,
      status_id: input.statusId,
      assignee_id: input.assigneeId ?? null,
      body: null,
      origin: input.origin,
    })
    .select("id")
    .single();

  if (error) throw ApiError.internal(error.message);

  invalidateLaneSortCache([input.statusId]);

  const ticketId = ticket.id;

  try {
    const { message } = await createContactMessage(ticketId, input.firstMessage);
    await ensureEmailThread(ticketId, input.threadSubject, input.rootMessageId);
    return { ticketId, messageId: message.id };
  } catch (err) {
    await db.from("tickets").delete().eq("id", ticketId);
    throw err;
  }
}
