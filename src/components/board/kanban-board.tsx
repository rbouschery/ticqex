"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { DndContext, DragOverlay } from "@dnd-kit/core";
import { PlusIcon } from "@phosphor-icons/react";
import type { BoardSort } from "@shared/board-sort";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api-client";
import { useBoardView } from "@/hooks/use-board-view";
import { useBoardDrag } from "@/hooks/use-board-drag";
import { useBoardRealtime } from "@/hooks/use-board-realtime";
import { seedManualOrder } from "./board-lane-order-client";
import { BoardFilterBar } from "./board-filter-bar";
import { BoardSortSelect } from "./board-sort-select";
import { TicketCard } from "./ticket-card";
import { LaneColumn } from "./lane-column";
import { TicketModal } from "./ticket-modal";
import { CreateTicketModal } from "./create-ticket-modal";
import type { BoardLane } from "./types";

export function KanbanBoard() {
  const {
    filter,
    sort,
    setFilter,
    setSort,
    filterActive,
    boardQueryString,
  } = useBoardView();
  const [lanes, setLanes] = useState<BoardLane[]>([]);
  const [allStatuses, setAllStatuses] = useState<{ id: string; name: string }[]>(
    [],
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [moveError, setMoveError] = useState<string | null>(null);
  const muteRealtimeUntil = useRef(0);
  const initialLoadDone = useRef(false);
  const suppressNextBoardLoad = useRef(false);

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

  const reloadBoard = useCallback(() => {
    void loadBoard({ silent: true });
  }, [loadBoard]);

  useEffect(() => {
    if (suppressNextBoardLoad.current) {
      suppressNextBoardLoad.current = false;
      return;
    }
    void loadBoard({ silent: initialLoadDone.current });
    initialLoadDone.current = true;
  }, [loadBoard]);

  useBoardRealtime(reloadBoard, muteRealtimeUntil);

  const handleBoardChange = useCallback(() => {
    reloadBoard();
  }, [reloadBoard]);

  const handleSortChange = useCallback(
    async (next: BoardSort) => {
      if (next.mode === "manual" && sort.mode !== "manual") {
        try {
          await seedManualOrder(lanes, {
            onlyIfEmpty: true,
            mergeVisible: filterActive,
          });
        } catch (e) {
          setMoveError(
            e instanceof Error ? e.message : "Could not save custom order",
          );
          return;
        }
      }
      setSort(next);
    },
    [filterActive, lanes, setSort, sort.mode],
  );

  const {
    sensors,
    collisionDetection,
    activeTicket,
    onDragStart,
    onDragOver,
    onDragEnd,
  } = useBoardDrag({
    lanes,
    setLanes,
    filterActive,
    sortMode: sort.mode,
    setSort,
    onMoveError: setMoveError,
    muteRealtimeUntilRef: muteRealtimeUntil,
    suppressNextBoardLoadRef: suppressNextBoardLoad,
    reloadBoard,
  });

  const header = (
    <div className="flex shrink-0 items-start gap-3 px-4 pt-3">
      <BoardFilterBar filter={filter} onFilterChange={setFilter} />
      <div className="flex shrink-0 items-center gap-2">
        <span className="text-sm text-muted-foreground">Sort:</span>
        <BoardSortSelect
          sort={sort}
          onSortChange={(next) => void handleSortChange(next)}
        />
      </div>
      <Button size="sm" className="shrink-0" onClick={() => setShowCreate(true)}>
        <PlusIcon />
        New task
      </Button>
    </div>
  );

  if (loading) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex shrink-0 justify-end gap-2 px-4 pt-3">
          <Skeleton className="h-8 w-48" />
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
          collisionDetection={collisionDetection}
          onDragStart={onDragStart}
          onDragOver={onDragOver}
          onDragEnd={(event) => void onDragEnd(event)}
        >
          <div className="min-h-0 flex-1 overflow-x-auto overflow-y-hidden">
            <div className="flex h-full w-max min-w-full justify-center gap-4 p-4">
              {lanes.map((lane) => (
                <LaneColumn
                  key={lane.status.id}
                  lane={lane}
                  filterActive={filterActive}
                  sortable
                  onTicketClick={setSelectedId}
                />
              ))}
            </div>
          </div>
          <DragOverlay dropAnimation={null}>
            {activeTicket ? (
              <div className="w-72 cursor-grabbing">
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
