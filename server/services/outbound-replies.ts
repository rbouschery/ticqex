import { ApiError } from "@server/lib/errors";
import {
  buildQuotedReply,
  formatReplySubject,
} from "@server/lib/utils";
import { getSettings } from "@server/services/settings";
import type { MessageDbRow } from "@/types/database";

const supportEmail = () =>
  process.env.SUPPORT_EMAIL ?? "support@ticqex.local";

function dedupeEmails(addresses: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const addr of addresses) {
    const normalized = addr.trim().toLowerCase();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(addr.trim());
  }
  return result;
}

function computeReplyCc(
  options: { cc?: string[]; reply_all?: boolean },
  lastCustomerMessage: MessageDbRow | null,
  customerEmail: string,
): string[] {
  const customer = customerEmail.trim().toLowerCase();
  const support = supportEmail().trim().toLowerCase();

  if (!options.reply_all) {
    return dedupeEmails(options.cc ?? []);
  }

  const merged: string[] = [...(options.cc ?? [])];
  for (const addr of lastCustomerMessage?.email_cc ?? []) {
    merged.push(addr);
  }
  for (const addr of lastCustomerMessage?.email_to ?? []) {
    merged.push(addr);
  }

  return dedupeEmails(
    merged.filter((addr) => {
      const normalized = addr.trim().toLowerCase();
      return normalized && normalized !== customer && normalized !== support;
    }),
  );
}

export type AgentOutboundReplyInput = {
  body: string;
  email?: {
    cc?: string[];
    subject?: string;
    reply_all?: boolean;
    include_quote?: boolean;
  };
};

export type PreparedAgentOutboundReply = {
  body: string;
  emailFrom: string;
  emailTo: string[];
  emailCc: string[];
  emailSubject: string;
};

export type AgentOutboundReplyContext = {
  lastCustomerMessage: MessageDbRow | null;
  lastSubjectMessage: MessageDbRow | null;
};

function prepareAgentReplyHeaders(
  ticket: { title: string; contact_address: string },
  context: AgentOutboundReplyContext,
  input: AgentOutboundReplyInput,
): Omit<PreparedAgentOutboundReply, "body"> {
  const contactEmail = ticket.contact_address.trim();
  if (!contactEmail) {
    throw ApiError.internal("Ticket contact address not found");
  }

  const { lastCustomerMessage, lastSubjectMessage } = context;

  return {
    emailTo: [contactEmail],
    emailCc: computeReplyCc(
      {
        cc: input.email?.cc,
        reply_all: input.email?.reply_all,
      },
      lastCustomerMessage,
      contactEmail,
    ),
    emailSubject: input.email?.subject
      ? input.email.subject
      : formatReplySubject(
          lastSubjectMessage?.email_subject ?? null,
          ticket.title,
        ),
    emailFrom: `${process.env.SUPPORT_FROM_NAME ?? "Support"} <${supportEmail()}>`,
  };
}

export async function prepareAgentDraftReply(
  ticket: {
    title: string;
    contact_address: string;
  },
  context: AgentOutboundReplyContext,
  input: AgentOutboundReplyInput,
): Promise<PreparedAgentOutboundReply> {
  const headers = prepareAgentReplyHeaders(ticket, context, input);
  return { body: input.body.trim(), ...headers };
}

export async function prepareAgentOutboundReply(
  ticket: {
    title: string;
    contact_address: string;
  },
  context: AgentOutboundReplyContext,
  input: AgentOutboundReplyInput,
): Promise<PreparedAgentOutboundReply> {
  const contactEmail = ticket.contact_address.trim();
  if (!contactEmail) {
    throw ApiError.internal("Ticket contact address not found");
  }

  const { lastCustomerMessage } = context;
  const headers = prepareAgentReplyHeaders(ticket, context, input);

  let body = input.body;

  if (input.email?.include_quote && lastCustomerMessage) {
    const quoteAuthor =
      contactEmail ?? String(lastCustomerMessage.email_from ?? "Customer");
    body += buildQuotedReply(
      lastCustomerMessage.body,
      quoteAuthor,
      lastCustomerMessage.created_at,
    );
  }

  const settings = await getSettings();
  const signature = String(settings.email_signature ?? "").trim();
  if (signature) {
    body = `${body.trim()}\n\n${signature}`;
  }

  return { body, ...headers };
}
