import { createAdminClient } from "@server/lib/supabase-admin";
import { ApiError } from "@server/lib/errors";
import { initials, messagePreview, parsePagination } from "@server/lib/utils";
import { findOrCreateCustomer } from "@server/services/customers";
import { getDefaultStatusId } from "@server/services/statuses";
import {
  filterTicketIdsByCustomFields,
  loadCustomFieldsMap,
  setCustomFields,
} from "@server/services/custom-fields";
import {
  loadTagsForTickets,
  setTicketTags,
} from "@server/services/tags";
import type { AuthContext } from "@server/middleware/auth";

type CreateTicketInput = {
  title: string;
  customer: { username: string };
  status_id?: string;
  assignee_id?: string | null;
  origin?: "manual" | "api" | "email";
  tags?: string[];
  message?: {
    body: string;
    visibility?: "public" | "internal";
    channel?: "email" | "api" | "admin";
  };
  custom_fields?: Record<string, unknown>;
};

export async function listTickets(
  searchParams: URLSearchParams,
  meta: { filters: Record<string, unknown> },
) {
  const db = createAdminClient();
  const { page, perPage, offset } = parsePagination(searchParams);

  const customFieldFilters: Record<string, string> = {};
  for (const [key, value] of searchParams.entries()) {
    if (key.startsWith("custom_fields.")) {
      customFieldFilters[key.slice("custom_fields.".length)] = value;
    }
  }

  const filteredIds = await filterTicketIdsByCustomFields(db, customFieldFilters);
  if (filteredIds !== null && filteredIds.length === 0) {
    return { tickets: [], total: 0, page, perPage };
  }

  let query = db
    .from("tickets")
    .select(
      "*, customers(id, username), users:assignee_id(id, username), status_types(id, name, color)",
      { count: "exact" },
    )
    .order("updated_at", { ascending: false });

  const statusId = searchParams.get("status_id");
  const assigneeId = searchParams.get("assignee_id");
  const customerId = searchParams.get("customer_id");
  const origin = searchParams.get("origin");
  const tag = searchParams.get("tag");

  if (statusId) query = query.eq("status_id", statusId);
  if (assigneeId) query = query.eq("assignee_id", assigneeId);
  if (customerId) query = query.eq("customer_id", customerId);
  if (origin) query = query.eq("origin", origin);
  if (filteredIds) query = query.in("id", filteredIds);

  if (tag) {
    const { data: tagRow } = await db.from("tags").select("id").eq("name", tag).maybeSingle();
    if (!tagRow) return { tickets: [], total: 0, page, perPage };
    const { data: links } = await db
      .from("ticket_tags")
      .select("ticket_id")
      .eq("tag_id", tagRow.id);
    const ids = (links ?? []).map((l) => l.ticket_id);
    if (!ids.length) return { tickets: [], total: 0, page, perPage };
    query = query.in("id", ids);
  }

  const { data, count, error } = await query.range(offset, offset + perPage - 1);
  if (error) throw ApiError.internal(error.message);

  const ticketIds = (data ?? []).map((t) => t.id);
  const fieldsMap = await loadCustomFieldsMap(db, "ticket", ticketIds);
  const tagsMap = await loadTagsForTickets(ticketIds);

  return {
    tickets: (data ?? []).map((t) => formatTicketListItem(t, fieldsMap, tagsMap)),
    total: count ?? 0,
    page,
    perPage,
    meta: { ...meta, filters: { ...meta.filters, ...customFieldFilters } },
  };
}

function formatTicketListItem(
  t: Record<string, unknown>,
  fieldsMap: Map<string, Record<string, unknown>>,
  tagsMap: Map<string, { id: string; name: string; color: string }[]>,
) {
  const customer = t.customers as { id: string; username: string } | null;
  const assignee = t.users as { id: string; username: string } | null;
  const status = t.status_types as { id: string; name: string; color: string } | null;

  return {
    id: t.id,
    title: t.title,
    origin: t.origin,
    customer_id: t.customer_id,
    status_id: t.status_id,
    assignee_id: t.assignee_id,
    created_at: t.created_at,
    updated_at: t.updated_at,
    customer: customer
      ? { id: customer.id, username: customer.username }
      : null,
    assignee: assignee
      ? { id: assignee.id, username: assignee.username }
      : null,
    status,
    custom_fields: fieldsMap.get(t.id as string) ?? {},
    tags: tagsMap.get(t.id as string) ?? [],
  };
}

export async function getTicket(id: string) {
  const db = createAdminClient();
  const { data, error } = await db
    .from("tickets")
    .select(
      "*, customers(id, username), users:assignee_id(id, username, email), status_types(id, name, color)",
    )
    .eq("id", id)
    .single();

  if (error || !data) throw ApiError.notFound("Ticket not found");

  const fieldsMap = await loadCustomFieldsMap(db, "ticket", [id]);
  const tagsMap = await loadTagsForTickets([id]);

  const { data: messages } = await db
    .from("messages")
    .select("*")
    .eq("ticket_id", id)
    .order("created_at");

  return {
    ...formatTicketListItem(data, fieldsMap, tagsMap),
    messages: messages ?? [],
  };
}

export async function createTicket(input: CreateTicketInput, auth: AuthContext) {
  const db = createAdminClient();
  const customer = await findOrCreateCustomer(input.customer.username);
  const statusId = input.status_id ?? (await getDefaultStatusId());

  const { data: ticket, error } = await db
    .from("tickets")
    .insert({
      title: input.title,
      customer_id: customer.id,
      status_id: statusId,
      assignee_id: input.assignee_id ?? null,
      origin: input.origin ?? "api",
    })
    .select()
    .single();

  if (error) throw ApiError.internal(error.message);

  if (input.tags?.length) await setTicketTags(ticket.id, input.tags);
  await setCustomFields(db, "ticket", ticket.id, input.custom_fields);

  if (input.message) {
    await createMessage(ticket.id, {
      body: input.message.body,
      visibility: input.message.visibility ?? "public",
      channel: input.message.channel ?? "api",
      authorType: "agent",
      authorId: auth.userId,
    });
  }

  return getTicket(ticket.id);
}

export async function updateTicket(
  id: string,
  input: {
    title?: string;
    status_id?: string;
    assignee_id?: string | null;
    tags?: string[];
    custom_fields?: Record<string, unknown>;
  },
) {
  const db = createAdminClient();
  const patch: Record<string, unknown> = {};
  if (input.title !== undefined) patch.title = input.title;
  if (input.status_id !== undefined) patch.status_id = input.status_id;
  if (input.assignee_id !== undefined) patch.assignee_id = input.assignee_id;

  if (Object.keys(patch).length) {
    const { error } = await db.from("tickets").update(patch).eq("id", id);
    if (error) throw ApiError.internal(error.message);
  }

  if (input.tags) await setTicketTags(id, input.tags);
  await setCustomFields(db, "ticket", id, input.custom_fields);

  return getTicket(id);
}

export async function deleteTicket(id: string) {
  const db = createAdminClient();
  const { error } = await db.from("tickets").delete().eq("id", id);
  if (error) throw ApiError.internal(error.message);
}

export async function listMessages(ticketId: string) {
  const db = createAdminClient();
  const { data, error } = await db
    .from("messages")
    .select("*")
    .eq("ticket_id", ticketId)
    .order("created_at");
  if (error) throw ApiError.internal(error.message);
  return data ?? [];
}

export async function createMessage(
  ticketId: string,
  input: {
    body: string;
    visibility?: "public" | "internal";
    channel?: "email" | "api" | "admin";
    authorType?: "customer" | "agent" | "system";
    authorId?: string | null;
    emailMessageId?: string;
    emailInReplyTo?: string;
  },
  auth?: AuthContext,
) {
  const db = createAdminClient();

  const { data: ticket } = await db
    .from("tickets")
    .select("id, origin")
    .eq("id", ticketId)
    .single();
  if (!ticket) throw ApiError.notFound("Ticket not found");

  const authorType = input.authorType ?? (auth ? "agent" : "system");
  const authorId = input.authorId ?? auth?.userId ?? null;
  const visibility = input.visibility ?? "public";
  const channel = input.channel ?? (auth?.type === "api_key" ? "api" : "admin");

  const { data: message, error } = await db
    .from("messages")
    .insert({
      ticket_id: ticketId,
      body: input.body,
      visibility,
      author_type: authorType,
      author_id: authorId,
      channel,
      email_message_id: input.emailMessageId ?? null,
      email_in_reply_to: input.emailInReplyTo ?? null,
    })
    .select()
    .single();

  if (error) throw ApiError.internal(error.message);

  await db
    .from("tickets")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", ticketId);

  return { message, ticket, shouldSendEmail: visibility === "public" && channel !== "email" };
}

export async function getTicketContext(id: string, excludeInternal = false) {
  const ticket = await getTicket(id);
  const db = createAdminClient();

  const customerId = ticket.customer_id as string | undefined;
  const customerFields = customerId
    ? (await loadCustomFieldsMap(db, "customer", [customerId])).get(customerId) ??
      {}
    : {};

  const customerLabel = ticket.customer?.username ?? "Unknown";
  const planField = customerFields.plan ?? ticket.custom_fields?.plan;
  const customerLine = planField
    ? `**Customer:** ${customerLabel} (Plan: ${planField})`
    : `**Customer:** ${customerLabel}`;

  const tagNames = ticket.tags.map((t) => t.name).join(", ") || "none";
  const lines: string[] = [
    `# ${ticket.title}`,
    "",
    customerLine,
    `**Status:** ${ticket.status?.name ?? "Unknown"}`,
    `**Tags:** ${tagNames}`,
    "",
    "---",
    "",
  ];

  for (const msg of ticket.messages) {
    if (excludeInternal && msg.visibility === "internal") continue;

    let authorName = "System";
    if (msg.author_type === "customer" && ticket.customer) {
      authorName = ticket.customer.username;
    } else if (msg.author_type === "agent" && msg.author_id) {
      const { data: agent } = await db
        .from("users")
        .select("username")
        .eq("id", msg.author_id)
        .maybeSingle();
      authorName = agent?.username ?? "Agent";
    }

    const date = new Date(msg.created_at).toISOString().slice(0, 16).replace("T", " ");

    if (msg.visibility === "internal") {
      lines.push(`[Internal note — ${authorName}, ${date}]:`);
    } else {
      lines.push(`**${authorName}** (${date}):`);
    }
    lines.push(msg.body);
    lines.push("");
  }

  lines.push("---");
  return lines.join("\n");
}

export async function enrichTicketsForBoard(ticketRows: Record<string, unknown>[]) {
  const db = createAdminClient();
  const ids = ticketRows.map((t) => t.id as string);
  const fieldsMap = await loadCustomFieldsMap(db, "ticket", ids);
  const tagsMap = await loadTagsForTickets(ids);

  const previews = new Map<string, string>();
  if (ids.length) {
    const { data: msgs } = await db
      .from("messages")
      .select("ticket_id, body, created_at")
      .in("ticket_id", ids)
      .eq("visibility", "public")
      .order("created_at", { ascending: true });

    for (const msg of msgs ?? []) {
      if (!previews.has(msg.ticket_id)) {
        previews.set(msg.ticket_id, messagePreview(msg.body));
      }
    }
  }

  return ticketRows.map((t) => {
    const customer = t.customers as { username: string } | null;
    const assignee = t.users as { username: string } | null;
    return {
      id: t.id,
      title: t.title,
      preview: previews.get(t.id as string) ?? "",
      customer: customer
        ? { username: customer.username, initials: initials(customer.username) }
        : null,
      assignee: assignee
        ? { username: assignee.username, initials: initials(assignee.username) }
        : null,
      custom_fields: fieldsMap.get(t.id as string) ?? {},
      tags: tagsMap.get(t.id as string) ?? [],
      updated_at: t.updated_at,
    };
  });
}
