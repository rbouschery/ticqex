import { Resend } from "resend";
import { randomUUID } from "crypto";
import type {
  EmailAdapter,
  InboundWebhookPayload,
  OutboundEmail,
  ParsedEmail,
} from "./types";

function extractAddress(raw: string): string {
  const match = raw.match(/<([^>]+)>/);
  return (match?.[1] ?? raw).trim().toLowerCase();
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

export function createResendAdapter(): EmailAdapter {
  const apiKey = process.env.RESEND_API_KEY;
  const webhookSecret = process.env.RESEND_INBOUND_WEBHOOK_SECRET;
  const resend = apiKey ? new Resend(apiKey) : null;
  const webhookClient = new Resend("");

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
        subject: params.subject,
        text: params.body,
        headers,
      });

      if (error) throw new Error(error.message);
      const messageId = data?.id ? `<${data.id}@resend.dev>` : `<${randomUUID()}@ticqex.local>`;
      return { messageId };
    },

    parseInbound(raw: InboundWebhookPayload): ParsedEmail {
      const data = webhookData(raw);
      const from = extractAddress(String(data.from ?? ""));
      const toRaw = data.to;
      const to = extractAddress(
        Array.isArray(toRaw) ? String(toRaw[0] ?? "") : String(toRaw ?? ""),
      );
      const subject = String(data.subject ?? "(no subject)");
      const text = String(data.text ?? data.html ?? "");
      const headers = (data.headers ?? {}) as Record<string, string | string[]>;

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

      const attachments: ParsedEmail["attachments"] = [];
      const rawAttachments = (data.attachments ?? []) as Array<Record<string, unknown>>;
      for (const att of rawAttachments) {
        const content = att.content
          ? Buffer.from(String(att.content), "base64")
          : Buffer.alloc(0);
        attachments.push({
          filename: String(att.filename ?? "attachment"),
          contentType: String(att.content_type ?? att.contentType ?? "application/octet-stream"),
          content,
          sizeBytes: content.length,
        });
      }

      return {
        from,
        to,
        subject,
        body: text,
        messageId,
        inReplyTo: typeof inReplyTo === "string" ? inReplyTo : undefined,
        references,
        attachments,
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

      return {
        ...parsed,
        from: extractAddress(received.from) || parsed.from,
        to: extractAddress(received.to[0] ?? "") || parsed.to,
        subject: received.subject || parsed.subject,
        body,
        messageId: received.message_id
          ? String(received.message_id)
          : parsed.messageId,
        inReplyTo,
        references,
      };
    },

    verifyWebhookSignature(payload: string, headers: Headers) {
      if (!webhookSecret) return process.env.NODE_ENV !== "production";

      const id = headers.get("svix-id");
      const timestamp = headers.get("svix-timestamp");
      const signature = headers.get("svix-signature");
      if (!id || !timestamp || !signature) return false;

      try {
        webhookClient.webhooks.verify({
          payload,
          headers: { id, timestamp, signature },
          webhookSecret,
        });
        return true;
      } catch {
        return false;
      }
    },
  };
}

export const resendAdapter = createResendAdapter();
