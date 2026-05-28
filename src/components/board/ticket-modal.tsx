"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
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
  invalidateTicketMessages,
  ticketMessagesQueryKey,
} from "@/hooks/use-ticket-messages";
import {
  ticketSummaryQueryKey,
  useTicketSummary,
} from "@/hooks/use-ticket-summary";
import {
  isConversationSummary,
  isTaskSummary,
  type TicketSummary,
} from "@/types/tickets";
import type { TicketModalSeed } from "./board-ticket-seed";
import {
  ticketTagsQueryKey,
  useTicketTags,
  useTicketThreadOrder,
  useTicketUsers,
} from "@/hooks/use-ticket-reference-data";
import { TicketConversationSection } from "./ticket-conversation-section";
import { TicketCustomerSection } from "./ticket-customer-section";
import { TicketDetailsSection } from "./ticket-details-section";
import {
  TicketMetaSkeleton,
  TicketConversationSkeleton,
} from "./ticket-modal-skeletons";
import {
  TicketStatusCombobox,
  type StatusOption,
} from "./ticket-status-combobox";
import type { EmailComposePayload, MessageRow } from "./types";

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA") return true;
  return target.isContentEditable;
}

type TicketDraft = {
  ticketId: string;
  title?: string;
  body?: string;
  assigneeId?: string;
  selectedTags?: Tag[];
};

export function TicketModal({
  ticketId,
  statuses,
  initialSeed,
  onStatusChange,
  onClose,
  onBoardChange,
}: {
  ticketId: string;
  statuses: StatusOption[];
  initialSeed?: TicketModalSeed;
  onStatusChange: (
    ticketId: string,
    fromStatusId: string,
    toStatusId: string,
  ) => Promise<void>;
  onClose: () => void;
  onBoardChange: (updated?: { id: string; unread_count?: number }) => void;
}) {
  const queryClient = useQueryClient();
  const summaryQuery = useTicketSummary(ticketId);
  const usersQuery = useTicketUsers();
  const tagsQuery = useTicketTags();
  const threadOrderQuery = useTicketThreadOrder();

  const summary = summaryQuery.data;
  const users = usersQuery.data ?? [];
  const allTags = tagsQuery.data ?? [];
  const threadOrder = threadOrderQuery.data ?? "oldest_first";

  const [draft, setDraft] = useState<TicketDraft | null>(null);
  const { recentNames, touch: touchRecentTags } = useRecentTags();
  const [saving, setSaving] = useState(false);
  const [optimisticStatusId, setOptimisticStatusId] = useState<string | null>(
    null,
  );
  const optimisticStatusRef = useRef<string | null>(null);
  const [errorState, setErrorState] = useState<{
    ticketId: string;
    message: string;
  } | null>(null);
  const currentDraft = draft?.ticketId === ticketId ? draft : null;
  const title = currentDraft?.title ?? summary?.title ?? "";
  const body =
    currentDraft?.body ??
    (summary && isTaskSummary(summary) ? (summary.body ?? "") : "");
  const assigneeId =
    currentDraft?.assigneeId ?? summary?.assignee_id ?? "";
  const selectedTags = currentDraft?.selectedTags ?? summary?.tags ?? [];
  const error =
    errorState?.ticketId === ticketId ? errorState.message : null;

  const setCurrentError = useCallback(
    (message: string | null) => {
      setErrorState(message ? { ticketId, message } : null);
    },
    [ticketId],
  );

  const updateDraft = useCallback(
    (patch: Omit<Partial<TicketDraft>, "ticketId">) => {
      setDraft((current) =>
        current?.ticketId === ticketId
          ? { ...current, ...patch }
          : { ticketId, ...patch },
      );
    },
    [ticketId],
  );

  const refreshTicket = useCallback(() => {
    void queryClient.invalidateQueries({
      queryKey: ticketSummaryQueryKey(ticketId),
    });
    void queryClient.invalidateQueries({
      queryKey: ticketMessagesQueryKey(ticketId),
    });
  }, [queryClient, ticketId]);

  useTicketRealtime(ticketId, refreshTicket);

  useEffect(() => {
    const source = summary;
    if (!source || !isConversationSummary(source)) return;
    if ((source.unread_count ?? 0) === 0) return;

    void apiFetch(`/api/v1/tickets/${ticketId}/read`, { method: "POST" }).then(
      () => {
        queryClient.setQueryData<TicketSummary>(
          ticketSummaryQueryKey(ticketId),
          (current) =>
            current ? { ...current, unread_count: 0 } : current,
        );
        onBoardChange({ id: source.id, unread_count: 0 });
      },
    );
  }, [summary, ticketId, queryClient, onBoardChange]);

  useEffect(() => {
    optimisticStatusRef.current = null;
    setOptimisticStatusId(null);
  }, [ticketId]);

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

  const displaySeed = summary ?? initialSeed;
  const effectiveStatusId =
    optimisticStatusId ??
    summary?.status_id ??
    initialSeed?.status_id;
  const displayTitle = title || displaySeed?.title || "";
  const headerLoading = !displaySeed && summaryQuery.isPending;
  const metaLoading =
    !summary && (summaryQuery.isPending || summaryQuery.isFetching);
  const metaReady = !!summary;
  const detailSummary = summary;
  const isConversation = displaySeed?.kind === "conversation";

  const patchSummaryStatus = useCallback(
    (statusId: string) => {
      const statusMeta =
        statuses.find((s) => s.id === statusId) ??
        (summary?.status?.id === statusId ? summary.status : undefined) ??
        (initialSeed?.status?.id === statusId ? initialSeed.status : undefined);
      if (!statusMeta) return;
      queryClient.setQueryData<TicketSummary>(
        ticketSummaryQueryKey(ticketId),
        (current) =>
          current
            ? {
                ...current,
                status_id: statusId,
                status: {
                  id: statusMeta.id,
                  name: statusMeta.name,
                  color: statusMeta.color,
                },
              }
            : current,
      );
    },
    [statuses, summary, initialSeed, queryClient, ticketId],
  );

  const changeStatus = useCallback(
    (statusId: string) => {
      const fromStatusId =
        optimisticStatusRef.current ??
        queryClient.getQueryData<TicketSummary>(
          ticketSummaryQueryKey(ticketId),
        )?.status_id ??
        initialSeed?.status_id;
      if (!fromStatusId || fromStatusId === statusId) return;

      const previousSummary = queryClient.getQueryData<TicketSummary>(
        ticketSummaryQueryKey(ticketId),
      );
      const rollbackStatusId =
        previousSummary?.status_id ?? initialSeed?.status_id ?? null;

      optimisticStatusRef.current = statusId;
      setOptimisticStatusId(statusId);
      setCurrentError(null);
      patchSummaryStatus(statusId);

      void (async () => {
        try {
          await onStatusChange(ticketId, fromStatusId, statusId);
          if (optimisticStatusRef.current === statusId) {
            optimisticStatusRef.current = null;
            setOptimisticStatusId(null);
          }
          void queryClient.invalidateQueries({
            queryKey: ticketSummaryQueryKey(ticketId),
          });
        } catch (e) {
          optimisticStatusRef.current = rollbackStatusId;
          setOptimisticStatusId(rollbackStatusId);
          if (previousSummary) {
            queryClient.setQueryData(
              ticketSummaryQueryKey(ticketId),
              previousSummary,
            );
          }
          setCurrentError(
            e instanceof Error ? e.message : "Failed to change status",
          );
          onBoardChange();
        }
      })();
    },
    [
      queryClient,
      ticketId,
      initialSeed?.status_id,
      patchSummaryStatus,
      onStatusChange,
      onBoardChange,
      setCurrentError,
    ],
  );

  async function saveMeta() {
    const source = summary;
    if (!source) return;
    setSaving(true);
    setCurrentError(null);
    try {
      const tagNames = selectedTags
        .map((tag) => tag.name.trim())
        .filter(Boolean);
      const payload: Record<string, unknown> = {
        title,
        assignee_id: assigneeId || null,
        tags: tagNames,
      };
      if (isTaskSummary(source)) {
        payload.body = body;
      }
      await apiFetch(`/api/v1/tickets/${ticketId}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      await queryClient.invalidateQueries({
        queryKey: ticketSummaryQueryKey(ticketId),
      });
      const existingKeys = new Set(
        allTags.map((t) => t.name.trim().toLowerCase()),
      );
      const hasNewTag = tagNames.some(
        (n) => !existingKeys.has(n.trim().toLowerCase()),
      );
      if (hasNewTag) {
        await queryClient.invalidateQueries({ queryKey: ticketTagsQueryKey });
      }
      touchRecentTags(tagNames);
      onBoardChange();
    } catch (e) {
      setCurrentError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function sendEmailReply(payload: EmailComposePayload) {
    setSaving(true);
    setCurrentError(null);
    try {
      await apiFetch(`/api/v1/tickets/${ticketId}/messages`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      invalidateTicketMessages(queryClient, ticketId);
      await queryClient.invalidateQueries({
        queryKey: ticketSummaryQueryKey(ticketId),
      });
    } catch (err) {
      setCurrentError(err instanceof Error ? err.message : "Reply failed");
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
      queryClient.setQueryData<MessageRow[]>(
        ticketMessagesQueryKey(ticketId),
        (current) =>
          current?.map((msg) =>
            msg.id === messageId ? { ...msg, read: result.read } : msg,
          ) ?? current,
      );
      onBoardChange();
    } catch (err) {
      setCurrentError(
        err instanceof Error ? err.message : "Failed to update read state",
      );
    }
  }

  const statusOptions = useMemo(() => {
    if (statuses.length > 0) return statuses;
    if (summary?.status) {
      return [
        {
          id: summary.status.id,
          name: summary.status.name,
          color: summary.status.color,
        },
      ];
    }
    if (initialSeed?.status) {
      return [
        {
          id: initialSeed.status.id,
          name: initialSeed.status.name,
          color: initialSeed.status.color,
        },
      ];
    }
    return [];
  }, [statuses, summary, initialSeed]);

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
              title={displayTitle || undefined}
            >
              {headerLoading && !displayTitle ? (
                <Skeleton className="h-6 w-48" />
              ) : (
                displayTitle || "Ticket"
              )}
            </DialogTitle>
            {displaySeed && (
              <>
                {displaySeed.kind === "task" ? (
                  <Badge variant="outline" className="shrink-0">
                    Ticket
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="shrink-0">
                    Email conversation
                  </Badge>
                )}
                {statusOptions.length > 0 && effectiveStatusId && (
                  <TicketStatusCombobox
                    statuses={statusOptions}
                    value={effectiveStatusId}
                    onValueChange={changeStatus}
                    disabled={statusOptions.length === 0}
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

        {summaryQuery.isError && (
          <div className="px-4 pt-3">
            <Alert variant="destructive">
              <AlertDescription>
                {summaryQuery.error instanceof Error
                  ? summaryQuery.error.message
                  : "Failed to load ticket"}
              </AlertDescription>
            </Alert>
          </div>
        )}

        <div className="flex min-h-0 flex-1 flex-col">
          {metaLoading ? <TicketMetaSkeleton /> : null}

          {metaReady && detailSummary && (
            <div className="space-y-3 border-b border-border p-4">
              <div className="space-y-2">
                <Label htmlFor="ticket-title">Title</Label>
                <Input
                  id="ticket-title"
                  value={title}
                  onChange={(e) => updateDraft({ title: e.target.value })}
                />
              </div>
              {detailSummary.customer && detailSummary.customer_id && (
                <TicketCustomerSection
                  customerId={detailSummary.customer_id}
                  displayName={
                    isConversationSummary(detailSummary) &&
                    detailSummary.contact_address
                      ? detailSummary.contact_address
                      : detailSummary.customer.username
                  }
                  contactAddress={
                    isConversationSummary(detailSummary)
                      ? detailSummary.contact_address
                      : null
                  }
                />
              )}
              <TicketDetailsSection
                assigneeId={assigneeId}
                onAssigneeChange={(value) =>
                  updateDraft({ assigneeId: value })
                }
                users={users}
                usersLoading={usersQuery.isPending}
                selectedTags={selectedTags}
                onTagsChange={(tags) => updateDraft({ selectedTags: tags })}
                allTags={allTags}
                tagsLoading={tagsQuery.isPending}
                recentNames={recentNames}
                saving={saving}
                onSave={() => void saveMeta()}
                body={
                  isTaskSummary(detailSummary) ? body : undefined
                }
                onBodyChange={
                  isTaskSummary(detailSummary)
                    ? (value) => updateDraft({ body: value })
                    : undefined
                }
                summary={[
                  users.find((u) => u.id === assigneeId)?.username ??
                    detailSummary.assignee?.username ??
                    "Unassigned",
                  selectedTags.length > 0
                    ? selectedTags.map((tag) => tag.name).join(", ")
                    : "No tags",
                ].join(" · ")}
              />
            </div>
          )}

          {detailSummary && isConversationSummary(detailSummary) && (
            <TicketConversationSection
              summary={detailSummary}
              ticketId={ticketId}
              threadOrder={threadOrder}
              onSubmit={sendEmailReply}
              saving={saving}
              onToggleMessageRead={(id) => void toggleMessageRead(id)}
            />
          )}

          {isConversation && !detailSummary && summaryQuery.isFetching && (
            <TicketConversationSkeleton />
          )}
        </div>

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
