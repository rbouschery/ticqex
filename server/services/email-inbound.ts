import { createAdminClient } from "@server/lib/supabase-admin";
import { ApiError } from "@server/lib/errors";
import { normalizeEmailSubject } from "@server/lib/utils";
import { findOrCreateCustomer } from "@server/services/customers";
import { getDefaultStatusId } from "@server/services/statuses";
import { createMessage } from "@server/services/tickets";
import type { ParsedEmail } from "@server/adapters/email/types";

async function findTicketByMessageHeaders(parsed: ParsedEmail) {
  const db = createAdminClient();
  const ids = [parsed.inReplyTo, ...(parsed.references ?? [])].filter(
    Boolean,
  ) as string[];

  if (!ids.length) return null;

  const { data } = await db
    .from("messages")
    .select("ticket_id")
    .in("email_message_id", ids)
    .limit(1)
    .maybeSingle();

  return data?.ticket_id ?? null;
}

async function findTicketBySubjectCustomer(
  subject: string,
  customerId: string,
) {
  const db = createAdminClient();
  const normalized = normalizeEmailSubject(subject);

  const { data: threads } = await db
    .from("email_threads")
    .select("ticket_id")
    .eq("subject", normalized)
    .limit(20);

  for (const row of threads ?? []) {
    const { data: ticket } = await db
      .from("tickets")
      .select("id")
      .eq("id", row.ticket_id)
      .eq("customer_id", customerId)
      .maybeSingle();
    if (ticket) return ticket.id;
  }

  return null;
}

async function storeAttachments(
  ticketId: string,
  messageId: string,
  attachments: ParsedEmail["attachments"],
) {
  if (!attachments.length) return;
  const db = createAdminClient();

  for (const att of attachments) {
    const path = `attachments/${ticketId}/${messageId}/${att.filename}`;
    const { error: uploadError } = await db.storage
      .from("attachments")
      .upload(path, att.content, {
        contentType: att.contentType,
        upsert: true,
      });

    if (uploadError) {
      console.error("Attachment upload failed:", uploadError.message);
      continue;
    }

    await db.from("attachments").insert({
      message_id: messageId,
      filename: att.filename,
      content_type: att.contentType,
      size_bytes: att.sizeBytes,
      storage_path: path,
    });
  }
}

export async function processInboundEmail(parsed: ParsedEmail) {
  const db = createAdminClient();
  const customer = await findOrCreateCustomer(parsed.from);

  let ticketId = await findTicketByMessageHeaders(parsed);
  if (!ticketId) {
    ticketId = await findTicketBySubjectCustomer(parsed.subject, customer.id);
  }

  let isNew = false;
  if (!ticketId) {
    isNew = true;
    const statusId = await getDefaultStatusId();
    const { data: ticket, error } = await db
      .from("tickets")
      .insert({
        title: normalizeEmailSubject(parsed.subject) || parsed.subject,
        customer_id: customer.id,
        status_id: statusId,
        origin: "email",
      })
      .select("id")
      .single();
    if (error) throw ApiError.internal(error.message);
    ticketId = ticket.id;

    await db.from("email_threads").insert({
      ticket_id: ticketId,
      root_message_id: parsed.messageId,
      subject: normalizeEmailSubject(parsed.subject),
    });
  }

  const { message } = await createMessage(ticketId, {
    body: parsed.body,
    visibility: "public",
    channel: "email",
    authorType: "customer",
    authorId: customer.id,
    emailMessageId: parsed.messageId,
    emailInReplyTo: parsed.inReplyTo,
  });

  await db
    .from("messages")
    .update({ email_message_id: parsed.messageId })
    .eq("id", message.id);

  await storeAttachments(ticketId, message.id, parsed.attachments);

  return { ticketId, messageId: message.id, isNew };
}
