"use client";

import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { Avatar, AvatarFallback, AvatarGroup } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { BoardTicket } from "./types";

export function TicketCard({
  ticket,
  onClick,
  dragOverlay = false,
}: {
  ticket: BoardTicket;
  onClick: () => void;
  dragOverlay?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: ticket.id });

  const style = transform
    ? {
        transform: CSS.Translate.toString(transform),
        opacity: isDragging ? 0.4 : 1,
      }
    : undefined;

  const customEntries = Object.entries(ticket.custom_fields).slice(0, 2);

  return (
    <div
      ref={dragOverlay ? undefined : setNodeRef}
      style={style}
      {...(dragOverlay ? {} : { ...attributes, ...listeners })}
      onClick={onClick}
      className={cn("relative", dragOverlay && "shadow-lg")}
    >
      {ticket.unread_count > 0 && (
        <Badge
          className="absolute -right-1.5 -top-1.5 z-10 h-5 min-w-5 justify-center border-2 border-card bg-red-600 px-1 text-[10px] font-bold text-white hover:bg-red-600"
          aria-label={`${ticket.unread_count} unread messages`}
        >
          {ticket.unread_count > 99 ? "99+" : ticket.unread_count}
        </Badge>
      )}
      <Card
        size="sm"
        className="cursor-pointer py-0 transition-colors hover:ring-ring/50 hover:ring-2"
      >
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
    </div>
  );
}
