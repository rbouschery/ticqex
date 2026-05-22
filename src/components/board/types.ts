import type { TicketChannel, TicketKind } from "@/types/database";

export type BoardLane = {
  status: { id: string; name: string; color: string };
  tickets: BoardTicket[];
  total_count?: number;
};

export type BoardTicket = {
  id: string;
  title: string;
  kind: TicketKind;
  channel: TicketChannel | null;
  origin: string;
  customer_id: string | null;
  assignee_id: string | null;
  preview: string;
  customer: { username: string; initials: string } | null;
  assignee: { username: string; initials: string } | null;
  custom_fields: Record<string, unknown>;
  tags: { id: string; name: string; color: string }[];
  updated_at: string;
  unread_count: number;
};

export type TicketDetailBase = BoardTicket & {
  body: string | null;
  contact_address: string | null;
  status_id: string;
  status: { id: string; name: string; color: string } | null;
};

export type TaskTicketDetail = TicketDetailBase & {
  kind: "task";
  messages?: never;
};

export type ConversationTicketDetail = TicketDetailBase & {
  kind: "conversation";
  channel: TicketChannel;
  messages: MessageRow[];
};

export type TicketDetail = TaskTicketDetail | ConversationTicketDetail;

export function isTaskDetail(t: TicketDetail): t is TaskTicketDetail {
  return t.kind === "task";
}

export function isConversationDetail(
  t: TicketDetail,
): t is ConversationTicketDetail {
  return t.kind === "conversation";
}

export type MessageAttachment = {
  id: string;
  filename: string;
  content_type: string;
  size_bytes: number;
};

export type EmailDeliveryStatus =
  | "sent"
  | "delivered"
  | "bounced"
  | "failed"
  | "pending";

export type MessageRow = {
  id: string;
  body: string;
  visibility: "public" | "internal";
  author_type: string;
  author_id: string | null;
  channel: string;
  created_at: string;
  read?: boolean;
  email_from?: string | null;
  email_to?: string[];
  email_cc?: string[];
  email_subject?: string | null;
  email_body_html?: string | null;
  email_delivery_status?: EmailDeliveryStatus | string | null;
  attachments?: MessageAttachment[];
};

export type EmailSnippet = {
  id: string;
  title: string;
  body: string;
};

export type AttachmentUpload = {
  id: string;
  filename: string;
  content_type: string;
  size_bytes: number;
};

export type EmailComposePayload = {
  body: string;
  email?: {
    cc?: string[];
    subject?: string;
    reply_all?: boolean;
    include_quote?: boolean;
    attachment_upload_ids?: string[];
  };
};
