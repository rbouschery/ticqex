"use client";

import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { TaskTicketDetail } from "./types";

export function TaskTicketPanel({
  ticket,
  body,
  onBodyChange,
}: {
  ticket: TaskTicketDetail;
  body: string;
  onBodyChange: (value: string) => void;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col p-4">
      <div className="space-y-2">
        <Label htmlFor="task-body">Description</Label>
        <Textarea
          id="task-body"
          value={body}
          onChange={(e) => onBodyChange(e.target.value)}
          rows={12}
          placeholder="Describe this task…"
          className="min-h-[200px] resize-y"
        />
        {ticket.customer && (
          <p className="text-xs text-muted-foreground">
            Linked customer: {ticket.customer.username}
          </p>
        )}
      </div>
    </div>
  );
}
