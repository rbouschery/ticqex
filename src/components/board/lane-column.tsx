"use client";

import { useDroppable } from "@dnd-kit/core";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { TicketCard } from "./ticket-card";
import type { BoardLane } from "./types";

export function LaneColumn({
  lane,
  onTicketClick,
}: {
  lane: BoardLane;
  onTicketClick: (id: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: lane.status.id });

  return (
    <section
      ref={setNodeRef}
      className={cn(
        "flex h-full min-h-0 w-72 shrink-0 flex-col overflow-hidden rounded-xl bg-muted/50 ring-1 ring-inset ring-foreground/5",
        isOver && "ring-2 ring-inset",
      )}
      style={
        isOver
          ? ({ "--tw-ring-color": lane.status.color } as React.CSSProperties)
          : undefined
      }
    >
      <div
        className="h-[3px] shrink-0 rounded-t-xl"
        style={{ backgroundColor: lane.status.color }}
        aria-hidden
      />
      <header className="relative flex shrink-0 items-center gap-2 px-3 py-2 after:absolute after:inset-x-2 after:bottom-0 after:border-b after:border-border">
        <span
          className="size-2 rounded-full"
          style={{ backgroundColor: lane.status.color }}
        />
        <h2 className="text-sm font-medium text-foreground">{lane.status.name}</h2>
        <Badge variant="secondary" className="ml-auto">
          {lane.tickets.length}
        </Badge>
      </header>
      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-2.5 pb-2 pt-2.5">
        {lane.tickets.map((ticket) => (
          <TicketCard
            key={ticket.id}
            ticket={ticket}
            onClick={() => onTicketClick(ticket.id)}
          />
        ))}
      </div>
    </section>
  );
}
