import { createAdminClient } from "@server/lib/supabase-admin";
import { ApiError } from "@server/lib/errors";
import { normalizeMessageId } from "@server/lib/utils";
import {
  canSendEmail,
  isConversationTicket,
  loadTicketRow,
  type TicketRow,
} from "@server/domain/ticket";
import { linkUploadsToMessage } from "@server/services/attachment-uploads";
import { prepareAgentOutboundReply } from "@server/services/outbound-replies";
import { loadReadMessageIds } from "@server/services/message-reads";
import { touchTicket } from "@server/services/ticket-touch";
import type { AuthContext } from "@server/middleware/auth";
import type { MessageDbRow } from "@/types/database";

export type MessageAttachmentRow = {
  id: string;
  filename: string;
  content_type: string;
  size_bytes: number;
};

export function formatMessageRow(
  msg: MessageDbRow,
  readIds?: Set<string>,
  attachmentsMap?: Map<string, MessageAttachmentRow[]>,
) {
  const isIncoming = msg.author_type === "customer";
  const read =
    readIds === undefined
      ? undefined
      : isIncoming
        ? readIds.has(msg.id)
        : true;

  return {
    id: msg.id,
    body: msg.body,
    visibility: msg.visibility,
    author_type: msg.author_type,
    author_id: msg.author_id,
    channel: msg.channel,
    created_at: msg.created_at,
    ...(read !== undefined ? { read } : {}),
    email_from: msg.email_from ?? null,
    email_to: msg.email_to ?? [],
    email_cc: msg.email_cc ?? [],
    email_subject: msg.email_subject ?? null,
    email_body_html: msg.email_body_html ?? null,
    email_delivery_status: msg.email_delivery_status ?? null,
    attachments: attachmentsMap?.get(msg.id) ?? [],
  };
}

export function enrichMessages(
  rows: MessageDbRow[],
  options: {
    readIds?: Set<string>;
    attachmentsMap: Map<string, MessageAttachmentRow[]>;
  },
) {
  return rows.map((msg) =>
    formatMessageRow(msg, options.readIds, options.attachmentsMap),
  );
}

export async function loadAttachmentsForMessages(messageIds: string[]) {
  const map = new Map<string, MessageAttachmentRow[]>();
  if (!messageIds.length) return map;

  const db = createAdminClient();
  const { data, error } = await db
    .from("attachments")
    .select("id, message_id, filename, content_type, size_bytes")
    .in("message_id", messageIds);
  if (error) throw ApiError.internal(error.message);

  for (const row of data ?? []) {
    const list = map.get(row.message_id) ?? [];
    list.push({
      id: row.id,
      filename: row.filename,
      content_type: row.content_type,
      size_bytes: row.size_bytes,
    });
    map.set(row.message_id, list);
  }

  return map;
}

async function loadMessageTicket(ticketId: string): Promise<TicketRow> {
  const ticket = await loadTicketRow(ticketId);
  if (!isConversationTicket(ticket)) {
    throw ApiError.badRequest("Task tickets do not have messages");
  }
  return ticket;
}

export async function listMessages(ticketId: string) {
  await loadMessageTicket(ticketId);

  const db = createAdminClient();
  const { data, error } = await db
    .from("messages")
    .select("*")
    .eq("ticket_id", ticketId)
    .eq("visibility", "public")
    .order("created_at");
  if (error) throw ApiError.internal(error.message);
  return data ?? [];
}

export async function enrichTicketMessages(
  rows: MessageDbRow[],
  userId?: string,
) {
  const messageIds = rows.map((m) => m.id);
  const attachmentsMap = await loadAttachmentsForMessages(messageIds);

  let readIds: Set<string> | undefined;
  if (userId && rows.length) {
    const customerIds = rows
      .filter((m) => m.author_type === "customer")
      .map((m) => m.id);
    readIds = await loadReadMessageIds(customerIds, userId);
  }

  return enrichMessages(rows, { readIds, attachmentsMap });
}

export type InsertMessageInput = {
  ticketId: string;
  body: string;
  visibility: "public" | "internal";
  authorType: "customer" | "agent" | "system";
  authorId: string | null;
  channel: "email" | "api" | "admin";
  emailMessageId?: string | null;
  emailInReplyTo?: string | null;
  emailFrom?: string | null;
  emailTo?: string[];
  emailCc?: string[];
  emailSubject?: string | null;
  emailBodyHtml?: string | null;
  resendInboundId?: string | null;
  emailDeliveryStatus?: "pending" | null;
};

async function insertMessage(input: InsertMessageInput): Promise<MessageDbRow> {
  const db = createAdminClient();
  const { data: message, error } = await db
    .from("messages")
    .insert({
      ticket_id: input.ticketId,
      body: input.body,
      visibility: input.visibility,
      author_type: input.authorType,
      author_id: input.authorId,
      channel: input.channel,
      email_message_id: input.emailMessageId ?? null,
      email_in_reply_to: input.emailInReplyTo ?? null,
      email_from: input.emailFrom ?? null,
      email_to: input.emailTo ?? [],
      email_cc: input.emailCc ?? [],
      email_subject: input.emailSubject ?? null,
      email_body_html: input.emailBodyHtml ?? null,
      resend_inbound_id: input.resendInboundId ?? null,
      email_delivery_status: input.emailDeliveryStatus ?? null,
    })
    .select()
    .single();

  if (error) throw ApiError.internal(error.message);

  await touchTicket(input.ticketId);

  return message;
}

async function loadAgentReplyContext(ticketId: string) {
  const db = createAdminClient();
  const [{ data: lastCustomerMessage }, { data: lastSubjectMessage }] =
    await Promise.all([
      db
        .from("messages")
        .select("*")
        .eq("ticket_id", ticketId)
        .eq("author_type", "customer")
        .eq("visibility", "public")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      db
        .from("messages")
        .select("*")
        .eq("ticket_id", ticketId)
        .eq("visibility", "public")
        .not("email_subject", "is", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

  return { lastCustomerMessage, lastSubjectMessage };
}

export async function createAgentReply(
  ticketId: string,
  input: {
    body: string;
    channel?: "email" | "api" | "admin";
    email?: {
      cc?: string[];
      subject?: string;
      reply_all?: boolean;
      include_quote?: boolean;
      attachment_upload_ids?: string[];
    };
  },
  auth: AuthContext,
) {
  const ticketRow = await loadMessageTicket(ticketId);
  const channel = input.channel ?? (auth.type === "api_key" ? "api" : "admin");
  const shouldSendEmail = canSendEmail(ticketRow);

  let body = input.body;
  let emailTo: string[] = [];
  let emailCc: string[] = [];
  let emailSubject: string | null = null;
  let emailFrom: string | null = null;

  if (shouldSendEmail) {
    const contactAddress = ticketRow.contact_address?.trim();
    if (!contactAddress) {
      throw ApiError.internal("Ticket contact address not found");
    }

    const replyContext = await loadAgentReplyContext(ticketId);
    const prepared = await prepareAgentOutboundReply(
      {
        title: ticketRow.title,
        contact_address: contactAddress,
      },
      replyContext,
      { body: input.body, email: input.email },
    );
    body = prepared.body;
    emailFrom = prepared.emailFrom;
    emailTo = prepared.emailTo;
    emailCc = prepared.emailCc;
    emailSubject = prepared.emailSubject;
  }

  const message = await insertMessage({
    ticketId,
    body,
    visibility: "public",
    authorType: "agent",
    authorId: auth.userId,
    channel,
    emailFrom,
    emailTo,
    emailCc,
    emailSubject,
    emailDeliveryStatus: shouldSendEmail ? "pending" : null,
  });

  if (shouldSendEmail && input.email?.attachment_upload_ids?.length) {
    await linkUploadsToMessage(
      ticketId,
      message.id,
      input.email.attachment_upload_ids,
    );
  }

  return { message, ticket: ticketRow, shouldSendEmail };
}

export async function createInboundCustomerMessage(
  ticketId: string,
  input: {
    body: string;
    authorId: string;
    emailMessageId?: string;
    emailInReplyTo?: string;
    emailFrom: string;
    emailTo: string[];
    emailCc: string[];
    emailSubject: string;
    emailBodyHtml?: string | null;
    resendInboundId?: string | null;
  },
) {
  await loadMessageTicket(ticketId);

  const message = await insertMessage({
    ticketId,
    body: input.body,
    visibility: "public",
    authorType: "customer",
    authorId: input.authorId,
    channel: "email",
    emailMessageId: input.emailMessageId
      ? normalizeMessageId(input.emailMessageId)
      : null,
    emailInReplyTo: input.emailInReplyTo ?? null,
    emailFrom: input.emailFrom,
    emailTo: input.emailTo,
    emailCc: input.emailCc,
    emailSubject: input.emailSubject,
    emailBodyHtml: input.emailBodyHtml ?? null,
    resendInboundId: input.resendInboundId ?? null,
  });

  return { message };
}
