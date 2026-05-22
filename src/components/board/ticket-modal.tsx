"use client";

import { useCallback, useEffect, useState } from "react";
import { X } from "lucide-react";
import { CopyIcon } from "@phosphor-icons/react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch, apiFetchText } from "@/lib/api-client";
import { useTicketRealtime } from "@/hooks/use-board-realtime";
import {
  EmailConversationPanel,
  type EmailThreadOrder,
} from "./email-conversation-panel";
import { TaskTicketPanel } from "./task-ticket-panel";
import type {
  EmailComposePayload,
  TicketDetail,
} from "./types";
import {
  isConversationDetail,
  isTaskDetail,
} from "./types";

type StaffUser = { id: string; username: string };

const UNASSIGNED = "__unassigned__";

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA") return true;
  return target.isContentEditable;
}

export function TicketModal({
  ticketId,
  onClose,
  onBoardChange,
}: {
  ticketId: string;
  onClose: () => void;
  onBoardChange: () => void;
}) {
  const [ticket, setTicket] = useState<TicketDetail | null>(null);
  const [users, setUsers] = useState<StaffUser[]>([]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [assigneeId, setAssigneeId] = useState<string>("");
  const [tagInput, setTagInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [threadOrder, setThreadOrder] = useState<EmailThreadOrder>("oldest_first");

  const load = useCallback(async (options?: { silent?: boolean }) => {
    if (!options?.silent) {
      setLoading(true);
      setError(null);
    }
    try {
      const [t, staff, settings] = await Promise.all([
        apiFetch<TicketDetail>(`/api/v1/tickets/${ticketId}`),
        apiFetch<StaffUser[]>("/api/v1/users"),
        apiFetch<{ email_thread_order?: EmailThreadOrder }>("/api/v1/settings"),
      ]);
      setThreadOrder(settings.email_thread_order ?? "oldest_first");
      setTicket(t);
      setTitle(t.title);
      setBody(isTaskDetail(t) ? (t.body ?? "") : "");
      setAssigneeId(t.assignee_id ?? "");
      setTagInput(t.tags.map((x) => x.name).join(", "));
      setUsers(staff);

      if (isConversationDetail(t) && !options?.silent) {
        await apiFetch(`/api/v1/tickets/${ticketId}/read`, { method: "POST" });
        setTicket((prev) =>
          prev && isConversationDetail(prev)
            ? {
                ...prev,
                unread_count: 0,
                messages: prev.messages.map((msg) =>
                  msg.author_type === "customer" ? { ...msg, read: true } : msg,
                ),
              }
            : prev,
        );
      }
      onBoardChange();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load ticket");
    } finally {
      if (!options?.silent) {
        setLoading(false);
      }
    }
  }, [ticketId, onBoardChange]);

  const refreshTicket = useCallback(() => {
    void load({ silent: true });
  }, [load]);

  useTicketRealtime(ticketId, refreshTicket);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load ticket on open
    void load();
  }, [load]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "x" && e.key !== "X") return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (isEditableTarget(e.target)) return;
      e.preventDefault();
      onClose();
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  async function saveMeta() {
    if (!ticket) return;
    setSaving(true);
    setError(null);
    try {
      const tags = tagInput
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const payload: Record<string, unknown> = {
        title,
        assignee_id: assigneeId || null,
        tags,
      };
      if (isTaskDetail(ticket)) {
        payload.body = body;
      }
      await apiFetch(`/api/v1/tickets/${ticketId}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function sendEmailReply(payload: EmailComposePayload) {
    setSaving(true);
    setError(null);
    try {
      await apiFetch(`/api/v1/tickets/${ticketId}/messages`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reply failed");
      throw err;
    } finally {
      setSaving(false);
    }
  }

  async function copyContext() {
    const text = await apiFetchText(`/api/v1/tickets/${ticketId}/context`);
    await navigator.clipboard.writeText(text);
  }

  async function toggleMessageRead(messageId: string) {
    try {
      const result = await apiFetch<{ read: boolean }>(
        `/api/v1/tickets/${ticketId}/messages/${messageId}/read`,
        { method: "PATCH" },
      );
      setTicket((prev) =>
        prev && isConversationDetail(prev)
          ? {
              ...prev,
              messages: prev.messages.map((msg) =>
                msg.id === messageId ? { ...msg, read: result.read } : msg,
              ),
            }
          : prev,
      );
      onBoardChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update read state");
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl"
        showCloseButton={false}
      >
        <DialogHeader className="flex-row items-center justify-between border-b border-border px-4 py-3">
          <DialogTitle>Ticket</DialogTitle>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => void copyContext()}
            >
              <CopyIcon />
              Copy context
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={onClose}
              aria-label="Close"
            >
              <X />
            </Button>
          </div>
        </DialogHeader>

        {loading && (
          <div className="space-y-3 p-6">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-24 w-full" />
          </div>
        )}

        {!loading && ticket && (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="space-y-3 border-b border-border p-4">
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
              <div className="flex flex-wrap items-center gap-2 text-sm">
                {isTaskDetail(ticket) ? (
                  <Badge variant="outline">Task</Badge>
                ) : (
                  <Badge variant="secondary">Email conversation</Badge>
                )}
                {ticket.customer && (
                  <>
                    <Separator orientation="vertical" className="h-4" />
                    <span className="text-muted-foreground">
                      {isConversationDetail(ticket) && ticket.contact_address
                        ? ticket.contact_address
                        : ticket.customer.username}
                    </span>
                  </>
                )}
                <Separator orientation="vertical" className="h-4" />
                <span className="text-muted-foreground">
                  Status: {ticket.status?.name}
                </span>
              </div>
              <div className="space-y-2">
                <Label>Assignee</Label>
                <Select
                  value={assigneeId || UNASSIGNED}
                  onValueChange={(v) =>
                    setAssigneeId(v === UNASSIGNED ? "" : v)
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Unassigned" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
                    {users.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.username}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Tags (comma-separated)</Label>
                <Input
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                />
              </div>
              <Button
                type="button"
                size="sm"
                disabled={saving}
                onClick={() => void saveMeta()}
              >
                Save details
              </Button>
            </div>

            {isTaskDetail(ticket) ? (
              <TaskTicketPanel
                ticket={ticket}
                body={body}
                onBodyChange={setBody}
              />
            ) : (
              <EmailConversationPanel
                ticket={ticket}
                ticketId={ticketId}
                threadOrder={threadOrder}
                onSubmit={sendEmailReply}
                saving={saving}
                onToggleMessageRead={(id) => void toggleMessageRead(id)}
              />
            )}
          </div>
        )}

        {error && (
          <div className="px-4 pb-3">
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
