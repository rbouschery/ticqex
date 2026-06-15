"use client";

import { EmailCompose } from "./email-compose";
import { EmailDraftsPanel } from "./email-drafts-panel";
import type { EmailComposePayload, MessageRow } from "./types";

export function EmailReplySection({
  ticketId,
  contactEmail,
  ticketTitle,
  lastEmailMessage,
  saving,
  onSubmit,
  onSaveDraft,
  onUpdateDraft,
  onSendDraft,
  onDeleteDraft,
}: {
  ticketId: string;
  contactEmail: string;
  ticketTitle: string;
  lastEmailMessage: MessageRow | null;
  saving: boolean;
  onSubmit: (payload: EmailComposePayload) => Promise<void>;
  onSaveDraft: (payload: EmailComposePayload) => Promise<void>;
  onUpdateDraft: (id: string, payload: EmailComposePayload) => Promise<void>;
  onSendDraft: (
    id: string,
    payload: EmailComposePayload,
    includeQuote: boolean,
  ) => Promise<void>;
  onDeleteDraft: (id: string) => Promise<void>;
}) {
  return (
    <div className="relative z-10 flex min-h-0 max-h-[min(34vh,20rem)] shrink-0 flex-col overflow-hidden border-t border-border bg-background">
      <EmailDraftsPanel
        ticketId={ticketId}
        contactEmail={contactEmail}
        saving={saving}
        onUpdateDraft={onUpdateDraft}
        onSendDraft={onSendDraft}
        onDeleteDraft={onDeleteDraft}
      />
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <EmailCompose
          ticketId={ticketId}
          contactEmail={contactEmail}
          ticketTitle={ticketTitle}
          lastEmailMessage={lastEmailMessage}
          onSubmit={onSubmit}
          onSaveDraft={onSaveDraft}
          saving={saving}
        />
      </div>
    </div>
  );
}
