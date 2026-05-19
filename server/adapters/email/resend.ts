import { Resend } from "resend";
import { createHmac, randomUUID, timingSafeEqual } from "crypto";
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
        subject: params.subject,
        text: params.body,
        headers,
      });

      if (error) throw new Error(error.message);
      const messageId = data?.id ? `<${data.id}@resend.dev>` : `<${randomUUID()}@ticqex.local>`;
      return { messageId };
    },

    parseInbound(raw: InboundWebhookPayload): ParsedEmail {
      const data = (raw.data ?? raw) as Record<string, unknown>;
      const from = extractAddress(String(data.from ?? ""));
      const to = extractAddress(String(data.to ?? ""));
      const subject = String(data.subject ?? "(no subject)");
      const text = String(data.text ?? data.html ?? "");
      const headers = (data.headers ?? {}) as Record<string, string | string[]>;

      const messageId = String(
        headers["message-id"] ?? headers["Message-ID"] ?? `<${randomUUID()}@inbound>`,
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

    verifyWebhookSignature(payload: string, headers: Headers) {
      if (!webhookSecret) return process.env.NODE_ENV !== "production";
      const signature = headers.get("svix-signature") ?? headers.get("resend-signature");
      if (!signature) return false;

      const expected = createHmac("sha256", webhookSecret).update(payload).digest("hex");
      try {
        return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
      } catch {
        return signature === expected || signature.includes(expected);
      }
    },
  };
}

export const resendAdapter = createResendAdapter();
