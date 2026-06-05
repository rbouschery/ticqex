import type { TicketChannel } from "@/types/database";
import type { TicketOrigin } from "@shared/channels";

export type {
  TicketCardBadge,
  TicketCardBadgeVariant,
  TicketCardChip,
  TicketCardSurface,
} from "@shared/channels";

export type BoardLane = {
  status: { id: string; name: string; color: string };
  tickets: BoardTicket[];
  total_count?: number;
  has_more?: boolean;
};

type BoardTicketBase = {
  id: string;
  title: string;
  origin: TicketOrigin;
  contact_id: string | null;
  assignee_id: string | null;
  preview: string;
  contact: { username: string; initials: string } | null;
  assignee: { username: string; initials: string } | null;
  custom_fields: Record<string, unknown>;
  contact_open_fields: { label: string; value: string }[];
  tags: { id: string; name: string; color: string }[];
  card_surface: import("@shared/channels").TicketCardSurface;
  created_at: string;
  updated_at: string;
  unread_count: number;
};

export type TaskBoardTicket = BoardTicketBase & {
  kind: "task";
  channel: null;
};

export type ConversationBoardTicket = BoardTicketBase & {
  kind: "conversation";
  channel: TicketChannel;
};

export type BoardTicket = TaskBoardTicket | ConversationBoardTicket;

export type {
  ConversationTicketDetail,
  EmailDeliveryStatus,
  MessageAttachment,
  MessageRow,
  TaskTicketDetail,
  TicketDetail,
} from "@/types/tickets";
export { isConversationDetail, isTaskDetail } from "@/types/tickets";

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
