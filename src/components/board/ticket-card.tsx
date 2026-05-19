"use client";

import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
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
    <article
      ref={dragOverlay ? undefined : setNodeRef}
      style={style}
      {...(dragOverlay ? {} : { ...attributes, ...listeners })}
      onClick={onClick}
      className="cursor-pointer rounded-lg border border-zinc-200 bg-white p-3 shadow-sm hover:border-indigo-300 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-indigo-600"
    >
      <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
        {ticket.title}
      </h3>
      {ticket.preview && (
        <p className="mt-1 line-clamp-2 text-xs text-zinc-500">{ticket.preview}</p>
      )}
      {customEntries.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {customEntries.map(([key, value]) => (
            <span
              key={key}
              className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
            >
              {key}: {String(value)}
            </span>
          ))}
        </div>
      )}
      <div className="mt-2 flex items-center justify-between">
        <div className="flex -space-x-1">
          {ticket.customer && (
            <span
              title={ticket.customer.username}
              className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-[10px] font-medium text-blue-800"
            >
              {ticket.customer.initials}
            </span>
          )}
          {ticket.assignee && (
            <span
              title={ticket.assignee.username}
              className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-amber-100 text-[10px] font-medium text-amber-800"
            >
              {ticket.assignee.initials}
            </span>
          )}
        </div>
        <div className="flex gap-1">
          {ticket.tags.slice(0, 2).map((tag) => (
            <span
              key={tag.id}
              className="rounded px-1 text-[10px] text-white"
              style={{ backgroundColor: tag.color }}
            >
              {tag.name}
            </span>
          ))}
        </div>
      </div>
    </article>
  );
}
