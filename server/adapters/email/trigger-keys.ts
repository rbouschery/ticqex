import type { InboundWebhookPayload } from "./types";

function webhookData(raw: InboundWebhookPayload): Record<string, unknown> {
  const envelope = raw as Record<string, unknown>;
  return (envelope.data ?? envelope) as Record<string, unknown>;
}

export function inboundTriggerIdempotencyKey(raw: InboundWebhookPayload) {
  const data = webhookData(raw);
  const emailId = data.email_id ? String(data.email_id) : undefined;
  if (emailId) return `inbound:resend:${emailId}`;

  const messageId = data.message_id ? String(data.message_id) : undefined;
  if (messageId) return `inbound:msg:${messageId}`;

  return undefined;
}

export function outboundTriggerIdempotencyKey(messageId: string) {
  return `outbound:message:${messageId}`;
}
