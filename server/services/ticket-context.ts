import { createAdminClient } from "@server/lib/supabase-admin";
import { isTaskTicket, type TicketRow } from "@server/domain/ticket";
import {
  listDefinitions,
  loadCustomFieldsMap,
} from "@server/services/custom-fields";
import { getSettings } from "@server/services/settings";
import { getTicketForContext } from "@server/services/tickets";
import {
  resolveCopyContextSettings,
  type CopyContextSettings,
} from "@shared/copy-context";
import type { CustomFieldDefinition } from "@shared/custom-fields";
import {
  formatCustomFieldValue,
  hasCustomFieldValue,
} from "@shared/custom-fields/format";

function appendCustomFieldLines(
  lines: string[],
  definitions: CustomFieldDefinition[],
  values: Record<string, unknown>,
) {
  for (const definition of definitions) {
    const value = values[definition.key];
    if (!hasCustomFieldValue(value)) continue;
    lines.push(
      `**${definition.label}:** ${formatCustomFieldValue(definition.type, value, "export")}`,
    );
  }
}

export function buildTicketContextMarkdown(
  ticket: Awaited<ReturnType<typeof getTicketForContext>>,
  settings: CopyContextSettings,
  contactFieldDefinitions: CustomFieldDefinition[],
  ticketFieldDefinitions: CustomFieldDefinition[],
  contactFields: Record<string, unknown>,
  agentNames: Map<string, string>,
): string {
  const lines: string[] = [];
  const prepend = settings.prepend_text.trim();

  if (prepend) {
    lines.push(prepend, "");
  }

  lines.push(`# ${ticket.title}`, "");

  if (settings.append_contact) {
    const contactLabel =
      ticket.contact_address ?? ticket.contact?.username ?? "Unknown";
    lines.push(`**Contact:** ${contactLabel}`);

    if (settings.append_contact_custom_fields) {
      appendCustomFieldLines(lines, contactFieldDefinitions, contactFields);
    }
  }

  const tagNames = ticket.tags.map((tag) => tag.name).join(", ") || "none";
  lines.push(
    `**Status:** ${ticket.status?.name ?? "Unknown"}`,
    `**Tags:** ${tagNames}`,
  );

  if (settings.append_custom_fields) {
    appendCustomFieldLines(lines, ticketFieldDefinitions, ticket.custom_fields);
  }

  lines.push("", "---", "");

  if (isTaskTicket({ kind: ticket.kind as TicketRow["kind"] })) {
    if (ticket.body) {
      lines.push(String(ticket.body), "");
    }
  } else {
    for (const msg of ticket.messages) {
      let authorName = "System";
      if (msg.author_type === "contact") {
        authorName =
          (ticket.contact_address as string | null) ??
          ticket.contact?.username ??
          "Contact";
      } else if (msg.author_type === "agent" && msg.author_id) {
        authorName = agentNames.get(msg.author_id) ?? "Agent";
      }

      const date = new Date(String(msg.created_at))
        .toISOString()
        .slice(0, 16)
        .replace("T", " ");

      lines.push(`**${authorName}** (${date}):`);
      lines.push(String(msg.body), "");
    }
  }

  lines.push("---");
  return lines.join("\n");
}

export async function getTicketContext(id: string) {
  const [ticket, globalSettings] = await Promise.all([
    getTicketForContext(id),
    getSettings(),
  ]);
  const settings = resolveCopyContextSettings(globalSettings.copy_context);
  const db = createAdminClient();

  const contactId = ticket.contact_id as string | undefined;
  const contactFields = contactId
    ? (await loadCustomFieldsMap(db, "contact", [contactId])).get(contactId) ??
      {}
    : {};

  const [contactFieldDefinitions, ticketFieldDefinitions] = await Promise.all([
    settings.append_contact && settings.append_contact_custom_fields
      ? listDefinitions(db, "contact")
      : Promise.resolve([]),
    settings.append_custom_fields
      ? listDefinitions(db, "ticket")
      : Promise.resolve([]),
  ]);

  const agentNames = new Map<string, string>();
  if (
    !isTaskTicket({ kind: ticket.kind as TicketRow["kind"] }) &&
    ticket.messages.length > 0
  ) {
    const agentIds = [
      ...new Set(
        ticket.messages
          .filter((msg) => msg.author_type === "agent" && msg.author_id)
          .map((msg) => msg.author_id as string),
      ),
    ];

    if (agentIds.length) {
      const { data: agents } = await db
        .from("users")
        .select("id, username")
        .in("id", agentIds);
      for (const agent of agents ?? []) {
        agentNames.set(agent.id, agent.username);
      }
    }
  }

  return buildTicketContextMarkdown(
    ticket,
    settings,
    contactFieldDefinitions,
    ticketFieldDefinitions,
    contactFields,
    agentNames,
  );
}
