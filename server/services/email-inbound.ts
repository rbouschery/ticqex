import { createAdminClient } from "@server/lib/supabase-admin";
import { ApiError } from "@server/lib/errors";
import { normalizeEmailSubject, normalizeMessageId } from "@server/lib/utils";
import { findOrCreateCustomer } from "@server/services/customers";
import { getDefaultStatusId } from "@server/services/statuses";
import { createInboundCustomerMessage } from "@server/services/messages";
import {
  ensureEmailThread,
  findTicketByMessageHeaders,
  findTicketBySubjectAndContact,
} from "@server/services/email-threading";
import { persistMessageAttachment } from "@server/services/attachment-uploads";
import type { ParsedEmail } from "@server/adapters/email/types";

function isSyntheticMessageId(messageId: string) {
  return messageId.endsWith("@inbound>");
}

function formatInboundFrom(parsed: ParsedEmail): string {
  if (parsed.fromName) {
    return `${parsed.fromName} <${parsed.from}>`;
  }
  return parsed.from;
}

async function findExistingInboundMessage(parsed: ParsedEmail) {
  const db = createAdminClient();

  if (parsed.resendEmailId) {
    const { data } = await db
      .from("messages")
      .select("id, ticket_id")
      .eq("resend_inbound_id", parsed.resendEmailId)
      .maybeSingle();
    if (data) return data;
  }

  if (parsed.messageId && !isSyntheticMessageId(parsed.messageId)) {
    const variants = [
      parsed.messageId,
      normalizeMessageId(parsed.messageId),
    ];
    const { data } = await db
      .from("messages")
      .select("id, ticket_id")
      .in("email_message_id", [...new Set(variants)])
      .limit(1)
      .maybeSingle();
    if (data) return data;
  }

  return null;
}

async function storeAttachments(
  ticketId: string,
  messageId: string,
  attachments: ParsedEmail["attachments"],
) {
  if (!attachments.length) return;

  for (const att of attachments) {
    await persistMessageAttachment({
      ticketId,
      messageId,
      filename: att.filename,
      contentType: att.contentType,
      content: att.content,
      sizeBytes: att.sizeBytes,
      upsert: true,
    });
  }
}

export async function processInboundEmail(parsed: ParsedEmail) {
  const db = createAdminClient();

  const existing = await findExistingInboundMessage(parsed);
  if (existing) {
    return {
      ticketId: existing.ticket_id,
      messageId: existing.id,
      isNew: false,
      duplicate: true,
    };
  }

  const customer = await findOrCreateCustomer(parsed.from);

  let ticketId = await findTicketByMessageHeaders(
    parsed.inReplyTo,
    parsed.references,
  );
  if (!ticketId) {
    ticketId = await findTicketBySubjectAndContact(
      parsed.subject,
      parsed.from,
      customer.id,
    );
  }

  let isNew = false;
  if (!ticketId) {
    isNew = true;
    const statusId = await getDefaultStatusId();
    const contactAddress = parsed.from.trim().toLowerCase();
    const { data: ticket, error } = await db
      .from("tickets")
      .insert({
        title: normalizeEmailSubject(parsed.subject) || parsed.subject,
        kind: "conversation",
        channel: "email",
        contact_address: contactAddress,
        customer_id: customer.id,
        status_id: statusId,
        origin: "email",
      })
      .select("id")
      .single();
    if (error) throw ApiError.internal(error.message);
    ticketId = ticket.id;

    await ensureEmailThread(
      ticketId,
      parsed.subject,
      parsed.messageId,
    );
  } else {
    await ensureEmailThread(ticketId, parsed.subject, parsed.messageId);
  }

  const { message } = await createInboundCustomerMessage(ticketId, {
    body: parsed.body,
    authorId: customer.id,
    emailMessageId: parsed.messageId,
    emailInReplyTo: parsed.inReplyTo,
    emailFrom: formatInboundFrom(parsed),
    emailTo: parsed.to,
    emailCc: parsed.cc,
    emailSubject: parsed.subject,
    emailBodyHtml: parsed.bodyHtml ?? null,
    resendInboundId: parsed.resendEmailId ?? null,
  });

  await storeAttachments(ticketId, message.id, parsed.attachments);

  return { ticketId, messageId: message.id, isNew };
}
