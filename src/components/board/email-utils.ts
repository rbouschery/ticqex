import type { MessageRow } from "./types";

export { formatReplySubject } from "@/lib/format-subject";

export function isEmailMessage(msg: MessageRow): boolean {
  if (msg.visibility === "internal") return false;
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
