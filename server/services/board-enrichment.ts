import { buildTicketCardSurface } from "@server/channels";
import { createAdminClient } from "@server/lib/supabase-admin";
import { initials, messagePreview } from "@server/lib/utils";
import type { BoardTicketRow } from "@server/domain/ticket";
import {
  listDefinitions,
  loadCustomFieldsMap,
} from "@server/services/custom-fields";
import { resolveOpenContactFieldsForDisplay } from "@shared/custom-fields/format";
import { getUnreadCountsByTicket } from "@server/services/message-reads";
import { loadTagsForTickets } from "@server/services/tags";
import {
  filterTicketCardSurface,
  type ResolvedTicketFieldLayout,
  type TicketCustomFieldDefinition,
} from "@shared/ticket-fields";

export async function enrichTicketsForBoard(
  ticketRows: BoardTicketRow[],
  userId?: string,
  layout?: ResolvedTicketFieldLayout,
  customFieldDefinitions?: TicketCustomFieldDefinition[],
) {
  const db = createAdminClient();
  const ids = ticketRows.map((t) => t.id);
  const contactIds = [
    ...new Set(
      ticketRows
        .map((t) => t.contact_id)
        .filter((id): id is string => typeof id === "string" && id.length > 0),
    ),
  ];

  const conversationIds = ticketRows
    .filter((t) => t.kind === "conversation")
    .map((t) => t.id);

  const messagesPromise =
    conversationIds.length > 0
      ? db
          .from("messages")
          .select("ticket_id, body, created_at")
          .in("ticket_id", conversationIds)
          .eq("visibility", "public")
          .or("email_delivery_status.is.null,email_delivery_status.neq.draft")
          .order("created_at", { ascending: false })
      : Promise.resolve({
          data: [] as { ticket_id: string; body: string; created_at: string }[],
        });

  const [
    fieldsMap,
    tagsMap,
    openContactFieldDefinitions,
    unreadCounts,
    messagesResult,
  ] = await Promise.all([
    loadCustomFieldsMap(db, "ticket", ids),
    loadTagsForTickets(ids),
    listDefinitions(db, "contact", { showOpenInTicket: true }),
    userId
      ? getUnreadCountsByTicket(conversationIds, userId)
      : Promise.resolve(new Map<string, number>()),
    messagesPromise,
  ]);

  const openContactFieldIds = openContactFieldDefinitions.map((def) => def.id);
  const contactFieldsMap =
    openContactFieldIds.length > 0 && contactIds.length > 0
      ? await loadCustomFieldsMap(db, "contact", contactIds, {
          fieldIds: openContactFieldIds,
        })
      : new Map<string, Record<string, unknown>>();

  const previews = new Map<string, string>();

  for (const t of ticketRows) {
    if (t.kind === "task") {
      const body = (t.body ?? "").trim();
      if (body) previews.set(t.id, messagePreview(body));
    }
  }

  for (const msg of messagesResult.data ?? []) {
    if (!previews.has(msg.ticket_id)) {
      previews.set(msg.ticket_id, messagePreview(msg.body));
    }
  }

  return ticketRows.map((t) => {
    const tags = tagsMap.get(t.id) ?? [];
    const custom_fields = fieldsMap.get(t.id) ?? {};
    const contact = t.contacts
      ? { username: t.contacts.username, initials: initials(t.contacts.username) }
      : null;
    const assignee = t.users
      ? { username: t.users.username, initials: initials(t.users.username) }
      : null;

    const preview = previews.get(t.id) ?? "";
    let card_surface = buildTicketCardSurface({
      kind: t.kind,
      channel: t.channel ?? null,
      contact_address: t.contact_address ?? null,
      custom_fields,
      preview,
      origin: t.origin,
    });

    if (layout && customFieldDefinitions) {
      card_surface = filterTicketCardSurface(
        card_surface,
        layout,
        customFieldDefinitions,
      );
    }

    const contact_open_fields =
      t.contact_id != null
        ? resolveOpenContactFieldsForDisplay(
            openContactFieldDefinitions,
            contactFieldsMap.get(t.contact_id) ?? {},
          )
        : [];

    return {
      id: t.id,
      title: t.title,
      kind: t.kind,
      channel: t.channel ?? null,
      origin: t.origin,
      contact_id: t.contact_id,
      assignee_id: t.assignee_id,
      preview,
      contact,
      assignee,
      custom_fields,
      contact_open_fields,
      tags,
      card_surface,
      created_at: t.created_at,
      updated_at: t.updated_at,
      unread_count: unreadCounts.get(t.id) ?? 0,
    };
  });
}
