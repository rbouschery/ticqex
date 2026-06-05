"use client";

import { useCallback, useMemo, useRef, useState } from "react";
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
  const [draftColor, setDraftColor] = useState(status.color);
  const [prevStatusColor, setPrevStatusColor] = useState(status.color);
  if (status.color !== prevStatusColor) {
    setPrevStatusColor(status.color);
    setDraftColor(status.color);
  }

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
          style={{ backgroundColor: draftColor }}
        />
        <input
          type="color"
          value={draftColor}
          className="absolute inset-0 cursor-pointer opacity-0"
          aria-label={`Color for ${status.name}`}
          onChange={(e) => setDraftColor(e.target.value)}
          onBlur={async () => {
            if (draftColor === status.color) return;
            try {
              await onPatch(status.id, { color: draftColor });
            } catch (err) {
              setDraftColor(status.color);
              onError(
                err instanceof Error ? err.message : "Failed to update color",
              );
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
  reassignTo,
  onReassignChange,
  onCancel,
  onConfirm,
}: {
  status: StatusColumn;
  otherStatuses: StatusColumn[];
  reassignTo: string;
  onReassignChange: (id: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const hasTickets = status.ticket_count > 0;

  return (
    <Dialog open onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delete &ldquo;{status.name}&rdquo;?</DialogTitle>
          <DialogDescription>
            This removes the status type from your workspace.
            {hasTickets
              ? ` ${status.ticket_count} ticket(s) currently use this status.`
              : " No tickets use this status."}
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
            disabled={hasTickets && !reassignTo}
            onClick={onConfirm}
          >
            Delete
          </Button>
        </DialogFooter>
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
  const [reassignTo, setReassignTo] = useState("");
  const reorderQueueRef = useRef(Promise.resolve());

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
    setStatusesCache(() => reordered);

    reorderQueueRef.current = reorderQueueRef.current
      .catch(() => undefined)
      .then(async () => {
        try {
          const updated = await apiFetch<StatusColumn[]>(
            "/api/v1/statuses/reorder",
            {
              method: "PUT",
              body: JSON.stringify({ ids: reordered.map((s) => s.id) }),
            },
          );
          setStatusesCache(() => updated);
          invalidateBoard();
          setError(null);
        } catch (e) {
          void queryClient.invalidateQueries({ queryKey: statusesQueryKey });
          setError(
            e instanceof Error ? e.message : "Failed to reorder statuses",
          );
        }
      });
  }

  function openDelete(status: StatusColumn) {
    const others = statuses.filter((s) => s.id !== status.id);
    setDeleteTarget(status);
    setReassignTo(others[0]?.id ?? "");
  }

  function closeDelete() {
    setDeleteTarget(null);
    setReassignTo("");
  }

  function confirmDelete() {
    if (!deleteTarget) return;

    const target = deleteTarget;
    const previous = statuses;
    const reassignment = reassignTo;
    closeDelete();
    setError(null);
    setStatusesCache((current) =>
      (current ?? []).filter((s) => s.id !== target.id),
    );
    invalidateBoard();

    void (async () => {
      try {
        await apiFetch(`/api/v1/statuses/${target.id}`, {
          method: "DELETE",
          body: JSON.stringify(
            target.ticket_count > 0 ? { reassign_to: reassignment } : {},
          ),
        });
      } catch (e) {
        setStatusesCache(() => previous);
        invalidateBoard();
        setError(e instanceof Error ? e.message : "Failed to delete status");
      }
    })();
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
          reassignTo={reassignTo}
          onReassignChange={setReassignTo}
          onCancel={closeDelete}
          onConfirm={confirmDelete}
        />
      )}
    </div>
  );
}
