import { createAdminClient } from "@server/lib/supabase-admin";
import { ApiError } from "@server/lib/errors";
import { getVisibleStatusIds } from "@server/services/statuses";

export type BoardFilterOptionCustomer = {
  id: string;
  username: string;
};

export type BoardFilterOptionAssignee = {
  id: string;
  username: string;
};

export type BoardFilterOptionTag = {
  id: string;
  name: string;
  color: string;
};

function sortByUsername<T extends { username: string }>(items: T[]): T[] {
  return [...items].sort((a, b) =>
    a.username.localeCompare(b.username, undefined, { sensitivity: "base" }),
  );
}

function sortByName<T extends { name: string }>(items: T[]): T[] {
  return [...items].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
  );
}

export async function getBoardFilterOptions() {
  const db = createAdminClient();
  const visibleStatusIds = await getVisibleStatusIds(db);

  if (!visibleStatusIds.length) {
    return { customers: [], assignees: [], tags: [] };
  }

  const { data: tickets, error: ticketErr } = await db
    .from("tickets")
    .select(
      "id, customer_id, assignee_id, customers(id, username), users:assignee_id(id, username)",
    )
    .in("status_id", visibleStatusIds);

  if (ticketErr) throw ApiError.internal(ticketErr.message);

  const customerMap = new Map<string, BoardFilterOptionCustomer>();
  const assigneeMap = new Map<string, BoardFilterOptionAssignee>();

  for (const ticket of tickets ?? []) {
    const customer = ticket.customers as unknown as BoardFilterOptionCustomer | null;
    if (customer?.id) {
      customerMap.set(customer.id, customer);
    }

    const assignee = ticket.users as unknown as BoardFilterOptionAssignee | null;
    if (assignee?.id) {
      assigneeMap.set(assignee.id, assignee);
    }
  }

  const ticketIds = (tickets ?? []).map((ticket) => ticket.id as string);
  const tagMap = new Map<string, BoardFilterOptionTag>();

  if (ticketIds.length) {
    const { data: links, error: tagErr } = await db
      .from("ticket_tags")
      .select("tags(id, name, color)")
      .in("ticket_id", ticketIds);

    if (tagErr) throw ApiError.internal(tagErr.message);

    for (const link of links ?? []) {
      const tag = link.tags as unknown as BoardFilterOptionTag | null;
      if (tag?.id) {
        tagMap.set(tag.id, tag);
      }
    }
  }

  return {
    customers: sortByUsername([...customerMap.values()]),
    assignees: sortByUsername([...assigneeMap.values()]),
    tags: sortByName([...tagMap.values()]),
  };
}
