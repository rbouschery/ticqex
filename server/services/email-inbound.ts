import {
  findMessageByExternalRef,
  insertMessageExternalRef,
} from "@server/services/message-external-refs";
import { createAdminClient } from "@server/lib/supabase-admin";
import { normalizeEmailSubject, normalizeMessageId } from "@server/lib/utils";
import { findOrCreateCustomer } from "@server/services/customers";
import { getInboundEmailStatusId } from "@server/services/statuses";
import { createInboundCustomerMessage } from "@server/services/messages";
import { openConversationTicket } from "@server/services/conversation-open";
import {
  ensureEmailThread,
  findTicketByMessageHeaders,
  findTicketBySubjectAndContact,
} from "@server/services/email-threading";
import { persistMessageAttachment } from "@server/services/attachment-uploads";
import type { ParsedEmail } from "@shared/channels/email/transport";

function inboundProviderRef(parsed: ParsedEmail) {
  return parsed.providerRef?.direction === "inbound"
    ? parsed.providerRef
    : null;
}

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
  const providerRef = inboundProviderRef(parsed);

  if (providerRef) {
    const byRef = await findMessageByExternalRef({
      provider: providerRef.provider,
      integrationKey: providerRef.integrationKey,
      direction: providerRef.direction,
      refType: providerRef.refType,
      externalId: providerRef.externalId,
    });
    if (byRef) return byRef;
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
  const providerRef = inboundProviderRef(parsed);

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
  let messageId: string;
  if (!ticketId) {
    isNew = true;
    const statusId = await getInboundEmailStatusId();
    const contactAddress = parsed.from.trim().toLowerCase();
    const title = normalizeEmailSubject(parsed.subject) || parsed.subject;

    const opened = await openConversationTicket({
      origin: "email",
      title,
      contactAddress,
      customerId: customer.id,
      statusId,
      threadSubject: parsed.subject,
      rootMessageId: parsed.messageId,
      firstMessage: {
        body: parsed.body,
        authorId: customer.id,
        channel: "email",
        emailMessageId: parsed.messageId ?? null,
        emailInReplyTo: parsed.inReplyTo ?? null,
        emailFrom: formatInboundFrom(parsed),
        emailTo: parsed.to,
        emailCc: parsed.cc,
        emailSubject: parsed.subject,
        emailBodyHtml: parsed.bodyHtml ?? null,
      },
    });
    ticketId = opened.ticketId;
    messageId = opened.messageId;
  } else {
    await ensureEmailThread(ticketId, parsed.subject, parsed.messageId);
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
    });
    messageId = message.id;
  }

  if (providerRef) {
    await insertMessageExternalRef({
      messageId,
      provider: providerRef.provider,
      integrationKey: providerRef.integrationKey,
      direction: providerRef.direction,
      refType: providerRef.refType,
      externalId: providerRef.externalId,
      metadata: providerRef.metadata,
    });
  }

  await storeAttachments(ticketId, messageId, parsed.attachments);

  return { ticketId, messageId, isNew };
}
