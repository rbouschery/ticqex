import { createAdminClient } from "@server/lib/supabase-admin";
import { ApiError } from "@server/lib/errors";
import { normalizeMessageId } from "@server/lib/utils";
import {
  canSendEmail,
  isConversationTicket,
  loadTicketRow,
  type TicketRow,
} from "@server/domain/ticket";
import { linkUploadsToMessage, loadStagedAttachmentsForMessages } from "@server/services/attachment-uploads";
import {
  assertChannelReadyToSend,
  assertSendRecipientMatchesLockedFields,
} from "@server/channels/field-enforcement";
import {
  prepareAgentDraftReply,
  prepareAgentOutboundReply,
} from "@server/services/outbound-replies";
import { loadReadMessageIds } from "@server/services/message-reads";
import { touchTicket } from "@server/services/ticket-touch";
import type { AuthContext } from "@server/middleware/auth";
import type { MessageDbRow } from "@/types/database";

export const EMAIL_DRAFT_STATUS = "draft";

const PUBLIC_NON_DRAFT_FILTER =
  "email_delivery_status.is.null,email_delivery_status.neq.draft";

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
    throw ApiError.badRequest("This ticket does not have a message thread");
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
    .or(PUBLIC_NON_DRAFT_FILTER)
    .order("created_at");
  if (error) throw ApiError.internal(error.message);
  return data ?? [];
}

export async function listTicketDrafts(ticketId: string) {
  await loadMessageTicket(ticketId);

  const db = createAdminClient();
  const { data, error } = await db
    .from("messages")
    .select("*")
    .eq("ticket_id", ticketId)
    .eq("email_delivery_status", EMAIL_DRAFT_STATUS)
    .order("created_at", { ascending: false });
  if (error) throw ApiError.internal(error.message);
  return data ?? [];
}

export async function listEnrichedDrafts(ticketId: string) {
  const rows = await listTicketDrafts(ticketId);
  const messageIds = rows.map((m) => m.id);
  const attachmentsMap = await loadStagedAttachmentsForMessages(messageIds);
  return enrichMessages(rows, { attachmentsMap });
}

export async function listEnrichedMessages(ticketId: string, userId?: string) {
  const rows = await listMessages(ticketId);
  return enrichTicketMessages(rows, userId);
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
  emailDeliveryStatus?: "pending" | "draft" | null;
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
        .or(PUBLIC_NON_DRAFT_FILTER)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      db
        .from("messages")
        .select("*")
        .eq("ticket_id", ticketId)
        .eq("visibility", "public")
        .or(PUBLIC_NON_DRAFT_FILTER)
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
      throw ApiError.badRequest("Ticket contact address is required to send email");
    }

    assertChannelReadyToSend("email", {
      contact_address: contactAddress,
      custom_fields: {},
    });

    const replyContext = await loadAgentReplyContext(ticketId);
    const prepared = await prepareAgentOutboundReply(
      {
        title: ticketRow.title,
        contact_address: contactAddress,
      },
      replyContext,
      { body: input.body, email: input.email },
    );

    assertSendRecipientMatchesLockedFields(
      "email",
      { contact_address: contactAddress, custom_fields: {} },
      prepared.emailTo,
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

export async function createAgentDraft(
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
  const isEmailTicket = canSendEmail(ticketRow);

  let body = input.body.trim();
  let emailTo: string[] = [];
  let emailCc: string[] = [];
  let emailSubject: string | null = null;
  let emailFrom: string | null = null;

  if (isEmailTicket) {
    const contactAddress = ticketRow.contact_address?.trim();
    if (!contactAddress) {
      throw ApiError.badRequest(
        "Ticket contact address is required to save an email draft",
      );
    }

    const replyContext = await loadAgentReplyContext(ticketId);
    const prepared = await prepareAgentDraftReply(
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
    emailDeliveryStatus: isEmailTicket ? "draft" : null,
  });

  if (isEmailTicket && input.email?.attachment_upload_ids?.length) {
    await linkUploadsToMessage(
      ticketId,
      message.id,
      input.email.attachment_upload_ids,
    );
  }

  return { message };
}

async function loadDraftMessage(
  ticketId: string,
  messageId: string,
): Promise<MessageDbRow> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("messages")
    .select("*")
    .eq("id", messageId)
    .eq("ticket_id", ticketId)
    .eq("email_delivery_status", EMAIL_DRAFT_STATUS)
    .maybeSingle();
  if (error) throw ApiError.internal(error.message);
  if (!data) throw ApiError.notFound("Draft not found");
  return data;
}

export async function updateAgentDraft(
  ticketId: string,
  messageId: string,
  input: {
    body: string;
    email?: {
      cc?: string[];
      subject?: string;
      reply_all?: boolean;
      attachment_upload_ids?: string[];
    };
  },
  auth: AuthContext,
) {
  void auth;
  await loadDraftMessage(ticketId, messageId);
  const ticketRow = await loadMessageTicket(ticketId);
  const isEmailTicket = canSendEmail(ticketRow);

  let body = input.body.trim();
  let emailTo: string[] = [];
  let emailCc: string[] = [];
  let emailSubject: string | null = null;
  let emailFrom: string | null = null;

  if (isEmailTicket) {
    const contactAddress = ticketRow.contact_address?.trim();
    if (!contactAddress) {
      throw ApiError.badRequest(
        "Ticket contact address is required to update an email draft",
      );
    }

    const replyContext = await loadAgentReplyContext(ticketId);
    const prepared = await prepareAgentDraftReply(
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

  const db = createAdminClient();
  const { data: message, error } = await db
    .from("messages")
    .update({
      body,
      email_from: emailFrom,
      email_to: emailTo,
      email_cc: emailCc,
      email_subject: emailSubject,
    })
    .eq("id", messageId)
    .eq("ticket_id", ticketId)
    .eq("email_delivery_status", EMAIL_DRAFT_STATUS)
    .select()
    .single();
  if (error) throw ApiError.internal(error.message);

  if (isEmailTicket && input.email?.attachment_upload_ids?.length) {
    await linkUploadsToMessage(
      ticketId,
      messageId,
      input.email.attachment_upload_ids,
    );
  }

  await touchTicket(ticketId);
  return { message };
}

export async function deleteAgentDraft(
  ticketId: string,
  messageId: string,
  auth: AuthContext,
) {
  void auth;
  await loadDraftMessage(ticketId, messageId);

  const db = createAdminClient();
  const { error } = await db
    .from("messages")
    .delete()
    .eq("id", messageId)
    .eq("ticket_id", ticketId)
    .eq("email_delivery_status", EMAIL_DRAFT_STATUS);
  if (error) throw ApiError.internal(error.message);

  await touchTicket(ticketId);
  return { deleted: true as const };
}

export async function sendAgentDraft(
  ticketId: string,
  messageId: string,
  input: {
    include_quote?: boolean;
    reply_all?: boolean;
  },
  auth: AuthContext,
) {
  const ticketRow = await loadMessageTicket(ticketId);
  if (!canSendEmail(ticketRow)) {
    throw ApiError.badRequest("This ticket does not support email");
  }

  const draft = await loadDraftMessage(ticketId, messageId);
  const contactAddress = ticketRow.contact_address?.trim();
  if (!contactAddress) {
    throw ApiError.badRequest("Ticket contact address is required to send email");
  }

  assertChannelReadyToSend("email", {
    contact_address: contactAddress,
    custom_fields: {},
  });

  const replyContext = await loadAgentReplyContext(ticketId);
  const prepared = await prepareAgentOutboundReply(
    {
      title: ticketRow.title,
      contact_address: contactAddress,
    },
    replyContext,
    {
      body: draft.body,
      email: {
        cc: (draft.email_cc ?? []) as string[],
        subject: draft.email_subject ?? undefined,
        reply_all: input.reply_all,
        include_quote: input.include_quote,
      },
    },
  );

  assertSendRecipientMatchesLockedFields(
    "email",
    { contact_address: contactAddress, custom_fields: {} },
    prepared.emailTo,
  );

  const db = createAdminClient();
  const { data: message, error } = await db
    .from("messages")
    .update({
      body: prepared.body,
      email_from: prepared.emailFrom,
      email_to: prepared.emailTo,
      email_cc: prepared.emailCc,
      email_subject: prepared.emailSubject,
      email_delivery_status: "pending",
      author_id: auth.userId,
    })
    .eq("id", messageId)
    .eq("ticket_id", ticketId)
    .eq("email_delivery_status", EMAIL_DRAFT_STATUS)
    .select()
    .single();
  if (error) throw ApiError.internal(error.message);

  await touchTicket(ticketId);
  return { message, shouldSendEmail: true };
}

export type CreateCustomerMessageInput = {
  body: string;
  authorId: string;
  channel: "email" | "api";
  emailMessageId?: string | null;
  emailInReplyTo?: string | null;
  emailFrom?: string | null;
  emailTo?: string[];
  emailCc?: string[];
  emailSubject?: string | null;
  emailBodyHtml?: string | null;
};

export async function createCustomerMessage(
  ticketId: string,
  input: CreateCustomerMessageInput,
) {
  await loadMessageTicket(ticketId);

  const message = await insertMessage({
    ticketId,
    body: input.body,
    visibility: "public",
    authorType: "customer",
    authorId: input.authorId,
    channel: input.channel,
    emailMessageId: input.emailMessageId
      ? normalizeMessageId(input.emailMessageId)
      : null,
    emailInReplyTo: input.emailInReplyTo ?? null,
    emailFrom: input.emailFrom ?? null,
    emailTo: input.emailTo ?? [],
    emailCc: input.emailCc ?? [],
    emailSubject: input.emailSubject ?? null,
    emailBodyHtml: input.emailBodyHtml ?? null,
  });

  return { message };
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
  },
) {
  return createCustomerMessage(ticketId, {
    body: input.body,
    authorId: input.authorId,
    channel: "email",
    emailMessageId: input.emailMessageId ?? null,
    emailInReplyTo: input.emailInReplyTo ?? null,
    emailFrom: input.emailFrom,
    emailTo: input.emailTo,
    emailCc: input.emailCc,
    emailSubject: input.emailSubject,
    emailBodyHtml: input.emailBodyHtml ?? null,
  });
}
