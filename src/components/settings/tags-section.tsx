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

  return (
    <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-2 py-1.5">
      <label className="relative shrink-0 cursor-pointer">
        <span
          className="block size-6 rounded-full ring-1 ring-border"
          style={{ backgroundColor: tag.color }}
        />
        <input
          type="color"
          value={tag.color}
          className="absolute inset-0 cursor-pointer opacity-0"
          aria-label={`Color for ${tag.name}`}
          onChange={async (e) => {
            const color = e.target.value;
            try {
              await onPatch(tag.id, { color });
            } catch (err) {
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
  deleting,
  onCancel,
  onConfirm,
}: {
  tag: TagRow;
  deleting: boolean;
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
          <Button
            type="button"
            variant="destructive"
            disabled={deleting}
            onClick={onConfirm}
          >
            {deleting ? "Deleting…" : "Delete tag"}
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
  const [deleting, setDeleting] = useState(false);

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

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiFetch(`/api/v1/tags/${deleteTarget.id}`, { method: "DELETE" });
      setTagsCache((current) =>
        (current ?? []).filter((tag) => tag.id !== deleteTarget.id),
      );
      setDeleteTarget(null);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete tag");
    } finally {
      setDeleting(false);
    }
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
          deleting={deleting}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => void confirmDelete()}
        />
      )}
    </div>
  );
}
