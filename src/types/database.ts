export type UserRole = "admin" | "agent";

export type TicketKind = "task" | "conversation";

export type TicketChannel = "email";

export type MessageDbRow = {
  id: string;
  ticket_id: string;
  body: string;
  visibility: "public" | "internal";
  author_type: "customer" | "agent" | "system";
  author_id: string | null;
  channel: "email" | "api" | "admin";
  email_message_id: string | null;
  email_in_reply_to: string | null;
  created_at: string;
  email_from: string | null;
  email_to: string[];
  email_cc: string[];
  email_subject: string | null;
  email_body_html: string | null;
  email_delivery_status: string | null;
  resend_inbound_id: string | null;
  resend_outbound_id: string | null;
};

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];
