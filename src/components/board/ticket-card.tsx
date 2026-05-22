"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Avatar, AvatarFallback, AvatarGroup } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { BoardTicket } from "./types";

function TicketCardContent({
  ticket,
  sortable,
}: {
  ticket: BoardTicket;
  sortable: boolean;
}) {
  const customEntries = Object.entries(ticket.custom_fields).slice(0, 2);

  return (
    <Card size="sm" className={cn("py-0", sortable && "pointer-events-none")}>
      <CardContent className="space-y-2 py-3">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-medium text-foreground">{ticket.title}</h3>
          {ticket.kind === "conversation" && (
            <Badge variant="outline" className="shrink-0 text-[10px]">
              Email
            </Badge>
          )}
        </div>
        {ticket.preview && (
          <p className="line-clamp-2 text-xs text-muted-foreground">
            {ticket.preview}
          </p>
        )}
        {customEntries.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {customEntries.map(([key, value]) => (
              <Badge key={key} variant="secondary" className="text-[10px]">
                {key}: {String(value)}
              </Badge>
            ))}
          </div>
        )}
        <div className="flex items-center justify-between">
          <AvatarGroup>
            {ticket.customer && (
              <Avatar size="sm" title={ticket.customer.username}>
                <AvatarFallback className="bg-primary/10 text-[10px] text-primary">
                  {ticket.customer.initials}
                </AvatarFallback>
              </Avatar>
            )}
            {ticket.assignee && (
              <Avatar size="sm" title={ticket.assignee.username}>
                <AvatarFallback className="bg-secondary text-[10px] text-secondary-foreground">
                  {ticket.assignee.initials}
                </AvatarFallback>
              </Avatar>
            )}
          </AvatarGroup>
          <div className="flex gap-1">
            {ticket.tags.slice(0, 2).map((tag) => (
              <Badge
                key={tag.id}
                className="text-[10px] text-white"
                style={{ backgroundColor: tag.color }}
              >
                {tag.name}
              </Badge>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function TicketCard({
  ticket,
  onClick,
  dragOverlay = false,
  sortable = false,
}: {
  ticket: BoardTicket;
  onClick: () => void;
  dragOverlay?: boolean;
  sortable?: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: ticket.id,
    disabled: dragOverlay || !sortable,
  });

  const style = transform
    ? {
        transform: CSS.Transform.toString(transform),
        transition,
      }
    : undefined;

  return (
    <div
      ref={dragOverlay ? undefined : setNodeRef}
      style={style}
      {...(dragOverlay || !sortable ? {} : { ...attributes, ...listeners })}
      onClick={!dragOverlay ? onClick : undefined}
      className={cn(
        "relative rounded-xl outline-none focus:outline-none focus-visible:outline-none",
        sortable && !dragOverlay && "cursor-grab touch-none active:cursor-grabbing",
        !sortable && !dragOverlay && "cursor-pointer",
        isDragging && !dragOverlay && "opacity-40",
        dragOverlay && "shadow-lg",
      )}
    >
      {ticket.unread_count > 0 && (
        <Badge
          className="absolute -right-1.5 -top-1.5 z-10 h-5 min-w-5 justify-center border-2 border-card bg-red-600 px-1 text-[10px] font-bold text-white hover:bg-red-600"
          aria-label={`${ticket.unread_count} unread messages`}
        >
          {ticket.unread_count > 99 ? "99+" : ticket.unread_count}
        </Badge>
      )}
      <TicketCardContent ticket={ticket} sortable={sortable && !dragOverlay} />
    </div>
  );
}
