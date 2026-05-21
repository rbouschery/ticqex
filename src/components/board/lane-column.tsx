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
        "flex w-72 shrink-0 flex-col rounded-xl bg-muted/50 ring-1 ring-foreground/5",
        isOver && "ring-2 ring-ring",
      )}
    >
      <header
        className="flex items-center gap-2 border-b border-border px-3 py-2"
        style={{ borderTopWidth: 3, borderTopStyle: "solid", borderTopColor: lane.status.color }}
      >
        <span
          className="size-2 rounded-full"
          style={{ backgroundColor: lane.status.color }}
        />
        <h2 className="text-sm font-medium text-foreground">{lane.status.name}</h2>
        <Badge variant="secondary" className="ml-auto">
          {lane.tickets.length}
        </Badge>
      </header>
      <div className="flex flex-1 flex-col gap-2 p-2">
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
