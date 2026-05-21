import { verifySvixWebhook } from "@server/adapters/email/verify-svix";
import { createAdminClient } from "@server/lib/supabase-admin";

export type EmailDeliveryStatus = "sent" | "delivered" | "bounced" | "failed";

function eventsWebhookSecret(): string | undefined {
  return (
    process.env.RESEND_EVENTS_WEBHOOK_SECRET ??
    process.env.RESEND_INBOUND_WEBHOOK_SECRET
  );
}

export function verifyResendEventsWebhook(
  payload: string,
  headers: Headers,
): boolean {
  return verifySvixWebhook(payload, headers, eventsWebhookSecret());
}

export function mapResendEventToDeliveryStatus(
  eventType: string,
): EmailDeliveryStatus | null {
  switch (eventType) {
    case "email.sent":
      return "sent";
    case "email.delivered":
      return "delivered";
    case "email.bounced":
      return "bounced";
    case "email.complained":
    case "email.failed":
      return "failed";
    default:
      return null;
  }
}

export interface ResendDeliveryEventResult {
  processed: boolean;
  status?: EmailDeliveryStatus;
  messageId?: string;
  reason?: "ignored_event" | "missing_email_id" | "message_not_found";
}

export async function handleResendDeliveryEvent(
  payload: Record<string, unknown>,
): Promise<ResendDeliveryEventResult> {
  const eventType = String(payload.type ?? "");
  const status = mapResendEventToDeliveryStatus(eventType);
  if (!status) {
    return { processed: false, reason: "ignored_event" };
  }

  const data = (payload.data ?? payload) as Record<string, unknown>;
  const resendOutboundId = data.email_id ? String(data.email_id) : "";
  if (!resendOutboundId) {
    return { processed: false, reason: "missing_email_id" };
  }

  const db = createAdminClient();
  const { data: message, error: findError } = await db
    .from("messages")
    .select("id")
    .eq("resend_outbound_id", resendOutboundId)
    .maybeSingle();

  if (findError) throw findError;
  if (!message) {
    return { processed: false, reason: "message_not_found" };
  }

  const { error: updateError } = await db
    .from("messages")
    .update({ email_delivery_status: status })
    .eq("id", message.id);

  if (updateError) throw updateError;

  return { processed: true, status, messageId: message.id };
}
