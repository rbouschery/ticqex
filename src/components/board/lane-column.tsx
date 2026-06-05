"use client";

import { useEffect, useRef } from "react";
import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { TicketCard } from "./ticket-card";
import type { BoardLane, BoardTicket } from "./types";
import type { ResolvedTicketFieldLayout } from "@shared/ticket-fields";

function DropPlaceholder() {
  return (
    <div
      aria-hidden
      className="min-h-24 rounded-xl border-2 border-dashed border-primary/35 bg-primary/5"
    />
  );
}

export function LaneColumn({
  lane,
  sortable = false,
  fieldLayout,
  onTicketClick,
  onTicketDeleted,
  hasMore = false,
  loadingMore = false,
  onLoadMore,
  dropPreviewIndex = null,
}: {
  lane: BoardLane;
  sortable?: boolean;
  fieldLayout?: ResolvedTicketFieldLayout | null;
  onTicketClick: (ticket: BoardTicket) => void;
  onTicketDeleted?: (ticketId: string) => void;
  hasMore?: boolean;
  loadingMore?: boolean;
  onLoadMore?: () => void;
  dropPreviewIndex?: number | null;
}) {
  const { setNodeRef } = useDroppable({ id: lane.status.id });
  const scrollRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const totalCount = lane.total_count;
  const showFraction =
    totalCount !== undefined && totalCount > lane.tickets.length;
  const previewIndex =
    dropPreviewIndex !== null &&
    dropPreviewIndex >= 0 &&
    dropPreviewIndex <= lane.tickets.length
      ? dropPreviewIndex
      : null;

  const ticketList = (
    <div className="flex flex-col gap-2">
      {lane.tickets.map((ticket, index) => (
        <div key={ticket.id} className="flex flex-col gap-2">
          {previewIndex === index ? <DropPlaceholder /> : null}
          <TicketCard
            ticket={ticket}
            statusId={lane.status.id}
            sortable={sortable}
            fieldLayout={fieldLayout}
            onClick={() => onTicketClick(ticket)}
            onDeleted={onTicketDeleted}
          />
        </div>
      ))}
      {previewIndex === lane.tickets.length ? <DropPlaceholder /> : null}
    </div>
  );

  useEffect(() => {
    if (!hasMore || !onLoadMore) return;

    const root = scrollRef.current;
    const sentinel = sentinelRef.current;
    if (!root || !sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (
          loadingMore ||
          !entries.some((entry) => entry.isIntersecting)
        ) {
          return;
        }
        onLoadMore();
      },
      { root, rootMargin: "120px" },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loadingMore, lane.tickets.length, onLoadMore]);

  return (
    <section className="flex h-full min-h-0 w-72 shrink-0 flex-col overflow-hidden rounded-xl bg-muted/50 ring-1 ring-inset ring-foreground/5">
      <header className="relative flex shrink-0 items-center gap-2 px-3 py-2 after:absolute after:inset-x-2 after:bottom-0 after:border-b after:border-border">
        <span
          className="size-2 rounded-full"
          style={{ backgroundColor: lane.status.color }}
        />
        <h2 className="text-sm font-medium text-foreground">{lane.status.name}</h2>
        <Badge variant="secondary" className="ml-auto">
          {showFraction
            ? `${lane.tickets.length} / ${totalCount}`
            : lane.tickets.length}
        </Badge>
      </header>
      <div
        ref={(node) => {
          setNodeRef(node);
          scrollRef.current = node;
        }}
        className="flex min-h-0 flex-1 flex-col overflow-y-auto px-2.5 pb-2 pt-2.5"
      >
        {sortable ? (
          <SortableContext
            items={lane.tickets.map((ticket) => ticket.id)}
            strategy={verticalListSortingStrategy}
          >
            {ticketList}
          </SortableContext>
        ) : (
          ticketList
        )}
        {hasMore ? (
          <div ref={sentinelRef} className="pt-2">
            {loadingMore ? (
              <div className="flex flex-col gap-2">
                <Skeleton className="h-24 w-full rounded-lg" />
                <Skeleton className="h-24 w-full rounded-lg" />
              </div>
            ) : (
              <p className="py-1 text-center text-xs text-muted-foreground">
                Scroll for more
              </p>
            )}
          </div>
        ) : null}
      </div>
    </section>
  );
}
