"use client";

import { useEffect, useMemo, useRef } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { EnvelopeIcon, EnvelopeOpenIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { usePersistedExpanded } from "@/hooks/use-persisted-expanded";
import { cn } from "@/lib/utils";
import { EmailReplySection } from "./email-reply-section";
import { EmailMessageBody } from "./email-message-body";
import { EmailMessageHeader } from "./email-message-header";
import type { ConversationTicketSummary } from "@/types/tickets";
import type { EmailComposePayload, MessageRow } from "./types";
import { isEmailMessage, messageSenderEmail } from "./email-utils";

export type EmailThreadOrder = "oldest_first" | "newest_first";

const CONVERSATION_EXPANDED_KEY = "ticqex.ticket-conversation.expanded.v1";

type EmailConversationTicket = Pick<
  ConversationTicketSummary,
  "title" | "channel" | "contact_address" | "customer"
> & {
  messages: MessageRow[];
};

function scrollToLatest(el: HTMLElement, order: EmailThreadOrder) {
  if (order === "newest_first") {
    el.scrollTop = 0;
  } else {
    el.scrollTop = el.scrollHeight;
  }
}

function isNearLatest(el: HTMLElement, order: EmailThreadOrder) {
  const threshold = 96;
  if (order === "newest_first") {
    return el.scrollTop < threshold;
  }
  return el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
}

export function EmailConversationPanel({
  ticket,
  ticketId,
  threadOrder,
  onSubmit,
  onSaveDraft,
  onUpdateDraft,
  onSendDraft,
  onDeleteDraft,
  saving,
  onToggleMessageRead,
}: {
  ticket: EmailConversationTicket;
  ticketId: string;
  threadOrder: EmailThreadOrder;
  onSubmit: (payload: EmailComposePayload) => Promise<void>;
  onSaveDraft: (payload: EmailComposePayload) => Promise<void>;
  onUpdateDraft: (id: string, payload: EmailComposePayload) => Promise<void>;
  onSendDraft: (
    id: string,
    payload: EmailComposePayload,
    includeQuote: boolean,
  ) => Promise<void>;
  onDeleteDraft: (id: string) => Promise<void>;
  saving: boolean;
  onToggleMessageRead: (messageId: string) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const messageCountRef = useRef(0);
  const { expanded, toggleExpanded, hydrated } = usePersistedExpanded(
    CONVERSATION_EXPANDED_KEY,
    true,
  );

  const messages = useMemo(() => {
    const visible = ticket.messages.filter(
      (msg) => msg.email_delivery_status !== "draft",
    );
    if (threadOrder === "newest_first") {
      return [...visible].reverse();
    }
    return visible;
  }, [ticket.messages, threadOrder]);

  const lastEmailMessage = useMemo((): MessageRow | null => {
    const visible = ticket.messages.filter(
      (msg) => msg.email_delivery_status !== "draft",
    );
    if (!visible.length) return null;
    for (let i = visible.length - 1; i >= 0; i--) {
      const msg = visible[i];
      if (isEmailMessage(msg)) return msg;
    }
    return null;
  }, [ticket.messages]);

  const customerEmail =
    ticket.contact_address ?? ticket.customer?.username ?? "";

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || messages.length === 0) return;

    const countChanged = messages.length !== messageCountRef.current;
    messageCountRef.current = messages.length;

    if (!countChanged && !isNearLatest(el, threadOrder)) return;

    const scroll = () => scrollToLatest(el, threadOrder);
    scroll();
    const timer = window.setTimeout(scroll, 100);

    return () => window.clearTimeout(timer);
  }, [messages, threadOrder]);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <button
        type="button"
        className="flex w-full shrink-0 items-center gap-2 border-b border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted/50"
        aria-expanded={expanded}
        onClick={toggleExpanded}
      >
        {expanded ? (
          <ChevronDown className="size-3.5 shrink-0" />
        ) : (
          <ChevronRight className="size-3.5 shrink-0" />
        )}
        Conversation
        {!expanded && (
          <span className="ml-auto text-xs font-normal text-muted-foreground">
            {messages.length}{" "}
            {messages.length === 1 ? "message" : "messages"}
          </span>
        )}
      </button>
      {hydrated && expanded && (
        <div
          ref={scrollRef}
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
        >
          <div className="space-y-3 p-4">
            {messages.map((msg) => {
            const isIncoming = msg.author_type === "customer";
            const isOutbound = !isIncoming;
            const isUnread = isIncoming && msg.read === false;

            return (
              <div
                key={msg.id}
                className={cn(
                  "relative isolate overflow-hidden rounded-lg border border-transparent p-3 text-sm ring-1 ring-foreground/5",
                  isUnread && "border-primary/30 bg-primary/5",
                  !isUnread && "bg-muted/50",
                )}
              >
                {isIncoming && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        className={cn(
                          "absolute top-2 right-2 text-muted-foreground",
                          isUnread && "text-primary",
                        )}
                        aria-label={
                          isUnread ? "Mark as read" : "Mark as unread"
                        }
                        onClick={() => onToggleMessageRead(msg.id)}
                      >
                        {isUnread ? (
                          <EnvelopeOpenIcon weight="fill" />
                        ) : (
                          <EnvelopeIcon />
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="left">
                      {isUnread ? "Mark as read" : "Mark as unread"}
                    </TooltipContent>
                  </Tooltip>
                )}

                <div className="mb-2 flex items-start gap-2 pr-8">
                  <time
                    dateTime={msg.created_at}
                    className="shrink-0 text-xs tabular-nums text-muted-foreground"
                  >
                    {new Date(msg.created_at).toLocaleString()}
                  </time>
                </div>

                <p className="mb-2 truncate text-sm font-medium text-foreground">
                  {messageSenderEmail(msg, ticket)}
                </p>

                <EmailMessageHeader message={msg} isOutbound={isOutbound} />
                <EmailMessageBody message={msg} emphasize={isUnread} />
              </div>
            );
          })}
          </div>
        </div>
      )}

      {ticket.channel === "email" && (
        <EmailReplySection
          ticketId={ticketId}
          customerEmail={customerEmail}
          ticketTitle={ticket.title}
          lastEmailMessage={lastEmailMessage}
          onSubmit={onSubmit}
          onSaveDraft={onSaveDraft}
          onUpdateDraft={onUpdateDraft}
          onSendDraft={onSendDraft}
          onDeleteDraft={onDeleteDraft}
          saving={saving}
        />
      )}
    </div>
  );
}
