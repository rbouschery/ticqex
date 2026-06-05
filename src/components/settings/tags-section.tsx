"use client";

import { useCallback, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { TrashIcon } from "@phosphor-icons/react";
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
import { Skeleton } from "@/components/ui/skeleton";
import { TagBadge } from "@/components/tags/tag-badge";
import { DEFAULT_TAG_COLOR, type Tag } from "@/components/tags/types";
import { apiFetch } from "@/lib/api-client";
import {
  ticketTagsQueryKey,
  useTicketTags,
} from "@/hooks/use-ticket-reference-data";

type TagRow = Tag & { id: string };

function TagRow({
  tag,
  onPatch,
  onDelete,
  onError,
}: {
  tag: TagRow;
  onPatch: (id: string, patch: Partial<TagRow>) => Promise<void>;
  onDelete: (tag: TagRow) => void;
  onError: (message: string) => void;
}) {
  const [draftName, setDraftName] = useState<string | null>(null);
  const [isEditingName, setIsEditingName] = useState(false);
  const [draftColor, setDraftColor] = useState(tag.color);
  const [prevTagColor, setPrevTagColor] = useState(tag.color);
  if (tag.color !== prevTagColor) {
    setPrevTagColor(tag.color);
    setDraftColor(tag.color);
  }

  return (
    <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-2 py-1.5">
      <label className="relative shrink-0 cursor-pointer">
        <span
          className="block size-6 rounded-full ring-1 ring-border"
          style={{ backgroundColor: draftColor }}
        />
        <input
          type="color"
          value={draftColor}
          className="absolute inset-0 cursor-pointer opacity-0"
          aria-label={`Color for ${tag.name}`}
          onChange={(e) => setDraftColor(e.target.value)}
          onBlur={async () => {
            if (draftColor === tag.color) return;
            try {
              await onPatch(tag.id, { color: draftColor });
            } catch (err) {
              setDraftColor(tag.color);
              onError(
                err instanceof Error ? err.message : "Failed to update color",
              );
            }
          }}
        />
      </label>

      <Input
        value={isEditingName && draftName !== null ? draftName : tag.name}
        onFocus={() => {
          setDraftName(tag.name);
          setIsEditingName(true);
        }}
        onChange={(e) => setDraftName(e.target.value)}
        onBlur={async () => {
          setIsEditingName(false);
          const trimmed = (draftName ?? tag.name).trim();
          setDraftName(null);
          if (!trimmed || trimmed === tag.name) return;
          try {
            await onPatch(tag.id, { name: trimmed });
          } catch (err) {
            onError(
              err instanceof Error ? err.message : "Failed to rename tag",
            );
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
        aria-label={`Name for tag ${tag.name}`}
      />

      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={`Delete ${tag.name}`}
        onClick={() => onDelete(tag)}
      >
        <TrashIcon className="size-4 text-destructive" />
      </Button>
    </div>
  );
}

function DeleteTagDialog({
  tag,
  onCancel,
  onConfirm,
}: {
  tag: TagRow;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog open onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delete &ldquo;{tag.name}&rdquo;?</DialogTitle>
          <DialogDescription>
            This removes the tag from all tickets. This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="button" variant="destructive" onClick={onConfirm}>
            Delete tag
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function TagsSection() {
  const queryClient = useQueryClient();
  const tagsQuery = useTicketTags();
  const tags = useMemo(
    () => (tagsQuery.data ?? []) as TagRow[],
    [tagsQuery.data],
  );
  const loading = tagsQuery.isPending;
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(DEFAULT_TAG_COLOR);
  const [adding, setAdding] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<TagRow | null>(null);

  const setTagsCache = useCallback(
    (updater: (current: TagRow[] | undefined) => TagRow[] | undefined) => {
      queryClient.setQueryData(ticketTagsQueryKey, updater);
    },
    [queryClient],
  );

  const patchTag = useCallback(
    async (id: string, patch: Partial<TagRow>) => {
      const previous = tags;
      setTagsCache((current) =>
        (current ?? []).map((tag) => (tag.id === id ? { ...tag, ...patch } : tag)),
      );
      try {
        const updated = await apiFetch<TagRow>(`/api/v1/tags/${id}`, {
          method: "PATCH",
          body: JSON.stringify(patch),
        });
        setTagsCache((current) =>
          (current ?? []).map((tag) => (tag.id === id ? updated : tag)),
        );
      } catch (e) {
        setTagsCache(() => previous);
        throw e;
      }
    },
    [tags, setTagsCache],
  );

  function confirmDelete() {
    if (!deleteTarget) return;

    const target = deleteTarget;
    const previous = tags;
    setDeleteTarget(null);
    setError(null);
    setTagsCache((current) =>
      (current ?? []).filter((tag) => tag.id !== target.id),
    );

    void (async () => {
      try {
        await apiFetch(`/api/v1/tags/${target.id}`, { method: "DELETE" });
      } catch (err) {
        setTagsCache(() => previous);
        setError(err instanceof Error ? err.message : "Failed to delete tag");
      }
    })();
  }

  if (loading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
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

      <div className="flex flex-wrap gap-2">
        {tags.map((tag) => (
          <TagBadge key={tag.id} name={tag.name} color={tag.color} />
        ))}
        {tags.length === 0 && (
          <p className="text-sm text-muted-foreground">No tags yet.</p>
        )}
      </div>

      <div className="space-y-2">
        {tags.map((tag) => (
          <TagRow
            key={tag.id}
            tag={tag}
            onPatch={patchTag}
            onDelete={setDeleteTarget}
            onError={setError}
          />
        ))}
      </div>

      <form
        className="flex items-center gap-2 border-t border-border pt-4"
        onSubmit={async (e) => {
          e.preventDefault();
          const trimmed = newName.trim();
          if (!trimmed) return;
          setAdding(true);
          try {
            const created = await apiFetch<TagRow>("/api/v1/tags", {
              method: "POST",
              body: JSON.stringify({ name: trimmed, color: newColor }),
            });
            setTagsCache((current) =>
              [...(current ?? []), created].sort((a, b) =>
                a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
              ),
            );
            setNewName("");
            setNewColor(DEFAULT_TAG_COLOR);
            setError(null);
          } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to add tag");
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
            aria-label="Color for new tag"
            onChange={(e) => setNewColor(e.target.value)}
          />
        </label>
        <Input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="New tag name"
          className="flex-1"
        />
        <Button type="submit" size="sm" disabled={adding || !newName.trim()}>
          Add
        </Button>
      </form>

      {deleteTarget && (
        <DeleteTagDialog
          tag={deleteTarget}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={confirmDelete}
        />
      )}
    </div>
  );
}
