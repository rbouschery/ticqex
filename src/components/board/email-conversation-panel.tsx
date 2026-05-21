"use client";

import { useMemo } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { EmailCompose } from "./email-compose";
import { EmailMessageBody } from "./email-message-body";
import { EmailMessageHeader } from "./email-message-header";
import type {
  ConversationTicketDetail,
  EmailComposePayload,
  MessageRow,
} from "./types";
import { isEmailMessage } from "./email-utils";

export function EmailConversationPanel({
  ticket,
  ticketId,
  internal,
  onInternalChange,
  onSubmit,
  saving,
  onToggleMessageRead,
}: {
  ticket: ConversationTicketDetail;
  ticketId: string;
  internal: boolean;
  onInternalChange: (value: boolean) => void;
  onSubmit: (payload: EmailComposePayload) => Promise<void>;
  saving: boolean;
  onToggleMessageRead: (messageId: string) => void;
}) {
  const lastEmailMessage = useMemo((): MessageRow | null => {
    if (!ticket.messages.length) return null;
    for (let i = ticket.messages.length - 1; i >= 0; i--) {
      const msg = ticket.messages[i];
      if (isEmailMessage(msg)) return msg;
    }
    return null;
  }, [ticket.messages]);

  const customerEmail =
    ticket.contact_address ?? ticket.customer?.username ?? "";

  return (
    <>
      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-3 p-4">
          {ticket.messages.map((msg) => {
            const isIncoming = msg.author_type === "customer";
            const isOutbound = !isIncoming;
            const isUnread = isIncoming && msg.read === false;

            return (
              <div
                key={msg.id}
                role={isIncoming ? "button" : undefined}
                tabIndex={isIncoming ? 0 : undefined}
                onClick={
                  isIncoming ? () => onToggleMessageRead(msg.id) : undefined
                }
                onKeyDown={
                  isIncoming
                    ? (e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          onToggleMessageRead(msg.id);
                        }
                      }
                    : undefined
                }
                className={cn(
                  "rounded-lg p-3 text-sm ring-1 ring-foreground/5",
                  msg.visibility === "internal" &&
                    "border border-amber-500/30 bg-amber-500/10",
                  msg.visibility !== "internal" &&
                    isUnread &&
                    "border border-primary/30 bg-primary/5",
                  msg.visibility !== "internal" &&
                    !isUnread &&
                    "bg-muted/50",
                  isIncoming &&
                    "cursor-pointer hover:ring-primary/30 hover:ring-2",
                )}
              >
                <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    {isIncoming && (
                      <span
                        className={cn(
                          "inline-block size-2 shrink-0 rounded-full",
                          isUnread ? "bg-primary" : "bg-muted-foreground/40",
                        )}
                        aria-hidden="true"
                      />
                    )}
                    <span>
                      {msg.author_type}
                      {isIncoming && (isUnread ? " · unread" : " · read")}
                    </span>
                  </span>
                  <time dateTime={msg.created_at}>
                    {new Date(msg.created_at).toLocaleString()}
                  </time>
                </div>

                <EmailMessageHeader message={msg} isOutbound={isOutbound} />
                <EmailMessageBody message={msg} emphasize={isUnread} />
              </div>
            );
          })}
        </div>
      </ScrollArea>

      {ticket.channel === "email" && (
        <EmailCompose
          ticketId={ticketId}
          customerEmail={customerEmail}
          ticketTitle={ticket.title}
          lastEmailMessage={lastEmailMessage}
          internal={internal}
          onInternalChange={onInternalChange}
          onSubmit={onSubmit}
          saving={saving}
        />
      )}
    </>
  );
}
