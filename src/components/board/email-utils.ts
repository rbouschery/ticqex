import type { MessageRow } from "./types";

export { formatReplySubject } from "@/lib/format-subject";

export function isEmailMessage(msg: MessageRow): boolean {
  return (
    msg.channel === "email" ||
    Boolean(msg.email_from || msg.email_subject || msg.email_body_html)
  );
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function parseEmailAddress(value: string | null | undefined): string {
  if (!value?.trim()) return "";
  const match = value.match(/<([^>]+)>/);
  if (match) return match[1].trim();
  return value.trim();
}

export function messageSenderEmail(
  msg: MessageRow,
  ticket: { contact_address: string | null; customer: { username: string } | null },
): string {
  const from = parseEmailAddress(msg.email_from);
  if (from) return from;
  if (msg.author_type === "customer") {
    return ticket.contact_address ?? ticket.customer?.username ?? "Customer";
  }
  return "Support";
}
