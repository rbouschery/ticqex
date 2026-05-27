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
import { Skeleton } from "@/components/ui/skeleton";
import type { Tag } from "@/components/tags/types";
import { apiFetch, apiFetchText } from "@/lib/api-client";
import { useTicketRealtime } from "@/hooks/use-board-realtime";
import { useRecentTags } from "@/hooks/use-recent-tags";
import {
  EmailConversationPanel,
  type EmailThreadOrder,
} from "./email-conversation-panel";
import { TicketCustomerSection } from "./ticket-customer-section";
import { TicketDetailsSection } from "./ticket-details-section";
import {
  TicketStatusCombobox,
  type StatusOption,
} from "./ticket-status-combobox";
import type {
  EmailComposePayload,
  TicketDetail,
} from "./types";
import {
  isConversationDetail,
  isTaskDetail,
} from "./types";

type StaffUser = { id: string; username: string };

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA") return true;
  return target.isContentEditable;
}

export function TicketModal({
  ticketId,
  statuses,
  onStatusChange,
  onClose,
  onBoardChange,
}: {
  ticketId: string;
  statuses: StatusOption[];
  onStatusChange: (
    ticketId: string,
    fromStatusId: string,
    toStatusId: string,
  ) => Promise<void>;
  onClose: () => void;
  onBoardChange: (updated?: TicketDetail) => void;
}) {
  const [ticket, setTicket] = useState<TicketDetail | null>(null);
  const [users, setUsers] = useState<StaffUser[]>([]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [assigneeId, setAssigneeId] = useState<string>("");
  const [selectedTags, setSelectedTags] = useState<Tag[]>([]);
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const { recentNames, touch: touchRecentTags } = useRecentTags();
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
      const [t, staff, settings, tags] = await Promise.all([
        apiFetch<TicketDetail>(`/api/v1/tickets/${ticketId}`),
        apiFetch<StaffUser[]>("/api/v1/users"),
        apiFetch<{ email_thread_order?: EmailThreadOrder }>("/api/v1/settings"),
        apiFetch<Tag[]>("/api/v1/tags"),
      ]);
      setThreadOrder(settings.email_thread_order ?? "oldest_first");
      setTicket(t);
      setTitle(t.title);
      setBody(isTaskDetail(t) ? (t.body ?? "") : "");
      setAssigneeId(t.assignee_id ?? "");
      setSelectedTags(t.tags);
      setAllTags(tags);
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
        onBoardChange({ ...t, unread_count: 0 });
      }
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

  async function changeStatus(statusId: string) {
    if (!ticket || ticket.status_id === statusId) return;
    setSaving(true);
    setError(null);
    try {
      await onStatusChange(ticketId, ticket.status_id, statusId);
      const refreshed = await apiFetch<TicketDetail>(`/api/v1/tickets/${ticketId}`);
      setTicket(refreshed);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to change status");
      onBoardChange();
    } finally {
      setSaving(false);
    }
  }

  async function saveMeta() {
    if (!ticket) return;
    setSaving(true);
    setError(null);
    try {
      const tagNames = selectedTags
        .map((tag) => tag.name.trim())
        .filter(Boolean);
      const payload: Record<string, unknown> = {
        title,
        assignee_id: assigneeId || null,
        tags: tagNames,
      };
      if (isTaskDetail(ticket)) {
        payload.body = body;
      }
      await apiFetch(`/api/v1/tickets/${ticketId}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      const refreshed = await apiFetch<TicketDetail>(`/api/v1/tickets/${ticketId}`);
      setTicket(refreshed);
      setTitle(refreshed.title);
      setAssigneeId(refreshed.assignee_id ?? "");
      setSelectedTags(refreshed.tags);
      const existingKeys = new Set(
        allTags.map((t) => t.name.trim().toLowerCase()),
      );
      const hasNewTag = tagNames.some(
        (n) => !existingKeys.has(n.trim().toLowerCase()),
      );
      if (hasNewTag) {
        const tags = await apiFetch<Tag[]>("/api/v1/tags");
        setAllTags(tags);
      }
      touchRecentTags(tagNames);
      if (isTaskDetail(refreshed)) {
        setBody(refreshed.body ?? "");
      }
      onBoardChange();
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
        <DialogHeader className="flex-row items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <DialogTitle
              className="truncate"
              title={!loading && title ? title : undefined}
            >
              {loading ? "Ticket" : title || "Ticket"}
            </DialogTitle>
            {!loading && ticket && (
              <>
                {isTaskDetail(ticket) ? (
                  <Badge variant="outline" className="shrink-0">Ticket</Badge>
                ) : (
                  <Badge variant="secondary" className="shrink-0">Email conversation</Badge>
                )}
                {(ticket.status || statuses.length > 0) && (
                  <TicketStatusCombobox
                    statuses={
                      statuses.length > 0
                        ? statuses
                        : ticket.status
                          ? [
                              {
                                id: ticket.status.id,
                                name: ticket.status.name,
                                color: ticket.status.color,
                              },
                            ]
                          : []
                    }
                    value={ticket.status_id}
                    onValueChange={(id) => void changeStatus(id)}
                    disabled={saving}
                  />
                )}
              </>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
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
              <div className="space-y-2">
                <Label htmlFor="ticket-title">Title</Label>
                <Input
                  id="ticket-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>
              {ticket.customer && ticket.customer_id && (
                <TicketCustomerSection
                  customerId={ticket.customer_id}
                  displayName={
                    isConversationDetail(ticket) && ticket.contact_address
                      ? ticket.contact_address
                      : ticket.customer.username
                  }
                  contactAddress={
                    isConversationDetail(ticket) ? ticket.contact_address : null
                  }
                />
              )}
              <TicketDetailsSection
                assigneeId={assigneeId}
                onAssigneeChange={setAssigneeId}
                users={users}
                selectedTags={selectedTags}
                onTagsChange={setSelectedTags}
                allTags={allTags}
                recentNames={recentNames}
                saving={saving}
                onSave={() => void saveMeta()}
                body={isTaskDetail(ticket) ? body : undefined}
                onBodyChange={isTaskDetail(ticket) ? setBody : undefined}
                summary={[
                  users.find((u) => u.id === assigneeId)?.username ??
                    ticket.assignee?.username ??
                    "Unassigned",
                  selectedTags.length > 0
                    ? selectedTags.map((tag) => tag.name).join(", ")
                    : "No tags",
                ].join(" · ")}
              />
            </div>

            {!isTaskDetail(ticket) && (
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
