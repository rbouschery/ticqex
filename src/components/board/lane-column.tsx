"use client";

import { useDroppable } from "@dnd-kit/core";
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
      className={`flex w-72 shrink-0 flex-col rounded-xl bg-zinc-100/80 dark:bg-zinc-900/50 ${
        isOver ? "ring-2 ring-indigo-400" : ""
      }`}
    >
      <header
        className="flex items-center gap-2 border-t-[3px] border-b border-zinc-200 px-3 py-2 dark:border-zinc-800"
        style={{ borderTopColor: lane.status.color }}
      >
        <span
          className="h-2 w-2 rounded-full"
          style={{ backgroundColor: lane.status.color }}
        />
        <h2 className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
          {lane.status.name}
        </h2>
        <span className="ml-auto text-xs text-zinc-500">{lane.tickets.length}</span>
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
