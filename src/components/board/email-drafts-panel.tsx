"use client";

import { useCallback, useState } from "react";
import { ChevronDown, ChevronRight, Trash2 } from "lucide-react";
import { FileDashedIcon, PaperclipIcon, XIcon } from "@phosphor-icons/react";
import { toast } from "sonner";
import { maxAttachmentSizeLabel } from "@shared/attachment-limits";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { usePersistedExpanded } from "@/hooks/use-persisted-expanded";
import { useTicketDrafts } from "@/hooks/use-ticket-drafts";
import { uploadAttachment } from "./attachment-upload";
import { CcChipInput } from "./cc-chip-input";
import type { AttachmentUpload, EmailComposePayload, MessageRow } from "./types";
import { formatBytes } from "./email-utils";

function draftPreview(body: string, max = 72): string {
  const line = body.split("\n").find((l) => l.trim()) ?? body.trim();
  if (line.length <= max) return line;
  return `${line.slice(0, max).trimEnd()}…`;
}

function formatDraftTime(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  if (sameDay) {
    return date.toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    });
  }
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function draftToPayload(
  body: string,
  cc: string[],
  subject: string,
  attachments: AttachmentUpload[],
  includeQuote: boolean,
): EmailComposePayload {
  return {
    body: body.trim(),
    email: {
      cc,
      subject: subject.trim() || undefined,
      include_quote: includeQuote,
      attachment_upload_ids: attachments.map((a) => a.id),
    },
  };
}

function EmailDraftEditor({
  ticketId,
  draft,
  customerEmail,
  saving,
  onUpdate,
  onSend,
  onDelete,
  onCollapse,
}: {
  ticketId: string;
  draft: MessageRow;
  customerEmail: string;
  saving: boolean;
  onUpdate: (id: string, payload: EmailComposePayload) => Promise<void>;
  onSend: (
    id: string,
    payload: EmailComposePayload,
    includeQuote: boolean,
  ) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onCollapse: () => void;
}) {
  const [body, setBody] = useState(draft.body);
  const [cc, setCc] = useState<string[]>(draft.email_cc ?? []);
  const [subject, setSubject] = useState(draft.email_subject ?? "");
  const [includeQuote, setIncludeQuote] = useState(true);
  const [attachments, setAttachments] = useState<AttachmentUpload[]>(
    () =>
      draft.attachments?.map((a) => ({
        id: a.id,
        filename: a.filename,
        content_type: a.content_type,
        size_bytes: a.size_bytes,
      })) ?? [],
  );
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState<"save" | "send" | "delete" | null>(null);

  async function handleFileSelect(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    try {
      const uploaded: AttachmentUpload[] = [];
      for (const file of Array.from(files)) {
        uploaded.push(await uploadAttachment(ticketId, file));
      }
      setAttachments((prev) => [...prev, ...uploaded]);
    } catch (err) {
      toast.error("Could not attach file", {
        description: err instanceof Error ? err.message : "Upload failed",
      });
    } finally {
      setUploading(false);
    }
  }

  async function handleSave() {
    if (!body.trim()) return;
    setBusy("save");
    try {
      await onUpdate(draft.id, draftToPayload(body, cc, subject, attachments, includeQuote));
      toast.success("Draft updated");
    } finally {
      setBusy(null);
    }
  }

  async function handleSend() {
    if (!body.trim()) return;
    setBusy("send");
    try {
      const payload = draftToPayload(body, cc, subject, attachments, includeQuote);
      await onUpdate(draft.id, payload);
      await onSend(draft.id, payload, includeQuote);
      toast.success("Email sent");
      onCollapse();
    } finally {
      setBusy(null);
    }
  }

  async function handleDelete() {
    setBusy("delete");
    try {
      await onDelete(draft.id);
      toast.success("Draft deleted");
      onCollapse();
    } finally {
      setBusy(null);
    }
  }

  const disabled = saving || uploading || busy !== null;

  return (
    <div className="space-y-3 border-t border-dashed border-border/80 bg-muted/20 px-3 py-3">
      <div className="grid gap-2 sm:grid-cols-[3rem_1fr] sm:items-center">
        <Label className="text-xs text-muted-foreground">To</Label>
        <Input
          readOnly
          value={customerEmail}
          className="h-8 cursor-not-allowed bg-background/60 text-xs opacity-70"
        />
      </div>
      <div className="grid gap-2 sm:grid-cols-[3rem_1fr] sm:items-start">
        <Label className="pt-2 text-xs text-muted-foreground">Cc</Label>
        <CcChipInput cc={cc} onChange={setCc} />
      </div>
      <div className="grid gap-2 sm:grid-cols-[3rem_1fr] sm:items-center">
        <Label className="text-xs text-muted-foreground">Subject</Label>
        <Input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          className="h-8 bg-background/80 text-xs"
        />
      </div>

      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={4}
        className="min-h-[6rem] bg-background/80 text-sm"
        placeholder="Draft body…"
      />

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Checkbox
            id={`draft-quote-${draft.id}`}
            checked={includeQuote}
            onCheckedChange={(checked) => setIncludeQuote(checked === true)}
          />
          <Label htmlFor={`draft-quote-${draft.id}`} className="text-xs">
            Include quoted text when sending
          </Label>
        </div>

        <label className="inline-flex cursor-pointer items-center gap-1 text-xs text-primary">
          <PaperclipIcon className="size-3.5" />
          <span>{uploading ? "Uploading…" : "Attach"}</span>
          <input
            type="file"
            multiple
            className="hidden"
            disabled={uploading}
            onChange={(e) => void handleFileSelect(e.target.files)}
          />
        </label>
        <span className="text-[11px] text-muted-foreground">
          Max {maxAttachmentSizeLabel()}
        </span>
      </div>

      {attachments.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {attachments.map((att) => (
            <li key={att.id}>
              <Badge variant="secondary" className="gap-1 pr-1 text-[11px]">
                {att.filename}
                <span className="text-muted-foreground">
                  ({formatBytes(att.size_bytes)})
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setAttachments((prev) => prev.filter((a) => a.id !== att.id))
                  }
                  aria-label={`Remove ${att.filename}`}
                >
                  <XIcon className="size-3" />
                </button>
              </Badge>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-3">
        <Button
          type="button"
          variant="ghost"
          size="xs"
          className="text-destructive hover:text-destructive"
          disabled={disabled}
          onClick={() => void handleDelete()}
        >
          <Trash2 className="size-3.5" />
          Delete
        </Button>
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={disabled || !body.trim()}
            onClick={() => void handleSave()}
          >
            {busy === "save" ? "Saving…" : "Save changes"}
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={disabled || !body.trim()}
            onClick={() => void handleSend()}
          >
            {busy === "send" ? "Sending…" : "Send"}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function EmailDraftsPanel({
  ticketId,
  customerEmail,
  saving,
  onUpdateDraft,
  onSendDraft,
  onDeleteDraft,
}: {
  ticketId: string;
  customerEmail: string;
  saving: boolean;
  onUpdateDraft: (id: string, payload: EmailComposePayload) => Promise<void>;
  onSendDraft: (
    id: string,
    payload: EmailComposePayload,
    includeQuote: boolean,
  ) => Promise<void>;
  onDeleteDraft: (id: string) => Promise<void>;
}) {
  const { data: drafts = [], isLoading } = useTicketDrafts(ticketId);
  const { expanded, toggleExpanded, hydrated } = usePersistedExpanded(
    "ticqex.email-drafts.expanded.v1",
    true,
  );
  const [openDraftId, setOpenDraftId] = useState<string | null>(null);

  const toggleDraft = useCallback((id: string) => {
    setOpenDraftId((current) => (current === id ? null : id));
  }, []);

  if (isLoading) {
    return (
      <div className="border-b border-border bg-muted/25 px-4 py-2.5">
        <p className="text-xs text-muted-foreground">Loading drafts…</p>
      </div>
    );
  }

  return (
    <div className="shrink-0 border-b border-border bg-muted/25">
      <button
        type="button"
        className="flex w-full items-center gap-2 px-4 py-2 text-sm transition-colors hover:bg-muted/40"
        aria-expanded={expanded}
        onClick={toggleExpanded}
      >
        {expanded ? (
          <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />
        )}
        <FileDashedIcon className="size-4 shrink-0 text-muted-foreground" />
        <span className="font-medium text-foreground">Drafts</span>
        {drafts.length > 0 ? (
          <Badge variant="secondary" className="h-5 px-1.5 text-[10px] tabular-nums">
            {drafts.length}
          </Badge>
        ) : (
          <span className="text-xs font-normal text-muted-foreground">None saved</span>
        )}
      </button>

      {hydrated && expanded && drafts.length > 0 && (
        <div className="max-h-[min(36vh,18rem)] overflow-y-auto overscroll-contain border-t border-border/60 px-2 pb-2 pt-1">
          <ul className="space-y-1.5">
            {drafts.map((draft) => {
              const isOpen = openDraftId === draft.id;
              const attachmentCount = draft.attachments?.length ?? 0;

              return (
                <li
                  key={draft.id}
                  className={cn(
                    "overflow-hidden rounded-md border bg-background/90 shadow-sm",
                    isOpen
                      ? "border-primary/25 ring-1 ring-primary/10"
                      : "border-dashed border-border/80",
                  )}
                >
                  <button
                    type="button"
                    className="flex w-full items-start gap-2 px-3 py-2.5 text-left transition-colors hover:bg-muted/30"
                    aria-expanded={isOpen}
                    onClick={() => toggleDraft(draft.id)}
                  >
                    {isOpen ? (
                      <ChevronDown className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="truncate text-sm font-medium text-foreground">
                          {draft.email_subject?.trim() || "No subject"}
                        </p>
                        <time
                          dateTime={draft.created_at}
                          className="shrink-0 text-[11px] tabular-nums text-muted-foreground"
                        >
                          {formatDraftTime(draft.created_at)}
                        </time>
                      </div>
                      {!isOpen && (
                        <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                          {draftPreview(draft.body)}
                        </p>
                      )}
                      {!isOpen && attachmentCount > 0 && (
                        <p className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
                          <PaperclipIcon className="size-3" />
                          {attachmentCount}{" "}
                          {attachmentCount === 1 ? "attachment" : "attachments"}
                        </p>
                      )}
                    </div>
                  </button>

                  {isOpen && (
                    <EmailDraftEditor
                      ticketId={ticketId}
                      draft={draft}
                      customerEmail={customerEmail}
                      saving={saving}
                      onUpdate={onUpdateDraft}
                      onSend={onSendDraft}
                      onDelete={onDeleteDraft}
                      onCollapse={() => setOpenDraftId(null)}
                    />
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {hydrated && expanded && drafts.length === 0 && (
        <p className="border-t border-border/60 px-4 py-3 text-xs text-muted-foreground">
          Saved replies appear here. Use &ldquo;Save draft&rdquo; while composing below.
        </p>
      )}
    </div>
  );
}
