"use client";

import { ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TagMultiSelect } from "@/components/tags/tag-multi-select";
import type { Tag } from "@/components/tags/types";
import { Textarea } from "@/components/ui/textarea";
import { usePersistedExpanded } from "@/hooks/use-persisted-expanded";

const UNASSIGNED = "__unassigned__";
const STORAGE_PREFIX = "ticqex.ticket-details.expanded.v2";

export function TicketDetailsSection({
  assigneeId,
  onAssigneeChange,
  users,
  selectedTags,
  onTagsChange,
  allTags,
  recentNames,
  saving,
  onSave,
  summary,
  body,
  onBodyChange,
}: {
  assigneeId: string;
  onAssigneeChange: (value: string) => void;
  users: { id: string; username: string }[];
  selectedTags: Tag[];
  onTagsChange: (tags: Tag[]) => void;
  allTags: Tag[];
  recentNames: string[];
  saving: boolean;
  onSave: () => void;
  summary?: string;
  body?: string;
  onBodyChange?: (value: string) => void;
}) {
  const { expanded, toggleExpanded } = usePersistedExpanded(
    STORAGE_PREFIX,
    true,
  );

  return (
    <div className="-mx-4 border-t border-border">
      <button
        type="button"
        className="flex w-full items-center gap-2 border-b border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted/50"
        aria-expanded={expanded}
        onClick={toggleExpanded}
      >
        {expanded ? (
          <ChevronDown className="size-3.5 shrink-0" />
        ) : (
          <ChevronRight className="size-3.5 shrink-0" />
        )}
        Details
        {!expanded && summary && (
          <span className="ml-auto min-w-0 truncate text-xs font-normal text-muted-foreground">
            {summary}
          </span>
        )}
      </button>

      {expanded && (
        <div className="space-y-3 p-4">
          <div className="space-y-2">
            <Label>Assignee</Label>
            <Select
              value={assigneeId || UNASSIGNED}
              onValueChange={(v) =>
                onAssigneeChange(v === UNASSIGNED ? "" : v)
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Unassigned" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
                {users.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.username}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Tags</Label>
            <TagMultiSelect
              value={selectedTags}
              options={allTags}
              onChange={onTagsChange}
              recentNames={recentNames}
              disabled={saving}
            />
          </div>
          {onBodyChange && (
            <div className="space-y-2">
              <Label htmlFor="ticket-body">Description</Label>
              <Textarea
                id="ticket-body"
                value={body ?? ""}
                onChange={(e) => onBodyChange(e.target.value)}
                rows={8}
                placeholder="Describe this ticket…"
                className="min-h-[160px] resize-y"
              />
            </div>
          )}
          <div className="flex justify-end">
            <Button
              type="button"
              size="sm"
              disabled={saving}
              onClick={onSave}
            >
              Save details
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
