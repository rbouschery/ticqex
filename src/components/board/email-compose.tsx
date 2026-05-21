"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { PaperclipIcon, XIcon } from "@phosphor-icons/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch } from "@/lib/api-client";
import { uploadAttachment } from "./attachment-upload";
import { CcChipInput } from "./cc-chip-input";
import type {
  AttachmentUpload,
  EmailComposePayload,
  EmailSnippet,
  MessageRow,
} from "./types";
import { formatBytes, formatReplySubject } from "./email-utils";

export function EmailCompose({
  ticketId,
  customerEmail,
  ticketTitle,
  lastEmailMessage,
  internal,
  onInternalChange,
  onSubmit,
  saving,
}: {
  ticketId: string;
  customerEmail: string;
  ticketTitle: string;
  lastEmailMessage: MessageRow | null;
  internal: boolean;
  onInternalChange: (internal: boolean) => void;
  onSubmit: (payload: EmailComposePayload) => Promise<void>;
  saving: boolean;
}) {
  const [body, setBody] = useState("");
  const [cc, setCc] = useState<string[]>([]);
  const [replyAll, setReplyAll] = useState(false);
  const [subject, setSubject] = useState(() =>
    formatReplySubject(lastEmailMessage?.email_subject, ticketTitle),
  );
  const [includeQuote, setIncludeQuote] = useState(true);
  const [attachments, setAttachments] = useState<AttachmentUpload[]>([]);
  const [uploading, setUploading] = useState(false);
  const [snippets, setSnippets] = useState<EmailSnippet[]>([]);
  const [snippetId, setSnippetId] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (internal) return;
    apiFetch<EmailSnippet[]>("/api/v1/email-snippets")
      .then(setSnippets)
      .catch(() => setSnippets([]));
  }, [internal]);

  const resetEmailFields = useCallback(() => {
    setCc([]);
    setReplyAll(false);
    setSubject(formatReplySubject(lastEmailMessage?.email_subject, ticketTitle));
    setIncludeQuote(true);
    setAttachments([]);
    setSnippetId("");
  }, [lastEmailMessage?.email_subject, ticketTitle]);

  function handleReplyMode(all: boolean) {
    setReplyAll(all);
    if (!all) {
      setCc([]);
    }
  }

  function insertSnippet(id: string) {
    setSnippetId(id);
    const snippet = snippets.find((s) => s.id === id);
    if (!snippet) return;
    setBody((prev) => (prev ? `${prev}\n\n${snippet.body}` : snippet.body));
  }

  async function handleFileSelect(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    try {
      const uploaded: AttachmentUpload[] = [];
      for (const file of Array.from(files)) {
        uploaded.push(await uploadAttachment(ticketId, file));
      }
      setAttachments((prev) => [...prev, ...uploaded]);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;

    const payload: EmailComposePayload = {
      body: body.trim(),
      visibility: internal ? "internal" : "public",
      channel: internal ? "admin" : "email",
    };

    if (!internal) {
      payload.email = {
        cc,
        subject: subject.trim() || undefined,
        reply_all: replyAll,
        include_quote: includeQuote,
        attachment_upload_ids: attachments.map((a) => a.id),
      };
    }

    await onSubmit(payload);
    setBody("");
    resetEmailFields();
  }

  return (
    <form
      onSubmit={(e) => void handleSubmit(e)}
      className="border-t border-border p-4"
    >
      {!internal && (
        <div className="mb-3 space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="xs"
              variant={!replyAll ? "default" : "outline"}
              onClick={() => handleReplyMode(false)}
            >
              Reply
            </Button>
            <Button
              type="button"
              size="xs"
              variant={replyAll ? "default" : "outline"}
              onClick={() => handleReplyMode(true)}
            >
              Reply all
            </Button>
          </div>

          <div className="space-y-2">
            <Label>To</Label>
            <Input readOnly value={customerEmail} className="cursor-not-allowed opacity-70" />
          </div>

          <div className="space-y-2">
            <Label>Cc</Label>
            <CcChipInput cc={cc} onChange={setCc} />
          </div>

          <div className="space-y-2">
            <Label>Subject</Label>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>
        </div>
      )}

      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={internal ? 3 : 5}
        placeholder={internal ? "Write an internal note…" : "Write your reply…"}
      />

      {!internal && (
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Checkbox
              id="include-quote"
              checked={includeQuote}
              onCheckedChange={(checked) => setIncludeQuote(checked === true)}
            />
            <Label htmlFor="include-quote" className="text-xs">
              Include quoted text
            </Label>
          </div>

          {snippets.length > 0 && (
            <div className="flex items-center gap-2">
              <Label className="text-xs">Snippet</Label>
              <Select
                value={snippetId || undefined}
                onValueChange={insertSnippet}
              >
                <SelectTrigger size="sm" className="w-40">
                  <SelectValue placeholder="Insert snippet…" />
                </SelectTrigger>
                <SelectContent>
                  {snippets.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => void handleFileSelect(e.target.files)}
          />
          <Button
            type="button"
            variant="link"
            size="xs"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
          >
            <PaperclipIcon />
            {uploading ? "Uploading…" : "Attach files"}
          </Button>
        </div>
      )}

      {attachments.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-2">
          {attachments.map((att) => (
            <li key={att.id}>
              <Badge variant="secondary" className="gap-1 pr-1">
                <span>{att.filename}</span>
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

      <div className="mt-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Checkbox
            id="email-internal"
            checked={internal}
            onCheckedChange={(checked) => onInternalChange(checked === true)}
          />
          <Label htmlFor="email-internal" className="text-xs">
            Internal note
          </Label>
        </div>
        <Button
          type="submit"
          size="sm"
          disabled={saving || uploading || !body.trim()}
        >
          {internal ? "Add note" : "Send email"}
        </Button>
      </div>
    </form>
  );
}
