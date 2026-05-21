"use client";

import { useCallback, useEffect, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { PlusIcon } from "@phosphor-icons/react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api-client";
import { TicketCard } from "./ticket-card";
import { LaneColumn } from "./lane-column";
import { TicketModal } from "./ticket-modal";
import { CreateTicketModal } from "./create-ticket-modal";
import type { BoardLane, BoardTicket } from "./types";

export function KanbanBoard() {
  const [lanes, setLanes] = useState<BoardLane[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [activeTicket, setActiveTicket] = useState<BoardTicket | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  const loadBoard = useCallback(async (options?: { silent?: boolean }) => {
    if (!options?.silent) {
      setLoading(true);
      setError(null);
    }
    try {
      const data = await apiFetch<{ lanes: BoardLane[] }>("/api/v1/board");
      setLanes(data.lanes);
    } catch (e) {
      if (!options?.silent) {
        setError(e instanceof Error ? e.message : "Failed to load board");
      }
    } finally {
      if (!options?.silent) {
        setLoading(false);
      }
    }
  }, []);

  const refreshBoard = useCallback(() => {
    void loadBoard({ silent: true });
  }, [loadBoard]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch on mount
    void loadBoard();
  }, [loadBoard]);

  function findTicket(id: string) {
    for (const lane of lanes) {
      const t = lane.tickets.find((x) => x.id === id);
      if (t) return { ticket: t, statusId: lane.status.id };
    }
    return null;
  }

  async function onDragEnd(event: DragEndEvent) {
    setActiveTicket(null);
    const { active, over } = event;
    if (!over) return;

    const ticketId = String(active.id);
    const newStatusId = String(over.id);
    const found = findTicket(ticketId);
    if (!found || found.statusId === newStatusId) return;

    setLanes((prev) =>
      prev.map((l) => {
        if (l.status.id === found.statusId) {
          return {
            ...l,
            tickets: l.tickets.filter((t) => t.id !== ticketId),
          };
        }
        if (l.status.id === newStatusId) {
          return { ...l, tickets: [found.ticket, ...l.tickets] };
        }
        return l;
      }),
    );

    try {
      await apiFetch(`/api/v1/tickets/${ticketId}`, {
        method: "PATCH",
        body: JSON.stringify({ status_id: newStatusId }),
      });
    } catch {
      void loadBoard();
    }
  }

  if (loading) {
    return (
      <>
        <div className="space-y-4 p-8">
          <Skeleton className="h-8 w-48" />
          <div className="flex gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-96 w-72 shrink-0 rounded-xl" />
            ))}
          </div>
        </div>
        {selectedId && (
          <TicketModal
            ticketId={selectedId}
            onClose={() => setSelectedId(null)}
            onBoardChange={refreshBoard}
          />
        )}
      </>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h1 className="font-heading text-lg font-semibold text-foreground">
          Support board
        </h1>
        <Button size="sm" onClick={() => setShowCreate(true)}>
          <PlusIcon />
          New task
        </Button>
      </div>

      <DndContext
        sensors={sensors}
        onDragStart={(e) => {
          const found = findTicket(String(e.active.id));
          if (found) setActiveTicket(found.ticket);
        }}
        onDragEnd={onDragEnd}
      >
        <div className="flex gap-4 overflow-x-auto p-4">
          {lanes.map((lane) => (
            <LaneColumn
              key={lane.status.id}
              lane={lane}
              onTicketClick={setSelectedId}
            />
          ))}
        </div>
        <DragOverlay>
          {activeTicket ? (
            <div className="w-72">
              <TicketCard ticket={activeTicket} onClick={() => {}} dragOverlay />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {selectedId && (
        <TicketModal
          ticketId={selectedId}
          onClose={() => setSelectedId(null)}
          onBoardChange={refreshBoard}
        />
      )}

      {showCreate && (
        <CreateTicketModal
          statuses={lanes.map((l) => l.status)}
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            void loadBoard();
          }}
        />
      )}
    </>
  );
}
