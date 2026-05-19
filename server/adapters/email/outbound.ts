import { createAdminClient } from "@server/lib/supabase-admin";
import { resendAdapter } from "./resend";

const supportEmail = () =>
  process.env.SUPPORT_EMAIL ?? "support@ticqex.local";
const supportFromName = () =>
  process.env.SUPPORT_FROM_NAME ?? "Support";

export async function sendOutboundEmailForMessage(messageId: string) {
  const db = createAdminClient();

  const { data: message } = await db
    .from("messages")
    .select("*")
    .eq("id", messageId)
    .single();
  if (!message || message.visibility !== "public") return;

  const { data: ticket } = await db
    .from("tickets")
    .select("id, title, customer_id")
    .eq("id", message.ticket_id)
    .single();
  if (!ticket) return;

  const { data: customer } = await db
    .from("customers")
    .select("username")
    .eq("id", ticket.customer_id)
    .single();
  if (!customer) return;

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
  const from = `${supportFromName()} <${supportEmail()}>`;

  const { messageId: sentMessageId } = await resendAdapter.send({
    to: customer.username,
    from,
    subject: `Re: ${ticket.title}`,
    body: message.body,
    inReplyTo: lastRef,
    references: references.length ? references : undefined,
  });

  await db
    .from("messages")
    .update({ email_message_id: sentMessageId })
    .eq("id", messageId);
}

export async function enqueueOutboundEmail(messageId: string) {
  if (process.env.TRIGGER_SECRET_KEY) {
    const { tasks } = await import("@trigger.dev/sdk/v3");
    await tasks.trigger("send-outbound-email", { messageId });
    return;
  }
  await sendOutboundEmailForMessage(messageId);
}
