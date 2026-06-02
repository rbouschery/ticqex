import { buildTicketCardSurface } from "@server/channels";
import { createAdminClient } from "@server/lib/supabase-admin";
import { initials, messagePreview } from "@server/lib/utils";
import type { BoardTicketRow } from "@server/domain/ticket";
import { loadCustomFieldsMap } from "@server/services/custom-fields";
import { getUnreadCountsByTicket } from "@server/services/message-reads";
import { loadTagsForTickets } from "@server/services/tags";

export async function enrichTicketsForBoard(
  ticketRows: BoardTicketRow[],
  userId?: string,
) {
  const db = createAdminClient();
  const ids = ticketRows.map((t) => t.id);
  const fieldsMap = await loadCustomFieldsMap(db, "ticket", ids);
  const tagsMap = await loadTagsForTickets(ids);

  const conversationIds = ticketRows
    .filter((t) => t.kind === "conversation")
    .map((t) => t.id);

  const unreadCounts = userId
    ? await getUnreadCountsByTicket(conversationIds, userId)
    : new Map<string, number>();

  const previews = new Map<string, string>();

  for (const t of ticketRows) {
    if (t.kind === "task") {
      const body = (t.body ?? "").trim();
      if (body) previews.set(t.id, messagePreview(body));
    }
  }

  if (conversationIds.length) {
    const { data: msgs } = await db
      .from("messages")
      .select("ticket_id, body, created_at")
      .in("ticket_id", conversationIds)
      .eq("visibility", "public")
      .or("email_delivery_status.is.null,email_delivery_status.neq.draft")
      .order("created_at", { ascending: false });

    for (const msg of msgs ?? []) {
      if (!previews.has(msg.ticket_id)) {
        previews.set(msg.ticket_id, messagePreview(msg.body));
      }
    }
  }

  return ticketRows.map((t) => {
    const tags = tagsMap.get(t.id) ?? [];
    const custom_fields = fieldsMap.get(t.id) ?? {};
    const customer = t.customers
      ? { username: t.customers.username, initials: initials(t.customers.username) }
      : null;
    const assignee = t.users
      ? { username: t.users.username, initials: initials(t.users.username) }
      : null;

    const preview = previews.get(t.id) ?? "";
    const card_surface = buildTicketCardSurface({
      kind: t.kind,
      channel: t.channel ?? null,
      contact_address: t.contact_address ?? null,
      custom_fields,
      preview,
      origin: t.origin,
    });

    return {
      id: t.id,
      title: t.title,
      kind: t.kind,
      channel: t.channel ?? null,
      origin: t.origin,
      customer_id: t.customer_id,
      assignee_id: t.assignee_id,
      preview,
      customer,
      assignee,
      custom_fields,
      tags,
      card_surface,
      created_at: t.created_at,
      updated_at: t.updated_at,
      unread_count: unreadCounts.get(t.id) ?? 0,
    };
  });
}
