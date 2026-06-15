"use client";

import { useMemo, useState } from "react";
import { PencilSimpleIcon, TrashIcon } from "@phosphor-icons/react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  flattenTicketComments,
  useTicketCommentMutations,
  useTicketComments,
} from "@/hooks/use-ticket-comments";
import type { CommentThreadOrder, TicketComment } from "@/types/comments";
import { CommentAuthorLabel } from "./comment-author-label";
import { DeleteCommentDialog } from "./delete-comment-dialog";
import {
  MarkdownCompose,
  MarkdownComposeActions,
} from "./markdown-compose";
import { MarkdownContent } from "./markdown-content";

function CommentRow({
  comment,
  saving,
  canManage,
  onEdit,
  onDelete,
}: {
  comment: TicketComment;
  saving: boolean;
  canManage: boolean;
  onEdit: (commentId: string, body: string) => Promise<void>;
  onDelete: (comment: TicketComment) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(comment.body);

  async function saveEdit() {
    const trimmed = draft.trim();
    if (!trimmed || trimmed === comment.body) {
      setEditing(false);
      setDraft(comment.body);
      return;
    }
    await onEdit(comment.id, trimmed);
    setEditing(false);
  }

  return (
    <div className="rounded-lg bg-muted/50 p-3 text-sm ring-1 ring-foreground/5">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0 space-y-1">
          <CommentAuthorLabel comment={comment} />
          <time
            dateTime={comment.created_at}
            className="block text-xs tabular-nums text-muted-foreground"
          >
            {new Date(comment.created_at).toLocaleString()}
          </time>
        </div>
        {canManage && !editing ? (
          <div className="flex shrink-0 items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label="Edit comment"
              disabled={saving}
              onClick={() => {
                setDraft(comment.body);
                setEditing(true);
              }}
            >
              <PencilSimpleIcon />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label="Delete comment"
              disabled={saving}
              onClick={() => onDelete(comment)}
            >
              <TrashIcon className="text-destructive" />
            </Button>
          </div>
        ) : null}
      </div>

      {editing ? (
        <div className="space-y-3">
          <MarkdownCompose
            value={draft}
            onChange={setDraft}
            disabled={saving}
            placeholder="Edit comment…"
          />
          <MarkdownComposeActions
            onCancel={() => {
              setDraft(comment.body);
              setEditing(false);
            }}
            onSubmit={() => void saveEdit()}
            submitLabel="Save"
            disabled={saving}
            submitDisabled={!draft.trim()}
          />
        </div>
      ) : (
        <MarkdownContent content={comment.body} />
      )}
    </div>
  );
}

export function TicketCommentsSection({
  ticketId,
  threadOrder,
}: {
  ticketId: string;
  threadOrder: CommentThreadOrder;
}) {
  const commentsQuery = useTicketComments(ticketId, threadOrder);
  const {
    createComment,
    updateComment,
    deleteComment,
    isCreating,
    isUpdating,
    isDeleting,
  } = useTicketCommentMutations(ticketId, threadOrder);

  const [composeBody, setComposeBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TicketComment | null>(null);

  const comments = useMemo(
    () => flattenTicketComments(commentsQuery.data?.pages),
    [commentsQuery.data?.pages],
  );

  const saving = isCreating || isUpdating || isDeleting;
  const hasMore = commentsQuery.hasNextPage;

  async function submitComment() {
    const trimmed = composeBody.trim();
    if (!trimmed) return;
    setError(null);
    try {
      await createComment(trimmed);
      setComposeBody("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add comment");
    }
  }

  async function editComment(commentId: string, body: string) {
    setError(null);
    try {
      await updateComment({ commentId, body });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update comment");
      throw err;
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setError(null);
    try {
      await deleteComment(deleteTarget.id);
      setDeleteTarget(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete comment");
    }
  }

  return (
    <>
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <div className="space-y-3 p-4">
            {commentsQuery.isPending ? (
              <>
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
              </>
            ) : null}

            {commentsQuery.isError ? (
              <Alert variant="destructive">
                <AlertDescription>
                  {commentsQuery.error instanceof Error
                    ? commentsQuery.error.message
                    : "Failed to load comments"}
                </AlertDescription>
              </Alert>
            ) : null}

            {!commentsQuery.isPending &&
              !commentsQuery.isError &&
              comments.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No comments yet.
                </p>
              )}

            {comments.map((comment) => (
              <CommentRow
                key={comment.id}
                comment={comment}
                saving={saving}
                canManage={comment.can_manage}
                onEdit={editComment}
                onDelete={setDeleteTarget}
              />
            ))}

            {hasMore ? (
              <div className="flex justify-center pt-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={commentsQuery.isFetchingNextPage}
                  onClick={() => void commentsQuery.fetchNextPage()}
                >
                  {commentsQuery.isFetchingNextPage
                    ? "Loading…"
                    : "Load more"}
                </Button>
              </div>
            ) : null}
          </div>
        </div>

        <div className="shrink-0 space-y-3 border-t border-border p-4">
          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          <MarkdownCompose
            id={`ticket-comment-compose-${ticketId}`}
            value={composeBody}
            onChange={setComposeBody}
            disabled={saving}
          />
          <MarkdownComposeActions
            onSubmit={() => void submitComment()}
            submitLabel="Add comment"
            disabled={saving}
            submitDisabled={!composeBody.trim()}
          />
        </div>
      </div>

      <DeleteCommentDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        onConfirm={() => void confirmDelete()}
        deleting={isDeleting}
      />
    </>
  );
}
