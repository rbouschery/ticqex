import { createAdminClient } from "@server/lib/supabase-admin";
import { isTaskTicket, type TicketRow } from "@server/domain/ticket";
import { loadCustomFieldsMap } from "@server/services/custom-fields";
import { getTicketForContext } from "@server/services/tickets";

export async function getTicketContext(id: string) {
  const ticket = await getTicketForContext(id);
  const db = createAdminClient();

  const customerId = ticket.customer_id as string | undefined;
  const customerFields = customerId
    ? (await loadCustomFieldsMap(db, "customer", [customerId])).get(customerId) ??
      {}
    : {};

  const customerLabel =
    ticket.contact_address ??
    ticket.customer?.username ??
    "Unknown";
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

  if (isTaskTicket({ kind: ticket.kind as TicketRow["kind"] })) {
    if (ticket.body) {
      lines.push(String(ticket.body));
      lines.push("");
    }
  } else {
    const agentIds = [
      ...new Set(
        ticket.messages
          .filter((msg) => msg.author_type === "agent" && msg.author_id)
          .map((msg) => msg.author_id as string),
      ),
    ];
    const agentNames = new Map<string, string>();
    if (agentIds.length) {
      const { data: agents } = await db
        .from("users")
        .select("id, username")
        .in("id", agentIds);
      for (const agent of agents ?? []) {
        agentNames.set(agent.id, agent.username);
      }
    }

    for (const msg of ticket.messages) {
      let authorName = "System";
      if (msg.author_type === "customer") {
        authorName =
          (ticket.contact_address as string | null) ??
          ticket.customer?.username ??
          "Customer";
      } else if (msg.author_type === "agent" && msg.author_id) {
        authorName = agentNames.get(msg.author_id) ?? "Agent";
      }

      const date = new Date(String(msg.created_at))
        .toISOString()
        .slice(0, 16)
        .replace("T", " ");

      lines.push(`**${authorName}** (${date}):`);
      lines.push(String(msg.body));
      lines.push("");
    }
  }

  lines.push("---");
  return lines.join("\n");
}
