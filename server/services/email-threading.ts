import { createAdminClient } from "@server/lib/supabase-admin";
import { ApiError } from "@server/lib/errors";
import {
  expandMessageIdVariants,
  normalizeEmailSubject,
  normalizeMessageId,
} from "@server/lib/utils";

const PLACEHOLDER_ROOT_SUFFIX = "@ticqex.local>";

export function placeholderThreadRootId(ticketId: string): string {
  return `<thread-${ticketId}${PLACEHOLDER_ROOT_SUFFIX}`;
}

export function isPlaceholderThreadRoot(rootMessageId: string): boolean {
  return rootMessageId.includes(PLACEHOLDER_ROOT_SUFFIX);
}

/** Register subject (and optional root Message-ID) for inbound fallback matching. */
export async function ensureEmailThread(
  ticketId: string,
  subject: string,
  rootMessageId?: string | null,
) {
  const db = createAdminClient();
  const normalizedSubject = normalizeEmailSubject(subject);
  const root =
    rootMessageId != null && rootMessageId !== ""
      ? normalizeMessageId(rootMessageId)
      : placeholderThreadRootId(ticketId);

  const { data: existing, error: selectError } = await db
    .from("email_threads")
    .select("id, root_message_id")
    .eq("ticket_id", ticketId)
    .order("created_at")
    .limit(1)
    .maybeSingle();
  if (selectError) throw ApiError.internal(selectError.message);

  if (existing) {
    const patch: { subject: string; root_message_id?: string } = {
      subject: normalizedSubject,
    };
    if (
      rootMessageId &&
      isPlaceholderThreadRoot(String(existing.root_message_id))
    ) {
      patch.root_message_id = root;
    }
    const { error: updateError } = await db
      .from("email_threads")
      .update(patch)
      .eq("id", existing.id);
    if (updateError) throw ApiError.internal(updateError.message);
    return;
  }

  const { error: insertError } = await db.from("email_threads").insert({
    ticket_id: ticketId,
    root_message_id: root,
    subject: normalizedSubject,
  });
  if (insertError) throw ApiError.internal(insertError.message);
}

export async function findTicketByMessageHeaders(
  inReplyTo?: string,
  references?: string[],
) {
  const db = createAdminClient();
  const rawIds = [inReplyTo, ...(references ?? [])].filter(Boolean) as string[];
  if (!rawIds.length) return null;

  const lookupIds = [
    ...new Set(rawIds.flatMap((id) => expandMessageIdVariants(id))),
  ];

  const { data } = await db
    .from("messages")
    .select("ticket_id")
    .in("email_message_id", lookupIds)
    .limit(1)
    .maybeSingle();

  return data?.ticket_id ?? null;
}

/**
 * Match inbound mail to an existing conversation started from the app or email.
 * Uses email_threads, ticket title, and recent message subjects.
 */
export async function findTicketBySubjectAndContact(
  subject: string,
  fromEmail: string,
  customerId: string,
) {
  const db = createAdminClient();
  const normalized = normalizeEmailSubject(subject);
  const contact = fromEmail.trim().toLowerCase();

  const { data: threadMatch } = await db
    .from("email_threads")
    .select("ticket_id, tickets!inner(id)")
    .eq("subject", normalized)
    .eq("tickets.customer_id", customerId)
    .limit(1)
    .maybeSingle();

  if (threadMatch) return threadMatch.ticket_id;

  const { data: byContact } = await db
    .from("tickets")
    .select("id, title")
    .eq("kind", "conversation")
    .eq("channel", "email")
    .eq("contact_address", contact)
    .eq("customer_id", customerId)
    .order("updated_at", { ascending: false })
    .limit(10);

  for (const ticket of byContact ?? []) {
    if (normalizeEmailSubject(String(ticket.title)) === normalized) {
      return ticket.id;
    }
  }

  const ticketIds = (byContact ?? []).map((t) => t.id);
  if (ticketIds.length) {
    const { data: messageRows } = await db
      .from("messages")
      .select("ticket_id, email_subject")
      .in("ticket_id", ticketIds)
      .not("email_subject", "is", null)
      .order("created_at", { ascending: false })
      .limit(30);

    for (const row of messageRows ?? []) {
      const subj = row.email_subject as string | null;
      if (subj && normalizeEmailSubject(subj) === normalized) {
        return row.ticket_id as string;
      }
    }
  }

  return null;
}
