"use client";

import { Suspense } from "react";
import { EmailConversationPanel } from "./email-conversation-panel";
import { TicketConversationSkeleton } from "./ticket-modal-skeletons";
import { useTicketMessages } from "@/hooks/use-ticket-messages";
import type { EmailComposePayload } from "./types";
import type { EmailThreadOrder } from "./email-conversation-panel";
import type { ConversationTicketSummary } from "@/types/tickets";

function TicketConversationContent({
  summary,
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
  summary: ConversationTicketSummary;
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
  const { data: messages } = useTicketMessages(ticketId);

  return (
    <EmailConversationPanel
      ticket={{ ...summary, messages }}
      ticketId={ticketId}
      threadOrder={threadOrder}
      onSubmit={onSubmit}
      onSaveDraft={onSaveDraft}
      onUpdateDraft={onUpdateDraft}
      onSendDraft={onSendDraft}
      onDeleteDraft={onDeleteDraft}
      saving={saving}
      onToggleMessageRead={onToggleMessageRead}
    />
  );
}

export function TicketConversationSection({
  summary,
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
  summary: ConversationTicketSummary;
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
  return (
    <Suspense fallback={<TicketConversationSkeleton />}>
      <TicketConversationContent
        summary={summary}
        ticketId={ticketId}
        threadOrder={threadOrder}
        onSubmit={onSubmit}
        onSaveDraft={onSaveDraft}
        onUpdateDraft={onUpdateDraft}
        onSendDraft={onSendDraft}
        onDeleteDraft={onDeleteDraft}
        saving={saving}
        onToggleMessageRead={onToggleMessageRead}
      />
    </Suspense>
  );
}
