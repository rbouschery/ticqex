"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { X } from "lucide-react";
import {
  ArrowsLeftRightIcon,
  CopyIcon,
  DotsThreeVerticalIcon,
  TrashIcon,
} from "@phosphor-icons/react";
import { getConversationOriginBadge } from "@shared/channels/ticket-origin-badge";
import {
  CORE_TICKET_FIELD_IDS,
  resolveCoreTicketFieldVisibility,
  resolveVisibleTicketCustomFields,
  type ResolvedTicketFieldLayout,
} from "@shared/ticket-fields";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TicketDeleteDialog, ticketDeleteCopy } from "./ticket-delete-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch, apiFetchText } from "@/lib/api-client";
import { useTicketRealtime } from "@/hooks/use-board-realtime";
import { useRecentTags } from "@/hooks/use-recent-tags";
import { ticketMessagesQueryKey } from "@/hooks/use-ticket-messages";
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
  useCopyContextSettings,
  useTicketTags,
  useTicketThreadOrder,
  useTicketUsers,
} from "@/hooks/use-ticket-reference-data";
import { TicketConversationSection } from "./ticket-conversation-section";
import { TicketContactSection } from "./ticket-contact-section";
import { TicketDetailsSection } from "./ticket-details-section";
import {
  TicketCustomFieldsSection,
  type TicketCustomFieldEditorDef,
} from "./ticket-custom-fields-section";
import { useTicketFieldLayoutFallback } from "@/hooks/use-ticket-field-layout";
import { useTicketCustomFieldDefinitions } from "@/hooks/use-ticket-custom-field-definitions";
import {
  TicketMetaSkeleton,
  TicketConversationSkeleton,
} from "./ticket-modal-skeletons";
import {
  TicketStatusCombobox,
  type StatusOption,
} from "./ticket-status-combobox";
import type { MessageRow } from "./types";
import { useTicketModalDraft } from "./use-ticket-modal-draft";
import { useTicketModalMetadataSave } from "./use-ticket-modal-metadata-save";
import { useTicketModalEmailActions } from "./use-ticket-modal-email-actions";

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA") return true;
  return target.isContentEditable;
}

export function TicketModal({
  ticketId,
  statuses,
  initialSeed,
  fieldLayout: fieldLayoutFromBoard,
  onStatusChange,
  onClose,
  onBoardChange,
  onTicketDeleted,
}: {
  ticketId: string;
  statuses: StatusOption[];
  initialSeed?: TicketModalSeed;
  fieldLayout?: ResolvedTicketFieldLayout | null;
  onStatusChange: (
    ticketId: string,
    fromStatusId: string,
    toStatusId: string,
  ) => Promise<void>;
  onClose: () => void;
  onBoardChange: (updated?: { id: string; unread_count?: number }) => void;
  onTicketDeleted: (ticketId: string) => void;
}) {
  const queryClient = useQueryClient();
  const fieldLayout = useTicketFieldLayoutFallback(fieldLayoutFromBoard ?? null);
  const summaryQuery = useTicketSummary(ticketId);
  const usersQuery = useTicketUsers();
  const tagsQuery = useTicketTags();
  const threadOrderQuery = useTicketThreadOrder();
  const copyContextSettingsQuery = useCopyContextSettings();

  const summary = summaryQuery.data;
  const users = usersQuery.data ?? [];
  const allTags = tagsQuery.data ?? [];
  const threadOrder = threadOrderQuery.data ?? "oldest_first";
  const showCopyContext = copyContextSettingsQuery.data?.visible ?? true;

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
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteStep, setDeleteStep] = useState<1 | 2>(1);
  const [deleteDeleting, setDeleteDeleting] = useState(false);
  const {
    title,
    body,
    assigneeId,
    selectedTags,
    customFieldPatch,
    customFieldsDirty,
    customFieldValues,
    updateDraft,
    updateCustomFieldValue,
    clearCustomFieldPatch,
  } = useTicketModalDraft(ticketId, summary);
  const error =
    errorState?.ticketId === ticketId ? errorState.message : null;

  const setCurrentError = useCallback(
    (message: string | null) => {
      setErrorState(message ? { ticketId, message } : null);
    },
    [ticketId],
  );

  const { saveMeta, saveCustomFields } = useTicketModalMetadataSave({
    ticketId,
    summary,
    title,
    body,
    assigneeId,
    selectedTags,
    customFieldPatch,
    allTags,
    queryClient,
    setSaving,
    setCurrentError,
    onBoardChange: () => onBoardChange(),
    touchRecentTags,
    onCustomFieldsSaved: clearCustomFieldPatch,
  });

  const {
    saveEmailDraft,
    updateEmailDraft,
    sendEmailDraft,
    deleteEmailDraft,
    sendEmailReply,
  } = useTicketModalEmailActions({
    ticketId,
    queryClient,
    setSaving,
    setCurrentError,
  });

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

  async function copyContext() {
    try {
      const text = await apiFetchText(`/api/v1/tickets/${ticketId}/context`);
      await navigator.clipboard.writeText(text);
      toast.success("Context copied");
    } catch {
      toast.error("Could not copy context", {
        description: "Failed to copy ticket context to clipboard.",
      });
    }
  }

  function openDeleteDialog() {
    setDeleteStep(1);
    setDeleteDeleting(false);
    setDeleteOpen(true);
  }

  function closeDeleteDialog() {
    if (deleteDeleting) return;
    setDeleteOpen(false);
    setDeleteStep(1);
  }

  async function confirmDelete() {
    setDeleteDeleting(true);
    setCurrentError(null);
    try {
      await apiFetch(`/api/v1/tickets/${ticketId}`, { method: "DELETE" });
      setDeleteOpen(false);
      onTicketDeleted(ticketId);
    } catch (err) {
      setCurrentError(err instanceof Error ? err.message : "Delete failed");
      setDeleteDeleting(false);
    }
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

  const isTask =
    (summary && isTaskSummary(summary)) ||
    displaySeed?.kind === "task";
  const conversationOriginBadge =
    displaySeed?.kind === "conversation"
      ? getConversationOriginBadge(displaySeed.origin)
      : null;
  const deleteKind = isTask ? "task" : "conversation";
  const deleteCopy = ticketDeleteCopy(deleteKind);

  const visibleFields = useMemo(
    () => resolveCoreTicketFieldVisibility(fieldLayout, "ticket"),
    [fieldLayout],
  );
  const showContact = visibleFields[CORE_TICKET_FIELD_IDS.contact];
  const showAssignee = visibleFields[CORE_TICKET_FIELD_IDS.assignee];
  const showTags = visibleFields[CORE_TICKET_FIELD_IDS.tags];
  const showDescription = visibleFields[CORE_TICKET_FIELD_IDS.description];

  const customFieldDefinitions = useMemo(
    () => resolveVisibleTicketCustomFields(fieldLayout, "ticket"),
    [fieldLayout],
  );

  const { definitions: fullCustomFieldDefinitions, isPending: customFieldsDefsPending } =
    useTicketCustomFieldDefinitions(customFieldDefinitions.length > 0);

  const customFieldEditorDefinitions = useMemo((): TicketCustomFieldEditorDef[] => {
    const byKey = new Map(
      fullCustomFieldDefinitions.map((d) => [d.key, d]),
    );
    return customFieldDefinitions.map((def) => {
      const full = byKey.get(def.key);
      return {
        ...def,
        options: full?.options ?? null,
      };
    });
  }, [customFieldDefinitions, fullCustomFieldDefinitions]);

  const showDetailsSection =
    showAssignee ||
    showTags ||
    (showDescription && !!summary && isTaskSummary(summary));

  const moveDestinations = useMemo(
    () =>
      effectiveStatusId
        ? statusOptions.filter((status) => status.id !== effectiveStatusId)
        : [],
    [statusOptions, effectiveStatusId],
  );

  return (
    <>
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
                ) : conversationOriginBadge ? (
                  <Badge
                    variant={conversationOriginBadge.variant}
                    className="shrink-0"
                  >
                    {conversationOriginBadge.label}
                  </Badge>
                ) : null}
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
            {showCopyContext ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="hidden sm:inline-flex"
                onClick={() => void copyContext()}
              >
                <CopyIcon />
                Copy context
              </Button>
            ) : null}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Ticket actions"
                  disabled={deleteDeleting}
                >
                  <DotsThreeVerticalIcon />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-44">
                {moveDestinations.length > 0 ? (
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger>
                      <ArrowsLeftRightIcon />
                      Move to…
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent>
                      {moveDestinations.map((status) => (
                        <DropdownMenuItem
                          key={status.id}
                          onClick={() => changeStatus(status.id)}
                        >
                          <span
                            className="size-2 shrink-0 rounded-full"
                            style={{ backgroundColor: status.color }}
                          />
                          {status.name}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                ) : null}
                {showCopyContext ? (
                  <DropdownMenuItem onClick={() => void copyContext()}>
                    <CopyIcon />
                    Copy context
                  </DropdownMenuItem>
                ) : null}
                {moveDestinations.length > 0 || showCopyContext ? (
                  <DropdownMenuSeparator />
                ) : null}
                <DropdownMenuItem
                  variant="destructive"
                  onClick={openDeleteDialog}
                >
                  <TrashIcon />
                  {deleteCopy.label}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={onClose}
              aria-label="Close"
              disabled={deleteDeleting}
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
              {!showDetailsSection && (
                <div className="flex justify-end">
                  <Button
                    type="button"
                    size="sm"
                    disabled={saving}
                    onClick={() => void saveMeta()}
                  >
                    Save details
                  </Button>
                </div>
              )}
              {showContact && detailSummary.contact && detailSummary.contact_id && (
                <TicketContactSection
                  contactId={detailSummary.contact_id}
                  displayName={
                    isConversationSummary(detailSummary) &&
                    detailSummary.contact_address
                      ? detailSummary.contact_address
                      : detailSummary.contact.username
                  }
                  contactAddress={
                    isConversationSummary(detailSummary)
                      ? detailSummary.contact_address
                      : null
                  }
                />
              )}
              {showDetailsSection && (
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
                  showAssignee={showAssignee}
                  showTags={showTags}
                  body={
                    showDescription && isTaskSummary(detailSummary)
                      ? body
                      : undefined
                  }
                  onBodyChange={
                    showDescription && isTaskSummary(detailSummary)
                      ? (value) => updateDraft({ body: value })
                      : undefined
                  }
                  summary={[
                    showAssignee
                      ? users.find((u) => u.id === assigneeId)?.username ??
                        detailSummary.assignee?.username ??
                        "Unassigned"
                      : null,
                    showTags
                      ? selectedTags.length > 0
                        ? selectedTags.map((tag) => tag.name).join(", ")
                        : "No tags"
                      : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                />
              )}
              {customFieldDefinitions.length > 0 && (
                <TicketCustomFieldsSection
                  definitions={customFieldEditorDefinitions}
                  values={customFieldValues}
                  optionsLoading={customFieldsDefsPending}
                  saving={saving}
                  dirty={customFieldsDirty}
                  onValueChange={updateCustomFieldValue}
                  onSave={() => void saveCustomFields()}
                />
              )}
            </div>
          )}

          {detailSummary && isConversationSummary(detailSummary) && (
            <TicketConversationSection
              summary={detailSummary}
              ticketId={ticketId}
              threadOrder={threadOrder}
              onSubmit={sendEmailReply}
              onSaveDraft={saveEmailDraft}
              onUpdateDraft={updateEmailDraft}
              onSendDraft={sendEmailDraft}
              onDeleteDraft={deleteEmailDraft}
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

      <TicketDeleteDialog
        open={deleteOpen}
        kind={deleteKind}
        step={deleteStep}
        deleting={deleteDeleting}
        onOpenChange={(open) => {
          if (!open) closeDeleteDialog();
          else setDeleteOpen(true);
        }}
        onStepChange={setDeleteStep}
        onConfirmDelete={() => void confirmDelete()}
      />
    </>
  );
}
