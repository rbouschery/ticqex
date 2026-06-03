"use client";

import { useCallback, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  DotsSixVerticalIcon,
  EyeIcon,
  EyeSlashIcon,
  TrashIcon,
} from "@phosphor-icons/react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api-client";
import { statusesQueryKey, useStatuses } from "@/hooks/use-statuses";

export type StatusColumn = {
  id: string;
  name: string;
  color: string;
  position: number;
  is_visible: boolean;
  ticket_count: number;
};

function SortableStatusRow({
  status,
  visibleCount,
  onPatch,
  onDelete,
  onError,
}: {
  status: StatusColumn;
  visibleCount: number;
  onPatch: (id: string, patch: Partial<StatusColumn>) => Promise<void>;
  onDelete: (status: StatusColumn) => void;
  onError: (message: string) => void;
}) {
  const [draftName, setDraftName] = useState<string | null>(null);
  const [isEditingName, setIsEditingName] = useState(false);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: status.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const canHide = status.is_visible ? visibleCount > 1 : true;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-2 rounded-lg border border-border bg-card px-2 py-1.5",
        isDragging && "z-10 opacity-60 shadow-md",
      )}
    >
      <button
        type="button"
        className="cursor-grab touch-none rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground active:cursor-grabbing"
        aria-label={`Reorder ${status.name}`}
        {...attributes}
        {...listeners}
      >
        <DotsSixVerticalIcon className="size-4" />
      </button>

      <label className="relative shrink-0 cursor-pointer">
        <span
          className="block size-6 rounded-full ring-1 ring-border"
          style={{ backgroundColor: status.color }}
        />
        <input
          type="color"
          value={status.color}
          className="absolute inset-0 cursor-pointer opacity-0"
          aria-label={`Color for ${status.name}`}
          onChange={async (e) => {
            const color = e.target.value;
            try {
              await onPatch(status.id, { color });
            } catch (err) {
              onError(err instanceof Error ? err.message : "Failed to update color");
            }
          }}
        />
      </label>

      <Input
        value={isEditingName && draftName !== null ? draftName : status.name}
        onFocus={() => {
          setDraftName(status.name);
          setIsEditingName(true);
        }}
        onChange={(e) => setDraftName(e.target.value)}
        onBlur={async () => {
          setIsEditingName(false);
          const trimmed = (draftName ?? status.name).trim();
          setDraftName(null);
          if (!trimmed || trimmed === status.name) return;
          try {
            await onPatch(status.id, { name: trimmed });
          } catch (err) {
            onError(err instanceof Error ? err.message : "Failed to rename status");
          }
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") {
            setDraftName(null);
            setIsEditingName(false);
            e.currentTarget.blur();
          }
        }}
        className="h-8 flex-1 border-transparent bg-transparent px-2 shadow-none focus-visible:border-input"
        aria-label={`Name for status ${status.name}`}
      />

      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        disabled={!canHide}
        title={
          canHide
            ? status.is_visible
              ? "Hide from board"
              : "Show on board"
            : "At least one column must stay visible"
        }
        aria-label={
          status.is_visible ? "Hide from board" : "Show on board"
        }
        aria-pressed={status.is_visible}
        onClick={async () => {
          if (!canHide && status.is_visible) return;
          try {
            await onPatch(status.id, { is_visible: !status.is_visible });
          } catch (err) {
            onError(
              err instanceof Error ? err.message : "Failed to update visibility",
            );
          }
        }}
      >
        {status.is_visible ? (
          <EyeIcon className="size-4" />
        ) : (
          <EyeSlashIcon className="size-4 text-muted-foreground" />
        )}
      </Button>

      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={`Delete ${status.name}`}
        onClick={() => onDelete(status)}
      >
        <TrashIcon className="size-4 text-destructive" />
      </Button>
    </div>
  );
}

function DeleteStatusDialog({
  status,
  otherStatuses,
  step,
  reassignTo,
  deleting,
  onReassignChange,
  onCancel,
  onContinue,
  onConfirm,
}: {
  status: StatusColumn;
  otherStatuses: StatusColumn[];
  step: 1 | 2;
  reassignTo: string;
  deleting: boolean;
  onReassignChange: (id: string) => void;
  onCancel: () => void;
  onContinue: () => void;
  onConfirm: () => void;
}) {
  const hasTickets = status.ticket_count > 0;

  return (
    <Dialog open onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="sm:max-w-md">
        {step === 1 ? (
          <>
            <DialogHeader>
              <DialogTitle>Delete &ldquo;{status.name}&rdquo;?</DialogTitle>
              <DialogDescription>
                This removes the status type from your workspace.
                {hasTickets
                  ? ` ${status.ticket_count} ticket(s) currently use this status.`
                  : " No tickets use this status."}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onCancel}>
                Cancel
              </Button>
              <Button type="button" variant="destructive" onClick={onContinue}>
                Continue
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Permanently delete &ldquo;{status.name}&rdquo;?</DialogTitle>
              <DialogDescription>
                This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            {hasTickets && (
              <div className="space-y-2">
                <Label htmlFor="reassign-status">
                  Reassign {status.ticket_count} ticket(s) to
                </Label>
                <Select value={reassignTo} onValueChange={onReassignChange}>
                  <SelectTrigger id="reassign-status" className="w-full">
                    <SelectValue placeholder="Choose a status" />
                  </SelectTrigger>
                  <SelectContent>
                    {otherStatuses.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onCancel}>
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                disabled={deleting || (hasTickets && !reassignTo)}
                onClick={onConfirm}
              >
                {deleting ? "Deleting…" : "Delete permanently"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function StatusColumnsSection() {
  const queryClient = useQueryClient();
  const statusesQuery = useStatuses<StatusColumn>();
  const statuses = useMemo(
    () => statusesQuery.data ?? [],
    [statusesQuery.data],
  );
  const loading = statusesQuery.isPending;
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState("#6366f1");
  const [adding, setAdding] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<StatusColumn | null>(null);
  const [deleteStep, setDeleteStep] = useState<1 | 2>(1);
  const [reassignTo, setReassignTo] = useState("");
  const [deleting, setDeleting] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  const setStatusesCache = useCallback(
    (updater: (current: StatusColumn[] | undefined) => StatusColumn[] | undefined) => {
      queryClient.setQueryData(statusesQueryKey, updater);
    },
    [queryClient],
  );

  const visibleCount = statuses.filter((s) => s.is_visible).length;

  const invalidateBoard = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["board"] });
  }, [queryClient]);

  const patchStatus = useCallback(
    async (id: string, patch: Partial<StatusColumn>) => {
      const previous = statuses;
      setStatusesCache((current) =>
        (current ?? []).map((s) => (s.id === id ? { ...s, ...patch } : s)),
      );
      try {
        const updated = await apiFetch<StatusColumn>(`/api/v1/statuses/${id}`, {
          method: "PATCH",
          body: JSON.stringify(patch),
        });
        setStatusesCache((current) =>
          (current ?? []).map((s) => (s.id === id ? updated : s)),
        );
        invalidateBoard();
      } catch (e) {
        setStatusesCache(() => previous);
        throw e;
      }
    },
    [statuses, invalidateBoard, setStatusesCache],
  );

  async function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = statuses.findIndex((s) => s.id === active.id);
    const newIndex = statuses.findIndex((s) => s.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    const reordered = arrayMove(statuses, oldIndex, newIndex);
    const previous = statuses;
    setStatusesCache(() => reordered);

    try {
      const updated = await apiFetch<StatusColumn[]>("/api/v1/statuses/reorder", {
        method: "PUT",
        body: JSON.stringify({ ids: reordered.map((s) => s.id) }),
      });
      setStatusesCache(() => updated);
      invalidateBoard();
    } catch (e) {
      setStatusesCache(() => previous);
      setError(e instanceof Error ? e.message : "Failed to reorder statuses");
    }
  }

  function openDelete(status: StatusColumn) {
    setDeleteTarget(status);
    setDeleteStep(1);
    setReassignTo("");
    setDeleting(false);
  }

  function closeDelete() {
    setDeleteTarget(null);
    setDeleteStep(1);
    setReassignTo("");
    setDeleting(false);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiFetch(`/api/v1/statuses/${deleteTarget.id}`, {
        method: "DELETE",
        body: JSON.stringify(
          deleteTarget.ticket_count > 0 ? { reassign_to: reassignTo } : {},
        ),
      });
      setStatusesCache((current) =>
        (current ?? []).filter((s) => s.id !== deleteTarget.id),
      );
      invalidateBoard();
      closeDelete();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete status");
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={onDragEnd}
      >
        <SortableContext
          items={statuses.map((s) => s.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-2">
            {statuses.map((status) => (
              <SortableStatusRow
                key={status.id}
                status={status}
                visibleCount={visibleCount}
                onPatch={patchStatus}
                onDelete={openDelete}
                onError={setError}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <form
        className="flex items-center gap-2 border-t border-border pt-4"
        onSubmit={async (e) => {
          e.preventDefault();
          const trimmed = newName.trim();
          if (!trimmed) return;
          setAdding(true);
          try {
            const created = await apiFetch<StatusColumn>("/api/v1/statuses", {
              method: "POST",
              body: JSON.stringify({
                name: trimmed,
                color: newColor,
                is_visible: true,
              }),
            });
            setStatusesCache((current) => [...(current ?? []), created]);
            invalidateBoard();
            setNewName("");
            setNewColor("#6366f1");
            setError(null);
          } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to add status");
          } finally {
            setAdding(false);
          }
        }}
      >
        <label className="relative shrink-0 cursor-pointer">
          <span
            className="block size-8 rounded-full ring-1 ring-border"
            style={{ backgroundColor: newColor }}
          />
          <input
            type="color"
            value={newColor}
            className="absolute inset-0 cursor-pointer opacity-0"
            aria-label="Color for new status"
            onChange={(e) => setNewColor(e.target.value)}
          />
        </label>
        <Input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="New column name"
          className="flex-1"
        />
        <Button type="submit" size="sm" disabled={adding || !newName.trim()}>
          Add
        </Button>
      </form>

      {deleteTarget && (
        <DeleteStatusDialog
          status={deleteTarget}
          otherStatuses={statuses.filter((s) => s.id !== deleteTarget.id)}
          step={deleteStep}
          reassignTo={reassignTo}
          deleting={deleting}
          onReassignChange={setReassignTo}
          onCancel={closeDelete}
          onContinue={() => {
            setDeleteStep(2);
            const others = statuses.filter((s) => s.id !== deleteTarget.id);
            setReassignTo(others[0]?.id ?? "");
          }}
          onConfirm={confirmDelete}
        />
      )}
    </div>
  );
}
