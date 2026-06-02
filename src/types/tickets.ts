import type { Tag } from "@/components/tags/types";
import type { TicketOrigin } from "@shared/channels";
import type { TicketChannel } from "@/types/database";

type TicketSummaryBase = {
  id: string;
  title: string;
  origin: TicketOrigin;
  customer_id: string | null;
  assignee_id: string | null;
  preview: string;
  customer: { id: string; username: string } | null;
  assignee: { id: string; username: string } | null;
  custom_fields: Record<string, unknown>;
  tags: Tag[];
  created_at: string;
  updated_at: string;
  unread_count: number;
  body: string | null;
  contact_address: string | null;
  status_id: string;
  status: { id: string; name: string; color: string } | null;
  card_surface?: import("@shared/channels").TicketCardSurface;
};

export type TaskTicketSummary = TicketSummaryBase & {
  kind: "task";
  channel: null;
};

export type ConversationTicketSummary = TicketSummaryBase & {
  kind: "conversation";
  channel: TicketChannel;
};

export type TicketSummary = TaskTicketSummary | ConversationTicketSummary;

export function isTaskSummary(
  summary: TicketSummary,
): summary is TaskTicketSummary {
  return summary.kind === "task";
}

export function isConversationSummary(
  summary: TicketSummary,
): summary is ConversationTicketSummary {
  return summary.kind === "conversation";
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
  | "pending"
  | "draft";

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

export type TaskTicketDetail = TaskTicketSummary & {
  messages: [];
};

export type ConversationTicketDetail = ConversationTicketSummary & {
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
