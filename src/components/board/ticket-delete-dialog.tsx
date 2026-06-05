"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function ticketDeleteCopy(kind: "task" | "conversation") {
  const isTask = kind === "task";
  return {
    label: "Delete",
    title: isTask ? "Delete this task?" : "Delete this email conversation?",
    permanentTitle: isTask
      ? "Permanently delete this task?"
      : "Permanently delete this email conversation?",
    description: isTask
      ? "The task and its details will be removed from your board."
      : "The conversation and all messages will be removed from your board.",
    permanentDescription:
      "This action cannot be undone. If a new email arrives later, it will start a new conversation.",
  };
}

export function TicketDeleteDialog({
  open,
  kind,
  step,
  deleting,
  onOpenChange,
  onStepChange,
  onConfirmDelete,
}: {
  open: boolean;
  kind: "task" | "conversation";
  step: 1 | 2;
  deleting: boolean;
  onOpenChange: (open: boolean) => void;
  onStepChange: (step: 1 | 2) => void;
  onConfirmDelete: () => void;
}) {
  const copy = ticketDeleteCopy(kind);

  function close() {
    if (deleting) return;
    onOpenChange(false);
    onStepChange(1);
  }

  function stopCardOpen(e: React.SyntheticEvent) {
    e.stopPropagation();
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && close()}>
      <DialogContent
        className="sm:max-w-md"
        onClick={stopCardOpen}
        onPointerDown={stopCardOpen}
      >
        {step === 1 ? (
          <>
            <DialogHeader>
              <DialogTitle>{copy.title}</DialogTitle>
              <DialogDescription>{copy.description}</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={close}
                disabled={deleting}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={() => onStepChange(2)}
                disabled={deleting}
              >
                Continue
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>{copy.permanentTitle}</DialogTitle>
              <DialogDescription>{copy.permanentDescription}</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={close}
                disabled={deleting}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                disabled={deleting}
                onClick={onConfirmDelete}
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
