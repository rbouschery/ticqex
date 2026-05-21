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
        <p className="p-8 text-center text-zinc-500">Loading board…</p>
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
      <p className="p-8 text-center text-red-600" role="alert">
        {error}
      </p>
    );
  }

  return (
    <>
      <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          Support board
        </h1>
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500"
        >
          New ticket
        </button>
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
