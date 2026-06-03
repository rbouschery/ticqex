"use client";

import { FormEvent, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
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
import { Textarea } from "@/components/ui/textarea";
import { TagMultiSelect } from "@/components/tags/tag-multi-select";
import type { Tag } from "@/components/tags/types";
import { useRecentTags } from "@/hooks/use-recent-tags";
import { useTicketTags } from "@/hooks/use-ticket-reference-data";
import type { CreateTicketPayload } from "./board-create-client";

export function CreateTicketModal({
  statuses,
  onClose,
  onCreate,
}: {
  statuses: { id: string; name: string }[];
  onClose: () => void;
  onCreate: (payload: CreateTicketPayload) => void;
}) {
  const [title, setTitle] = useState("");
  const [contact, setContact] = useState("");
  const [statusId, setStatusId] = useState(statuses[0]?.id ?? "");
  const [body, setBody] = useState("");
  const [selectedTags, setSelectedTags] = useState<Tag[]>([]);
  const tagsQuery = useTicketTags();
  const allTags = tagsQuery.data ?? [];
  const { recentNames, touch: touchRecentTags } = useRecentTags();
  const [error, setError] = useState<string | null>(null);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError("Title is required");
      return;
    }

    setError(null);
    const trimmedBody = body.trim();
    const trimmedContact = contact.trim();
    const tagNames = selectedTags.map((tag) => tag.name.trim()).filter(Boolean);

    onCreate({
      title: trimmedTitle,
      ...(trimmedBody ? { body: trimmedBody } : {}),
      ...(trimmedContact ? { contactUsername: trimmedContact } : {}),
      statusId,
      tags: selectedTags,
    });
    if (tagNames.length) touchRecentTags(tagNames);
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New Ticket</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="ticket-title">Title</Label>
            <Input
              id="ticket-title"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ticket-contact">Contact (optional)</Label>
            <Input
              id="ticket-contact"
              placeholder="email or username"
              value={contact}
              onChange={(e) => setContact(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={statusId} onValueChange={setStatusId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                {statuses.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
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
              onChange={setSelectedTags}
              recentNames={recentNames}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ticket-body">Description</Label>
            <Textarea
              id="ticket-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={3}
            />
          </div>
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <DialogFooter className="mb-0 border-0 bg-transparent p-0 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={!title.trim()}>
              Create
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
