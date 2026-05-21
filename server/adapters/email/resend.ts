import { Resend } from "resend";
import { randomUUID } from "crypto";
import type {
  EmailAdapter,
  InboundWebhookPayload,
  OutboundEmail,
  ParsedEmail,
} from "./types";
import { verifySvixWebhook } from "./verify-svix";

function extractAddress(raw: string): string {
  const match = raw.match(/<([^>]+)>/);
  return (match?.[1] ?? raw).trim().toLowerCase();
}

function extractDisplayName(raw: string): string | undefined {
  const match = raw.match(/^([^<]+)</);
  if (!match) return undefined;
  return match[1]!.trim().replace(/^["']|["']$/g, "");
}

function parseAddressList(raw: string | string[] | undefined | null): string[] {
  if (!raw) return [];
  const values = Array.isArray(raw) ? raw : [raw];
  const addresses: string[] = [];
  for (const value of values) {
    for (const part of String(value).split(",")) {
      const addr = extractAddress(part);
      if (addr) addresses.push(addr);
    }
  }
  return [...new Set(addresses)];
}

function webhookData(raw: InboundWebhookPayload): Record<string, unknown> {
  const envelope = raw as Record<string, unknown>;
  return (envelope.data ?? envelope) as Record<string, unknown>;
}

function htmlToPlainText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function headerValue(
  headers: Record<string, string | string[]> | null | undefined,
  name: string,
): string | undefined {
  if (!headers) return undefined;
  const lower = name.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() !== lower) continue;
    return Array.isArray(value) ? value[0] : value;
  }
  return undefined;
}

function parseAttachments(
  rawAttachments: unknown,
): ParsedEmail["attachments"] {
  const attachments: ParsedEmail["attachments"] = [];
  for (const att of (rawAttachments ?? []) as Array<Record<string, unknown>>) {
    const content = att.content
      ? Buffer.from(String(att.content), "base64")
      : Buffer.alloc(0);
    attachments.push({
      filename: String(att.filename ?? "attachment"),
      contentType: String(
        att.content_type ?? att.contentType ?? "application/octet-stream",
      ),
      content,
      sizeBytes: content.length,
    });
  }
  return attachments;
}

export function createResendAdapter(): EmailAdapter {
  const apiKey = process.env.RESEND_API_KEY;
  const webhookSecret = process.env.RESEND_INBOUND_WEBHOOK_SECRET;
  const resend = apiKey ? new Resend(apiKey) : null;

  return {
    async send(params: OutboundEmail) {
      if (!resend) throw new Error("RESEND_API_KEY not configured");

      const headers: Record<string, string> = {};
      if (params.inReplyTo) headers["In-Reply-To"] = params.inReplyTo;
      if (params.references?.length) {
        headers.References = params.references.join(" ");
      }

      const { data, error } = await resend.emails.send({
        from: params.from,
        to: params.to,
        cc: params.cc?.length ? params.cc : undefined,
        subject: params.subject,
        text: params.body,
        html: params.html,
        headers,
        attachments: params.attachments?.map((att) => ({
          filename: att.filename,
          content: att.content,
        })),
      });

      if (error) throw new Error(error.message);
      const resendId = data?.id;
      const messageId = resendId
        ? `<${resendId}@resend.dev>`
        : `<${randomUUID()}@ticqex.local>`;
      return { messageId, resendId };
    },

    parseInbound(raw: InboundWebhookPayload): ParsedEmail {
      const data = webhookData(raw);
      const fromRaw = String(data.from ?? "");
      const from = extractAddress(fromRaw);
      const fromName = extractDisplayName(fromRaw);
      const to = parseAddressList(
        data.to as string | string[] | undefined,
      );
      const cc = parseAddressList(
        (data.cc ?? data.cc_addresses) as string | string[] | undefined,
      );
      const subject = String(data.subject ?? "(no subject)");
      const text = String(data.text ?? "");
      const html = data.html ? String(data.html) : undefined;
      const headers = (data.headers ?? {}) as Record<string, string | string[]>;

      const headerTo = headerValue(headers, "to");
      const headerCc = headerValue(headers, "cc");
      const resolvedTo = to.length ? to : parseAddressList(headerTo);
      const resolvedCc = cc.length ? cc : parseAddressList(headerCc);

      const messageId = String(
        data.message_id ??
          headers["message-id"] ??
          headers["Message-ID"] ??
          `<${randomUUID()}@inbound>`,
      );
      const inReplyTo = headers["in-reply-to"] ?? headers["In-Reply-To"];
      const referencesRaw = headers.references ?? headers.References;

      let references: string[] | undefined;
      if (typeof referencesRaw === "string") {
        references = referencesRaw.split(/\s+/).filter(Boolean);
      } else if (Array.isArray(referencesRaw)) {
        references = referencesRaw.flatMap((r) => r.split(/\s+/)).filter(Boolean);
      }

      return {
        from,
        fromName,
        to: resolvedTo,
        cc: resolvedCc,
        subject,
        body: text || (html ? htmlToPlainText(html) : ""),
        bodyHtml: html,
        messageId,
        resendEmailId: data.email_id ? String(data.email_id) : undefined,
        inReplyTo: typeof inReplyTo === "string" ? inReplyTo : undefined,
        references,
        attachments: parseAttachments(data.attachments),
      };
    },

    async resolveInbound(raw: InboundWebhookPayload): Promise<ParsedEmail> {
      const parsed = this.parseInbound(raw);
      const emailId = String(webhookData(raw).email_id ?? "");
      if (!emailId || !resend) return parsed;

      const { data: received, error } = await resend.emails.receiving.get(emailId);
      if (error || !received) {
        console.error(
          "Failed to fetch received email body:",
          error?.message ?? "no data",
          emailId,
        );
        return parsed;
      }

      const body =
        received.text?.trim() ||
        (received.html ? htmlToPlainText(received.html) : "") ||
        parsed.body;

      const apiHeaders = received.headers;
      const inReplyTo =
        headerValue(apiHeaders, "in-reply-to") ?? parsed.inReplyTo;
      const referencesRaw = headerValue(apiHeaders, "references");
      let references = parsed.references;
      if (referencesRaw) {
        references = referencesRaw.split(/\s+/).filter(Boolean);
      }

      const fromRaw = received.from ?? "";
      const to = parseAddressList(received.to);
      const cc =
        parseAddressList(headerValue(apiHeaders, "cc")) ||
        parsed.cc;

      return {
        ...parsed,
        from: extractAddress(fromRaw) || parsed.from,
        fromName: extractDisplayName(fromRaw) ?? parsed.fromName,
        to: to.length ? to : parsed.to,
        cc,
        subject: received.subject || parsed.subject,
        body,
        bodyHtml: received.html ?? parsed.bodyHtml,
        messageId: received.message_id
          ? String(received.message_id)
          : parsed.messageId,
        inReplyTo,
        references,
        attachments: received.attachments?.length
          ? parseAttachments(received.attachments)
          : parsed.attachments,
      };
    },

    verifyWebhookSignature(payload: string, headers: Headers) {
      return verifySvixWebhook(payload, headers, webhookSecret);
    },
  };
}

export const resendAdapter = createResendAdapter();
