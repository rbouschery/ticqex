"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PaperclipIcon } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import type { MessageAttachment, MessageRow } from "./types";
import { formatBytes } from "./email-utils";

function AttachmentList({
  messageId,
  attachments,
}: {
  messageId: string;
  attachments: MessageAttachment[];
}) {
  if (!attachments.length) return null;

  return (
    <ul className="mt-2 space-y-1 border-t border-border pt-2">
      {attachments.map((att) => (
        <li key={att.id}>
          <a
            href={`/api/v1/messages/${messageId}/attachments/${att.id}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
          >
            <PaperclipIcon className="size-3.5" />
            <span>{att.filename}</span>
            <span className="text-muted-foreground">
              ({formatBytes(att.size_bytes)})
            </span>
          </a>
        </li>
      ))}
    </ul>
  );
}

function HtmlEmailBody({ html }: { html: string }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(120);

  const resize = useCallback(() => {
    const doc = iframeRef.current?.contentDocument;
    if (!doc?.body) return;
    setHeight(Math.max(80, doc.body.scrollHeight));
  }, []);

  useEffect(() => {
    resize();
  }, [html, resize]);

  const srcDoc = `<!DOCTYPE html><html><head><meta charset="utf-8"><base target="_blank"><style>
    html, body { box-sizing: border-box; margin: 0; padding: 0; background: #ffffff; }
    body { padding: 12px; font-family: system-ui, sans-serif; font-size: 14px; line-height: 1.5; color: #27272a; word-break: break-word; overflow: hidden; }
    img { max-width: 100%; height: auto; }
    a { color: #4f46e5; }
    blockquote { margin: 0.5em 0; padding-left: 0.75em; border-left: 3px solid #d4d4d8; color: #52525b; }
  </style></head><body>${html}</body></html>`;

  return (
    <iframe
      ref={iframeRef}
      title="Email content"
      sandbox=""
      scrolling="no"
      srcDoc={srcDoc}
      onLoad={resize}
      className="relative z-0 block w-full overflow-hidden rounded-lg border border-border bg-background"
      style={{ height, minHeight: 80 }}
    />
  );
}

export function EmailMessageBody({
  message,
  emphasize,
}: {
  message: MessageRow;
  emphasize?: boolean;
}) {
  const hasHtml = Boolean(message.email_body_html?.trim());
  const textClass = cn(
    "whitespace-pre-wrap text-foreground",
    emphasize && "font-medium",
  );

  return (
    <div onClick={(e) => e.stopPropagation()}>
      {hasHtml ? (
        <HtmlEmailBody html={message.email_body_html!} />
      ) : (
        <p className={textClass}>{message.body}</p>
      )}

      {message.attachments && message.attachments.length > 0 && (
        <AttachmentList messageId={message.id} attachments={message.attachments} />
      )}
    </div>
  );
}
