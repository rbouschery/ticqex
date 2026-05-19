export interface Attachment {
  filename: string;
  contentType: string;
  content: Buffer;
}

export interface OutboundEmail {
  to: string;
  from: string;
  subject: string;
  body: string;
  inReplyTo?: string;
  references?: string[];
  attachments?: Attachment[];
}

export interface ParsedAttachment {
  filename: string;
  contentType: string;
  content: Buffer;
  sizeBytes: number;
}

export interface ParsedEmail {
  from: string;
  to: string;
  subject: string;
  body: string;
  messageId: string;
  inReplyTo?: string;
  references?: string[];
  attachments: ParsedAttachment[];
}

export type InboundWebhookPayload = Record<string, unknown>;

export interface EmailAdapter {
  send(params: OutboundEmail): Promise<{ messageId: string }>;
  parseInbound(raw: InboundWebhookPayload): ParsedEmail;
  verifyWebhookSignature(
    payload: string,
    headers: Headers,
  ): boolean;
}
