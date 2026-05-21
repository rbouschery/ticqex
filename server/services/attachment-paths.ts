export const ATTACHMENTS_BUCKET = "attachments";

/** Staged outbound upload before send (keyed by upload id). */
export function pendingPath(
  ticketId: string,
  uploadId: string,
  filename: string,
): string {
  return `attachments/${ticketId}/pending/${uploadId}/${filename}`;
}

/** Persisted attachment after inbound receive or outbound send. */
export function finalPath(
  ticketId: string,
  messageId: string,
  filename: string,
): string {
  return `attachments/${ticketId}/${messageId}/${filename}`;
}
