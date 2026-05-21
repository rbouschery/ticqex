import { createAdminClient } from "@server/lib/supabase-admin";
import { resendAdapter } from "./resend";
import { outboundTriggerIdempotencyKey } from "./trigger-keys";
import {
  finalizeAttachmentUploads,
  loadOutboundAttachments,
} from "@server/services/attachment-uploads";
import { ensureEmailThread } from "@server/services/email-threading";
import { normalizeMessageId } from "@server/lib/utils";

export async function sendOutboundEmailForMessage(messageId: string) {
  const db = createAdminClient();

  const { data: message } = await db
    .from("messages")
    .select("*")
    .eq("id", messageId)
    .single();
  if (!message || message.visibility !== "public") return;
  if (message.email_message_id) return;

  const from = message.email_from as string | null;
  const toList = (message.email_to ?? []) as string[];
  const to = toList[0];
  const cc = (message.email_cc ?? []) as string[];
  const subject = message.email_subject as string | null;
  if (!from || !to || !subject) return;

  const { data: ticket } = await db
    .from("tickets")
    .select("id")
    .eq("id", message.ticket_id)
    .single();
  if (!ticket) return;

  const { data: threadMessages } = await db
    .from("messages")
    .select("email_message_id")
    .eq("ticket_id", ticket.id)
    .not("email_message_id", "is", null)
    .order("created_at");

  const references = (threadMessages ?? [])
    .map((m) => m.email_message_id)
    .filter(Boolean) as string[];

  const lastRef = references[references.length - 1];

  const staged = await loadOutboundAttachments(messageId);

  const { messageId: sentMessageId, resendId } = await resendAdapter.send({
    to,
    from,
    cc: cc.length ? cc : undefined,
    subject,
    body: message.body,
    html: message.email_body_html ?? undefined,
    inReplyTo: lastRef,
    references: references.length ? references : undefined,
    attachments: staged.map((att) => ({
      filename: att.filename,
      contentType: att.contentType,
      content: att.content,
    })),
  });

  const canonicalMessageId = normalizeMessageId(sentMessageId);

  await db
    .from("messages")
    .update({
      email_message_id: canonicalMessageId,
      email_delivery_status: "sent",
      resend_outbound_id: resendId ?? null,
    })
    .eq("id", messageId);

  if (subject) {
    await ensureEmailThread(ticket.id, subject, canonicalMessageId);
  }

  await finalizeAttachmentUploads(ticket.id, messageId, staged);
}

export async function enqueueOutboundEmail(messageId: string) {
  if (!process.env.TRIGGER_SECRET_KEY) {
    throw new Error("TRIGGER_SECRET_KEY is required to send outbound email");
  }

  const { tasks } = await import("@trigger.dev/sdk/v3");
  await tasks.trigger(
    "send-outbound-email",
    { messageId },
    { idempotencyKey: outboundTriggerIdempotencyKey(messageId) },
  );
}
