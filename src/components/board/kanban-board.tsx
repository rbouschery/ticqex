"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
import { useBoardFilter } from "@/hooks/use-board-filter";
import { useBoardRealtime } from "@/hooks/use-board-realtime";
import { BoardFilterBar } from "./board-filter-bar";
import { TicketCard } from "./ticket-card";
import { LaneColumn } from "./lane-column";
import { TicketModal } from "./ticket-modal";
import { CreateTicketModal } from "./create-ticket-modal";
import type { BoardLane, BoardTicket, TicketDetail } from "./types";

/** Debounce window + buffer — skip self-echo realtime refresh after local DnD. */
const REALTIME_MUTE_MS = 600;

export function KanbanBoard() {
  const { filter, setFilter, filterActive, boardQueryString } = useBoardFilter();
  const [lanes, setLanes] = useState<BoardLane[]>([]);
  const [allStatuses, setAllStatuses] = useState<{ id: string; name: string }[]>(
    [],
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [activeTicket, setActiveTicket] = useState<BoardTicket | null>(null);
  const [moveError, setMoveError] = useState<string | null>(null);
  const muteRealtimeUntil = useRef(0);
  const initialLoadDone = useRef(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  const loadBoard = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!options?.silent) {
        setLoading(true);
        setError(null);
      }
      try {
        const [data, statuses] = await Promise.all([
          apiFetch<{ lanes: BoardLane[] }>(`/api/v1/board${boardQueryString}`),
          apiFetch<{ id: string; name: string }[]>("/api/v1/statuses"),
        ]);
        setLanes(data.lanes);
        setAllStatuses(statuses);
      } catch (e) {
        if (!options?.silent) {
          setError(e instanceof Error ? e.message : "Failed to load board");
        }
      } finally {
        if (!options?.silent) {
          setLoading(false);
        }
      }
    },
    [boardQueryString],
  );

  const refreshBoard = useCallback(() => {
    void loadBoard({ silent: true });
  }, [loadBoard]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch on mount and filter changes
    void loadBoard({ silent: initialLoadDone.current });
    initialLoadDone.current = true;
  }, [loadBoard]);

  useBoardRealtime(refreshBoard, muteRealtimeUntil);

  const handleBoardChange = useCallback(
    (_updated?: TicketDetail) => {
      void loadBoard({ silent: true });
    },
    [loadBoard],
  );

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

    setMoveError(null);
    muteRealtimeUntil.current = Date.now() + REALTIME_MUTE_MS;

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
      setMoveError("Could not move ticket. Changes were reverted.");
      void loadBoard({ silent: true });
    }
  }

  const header = (
    <div className="flex shrink-0 items-start gap-3 px-4 pt-3">
      <BoardFilterBar filter={filter} onFilterChange={setFilter} />
      <Button size="sm" className="shrink-0" onClick={() => setShowCreate(true)}>
        <PlusIcon />
        New task
      </Button>
    </div>
  );

  if (loading) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex shrink-0 justify-end px-4 pt-3">
          <Skeleton className="h-8 w-24" />
        </div>
        <div className="min-h-0 flex-1 overflow-x-auto overflow-y-hidden">
          <div className="flex h-full w-max min-w-full justify-center gap-4 p-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-full w-72 shrink-0 rounded-xl" />
            ))}
          </div>
        </div>
        {selectedId && (
          <TicketModal
            ticketId={selectedId}
            onClose={() => setSelectedId(null)}
            onBoardChange={handleBoardChange}
          />
        )}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-1 p-8">
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {header}

      {moveError && (
        <Alert variant="destructive" className="mx-4 mt-2 shrink-0">
          <AlertDescription>{moveError}</AlertDescription>
        </Alert>
      )}

      <div className="flex min-h-0 flex-1 flex-col">
        <DndContext
          sensors={sensors}
          onDragStart={(e) => {
            const found = findTicket(String(e.active.id));
            if (found) setActiveTicket(found.ticket);
          }}
          onDragEnd={onDragEnd}
        >
          <div className="min-h-0 flex-1 overflow-x-auto overflow-y-hidden">
            <div className="flex h-full w-max min-w-full justify-center gap-4 p-4">
              {lanes.map((lane) => (
                <LaneColumn
                  key={lane.status.id}
                  lane={lane}
                  filterActive={filterActive}
                  onTicketClick={setSelectedId}
                />
              ))}
            </div>
          </div>
          <DragOverlay>
            {activeTicket ? (
              <div className="w-72">
                <TicketCard ticket={activeTicket} onClick={() => {}} dragOverlay />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>

      {selectedId && (
        <TicketModal
          ticketId={selectedId}
          onClose={() => setSelectedId(null)}
          onBoardChange={handleBoardChange}
        />
      )}

      {showCreate && (
        <CreateTicketModal
          statuses={allStatuses}
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            void loadBoard();
          }}
        />
      )}
    </div>
  );
}
