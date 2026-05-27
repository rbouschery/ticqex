"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { DndContext, DragOverlay } from "@dnd-kit/core";
import { PlusIcon } from "@phosphor-icons/react";
import {
  statusChangeInsertIndex,
  statusChangeTargetIds,
  type BoardSort,
} from "@shared/board-sort";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api-client";
import { useBoardView } from "@/hooks/use-board-view";
import { useBoardQuery, type BoardResponse } from "@/hooks/use-board-query";
import { useBoardDrag } from "@/hooks/use-board-drag";
import { useBoardRealtime } from "@/hooks/use-board-realtime";
import { useBoardLaneLoadMore } from "@/hooks/use-board-lane-load-more";
import { applyTicketDrop } from "./board-dnd-utils";
import {
  buildFilterContext,
  moveTicketOnBoard,
  seedManualOrder,
  visibleIdsForLane,
} from "./board-lane-order-client";
import { BoardFilterBar } from "./board-filter-bar";
import { BoardSearchBar } from "./board-search-bar";
import { BoardSortSelect } from "./board-sort-select";
import { TicketCard } from "./ticket-card";
import { LaneColumn } from "./lane-column";
import { TicketModal } from "./ticket-modal";
import { CreateTicketModal } from "./create-ticket-modal";
import type { BoardLane, TicketDetail } from "./types";

const MANUAL_SORT: BoardSort = { mode: "manual" };

export function KanbanBoard() {
  const queryClient = useQueryClient();
  const {
    filter,
    sort,
    searchQuery,
    setFilter,
    setSort,
    setSearchQuery,
    searchActive,
    viewNarrowedActive,
  } = useBoardView();

  const [querySort, setQuerySort] = useState(sort);

  const boardQuery = useBoardQuery(filter, querySort, searchQuery);
  const lanes = boardQuery.data?.lanes ?? [];
  const capped = boardQuery.data?.capped ?? false;
  const subsetActive = viewNarrowedActive || capped;

  const { loadMore, loadingLaneIds } = useBoardLaneLoadMore({
    filter,
    sort: querySort,
    searchQuery,
    searchActive,
  });

  const [allStatuses, setAllStatuses] = useState<
    { id: string; name: string; color: string }[]
  >([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [moveError, setMoveError] = useState<string | null>(null);
  const statusesLoaded = useRef(false);

  const loading = boardQuery.isPending && !boardQuery.data;
  const error =
    boardQuery.error instanceof Error ? boardQuery.error.message : null;

  useEffect(() => {
    if (statusesLoaded.current) return;
    void apiFetch<{ id: string; name: string; color: string }[]>(
      "/api/v1/statuses",
    ).then(
      (statuses) => {
        setAllStatuses(statuses);
        statusesLoaded.current = true;
      },
    );
  }, []);

  const setLanes = useCallback(
    (updater: React.SetStateAction<BoardLane[]>) => {
      queryClient.setQueryData<BoardResponse>(
        boardQuery.queryKey,
        (current) => {
          if (!current) return current;
          const nextLanes =
            typeof updater === "function" ? updater(current.lanes) : updater;
          return { ...current, lanes: nextLanes };
        },
      );
    },
    [queryClient, boardQuery.queryKey],
  );

  const reloadBoard = useCallback(() => {
    void queryClient.refetchQueries({ queryKey: ["board"], type: "active" });
  }, [queryClient]);

  const moveTicketStatus = useCallback(
    async (ticketId: string, fromStatusId: string, toStatusId: string) => {
      if (fromStatusId === toStatusId) return;

      const startLanes = lanes;
      const toLane = startLanes.find((lane) => lane.status.id === toStatusId);
      const insertIndex = statusChangeInsertIndex(
        querySort,
        toLane?.tickets.length ?? 0,
      );
      const touchedAt = new Date().toISOString();
      let optimistic = applyTicketDrop(
        startLanes,
        ticketId,
        fromStatusId,
        toStatusId,
        insertIndex,
      );

      if (optimistic) {
        optimistic = optimistic.map((lane) => ({
          ...lane,
          tickets: lane.tickets.map((ticket) =>
            ticket.id === ticketId
              ? { ...ticket, updated_at: touchedAt }
              : ticket,
          ),
        }));
        setLanes(optimistic);
      }

      const finalLanes = optimistic ?? startLanes;
      const crossLane = fromStatusId !== toStatusId;
      const targetIds = statusChangeTargetIds(
        querySort,
        ticketId,
        visibleIdsForLane(finalLanes, toStatusId),
      );

      await moveTicketOnBoard({
        ticket_id: ticketId,
        from_status_id: fromStatusId,
        to_status_id: toStatusId,
        target_ticket_ids: targetIds,
        ...(crossLane
          ? {
              source_ticket_ids: visibleIdsForLane(
                finalLanes,
                fromStatusId,
              ).filter((id) => id !== ticketId),
              filter_context: buildFilterContext({
                subsetActive,
                startLanes,
                fromLaneId: fromStatusId,
                toLaneId: toStatusId,
                ticketId,
                crossLane,
              }),
            }
          : {}),
      });
    },
    [lanes, querySort, setLanes, subsetActive],
  );

  const patchTicketUnread = useCallback(
    (ticketId: string, unreadCount: number) => {
      queryClient.setQueriesData<BoardResponse>(
        { queryKey: ["board"] },
        (current) => {
          if (!current) return current;
          return {
            ...current,
            lanes: current.lanes.map((lane) => ({
              ...lane,
              tickets: lane.tickets.map((ticket) =>
                ticket.id === ticketId
                  ? { ...ticket, unread_count: unreadCount }
                  : ticket,
              ),
            })),
          };
        },
      );
    },
    [queryClient],
  );

  const handleBoardChange = useCallback(
    (updated?: TicketDetail) => {
      if (updated && updated.unread_count === 0) {
        patchTicketUnread(updated.id, 0);
        return;
      }
      reloadBoard();
    },
    [patchTicketUnread, reloadBoard],
  );

  const handleSortChange = useCallback(
    async (next: BoardSort) => {
      if (next.mode === "manual" && sort.mode !== "manual") {
        try {
          await seedManualOrder(lanes, {
            onlyIfEmpty: true,
            mergeVisible: subsetActive,
          });
        } catch (e) {
          setMoveError(
            e instanceof Error ? e.message : "Could not save custom order",
          );
          return;
        }
      }
      setSort(next);
      setQuerySort(next);
    },
    [lanes, setSort, sort.mode, subsetActive],
  );

  const onDragCommitManual = useCallback(() => {
    setSort(MANUAL_SORT);
    setQuerySort(MANUAL_SORT);
  }, [setSort]);

  const {
    sensors,
    collisionDetection,
    activeTicket,
    dropPreview,
    dragSessionRef,
    onDragStart,
    onDragOver,
    onDragEnd,
    onDragCancel,
  } = useBoardDrag({
    lanes,
    setLanes,
    subsetActive,
    sortMode: sort.mode,
    onDragCommitManual,
    onMoveError: setMoveError,
    reloadBoard,
  });

  useBoardRealtime(reloadBoard, dragSessionRef);

  const hasSearchResults = lanes.some((lane) => lane.tickets.length > 0);

  const header = (
    <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 px-4 pt-3">
      <BoardFilterBar filter={filter} onFilterChange={setFilter} />
      <div className="flex min-w-[min(100%,18rem)] flex-1 items-center justify-end gap-2 max-sm:w-full sm:gap-3">
        <BoardSearchBar
          value={searchQuery}
          onChange={setSearchQuery}
          className="w-full sm:max-w-xs lg:w-72"
        />
        <div className="flex shrink-0 items-center gap-2">
          <span className="hidden shrink-0 text-sm text-muted-foreground sm:inline">
            Sort:
          </span>
          <BoardSortSelect
            sort={sort}
            onSortChange={(next) => void handleSortChange(next)}
          />
          <Button
            size="sm"
            className="shrink-0"
            onClick={() => setShowCreate(true)}
            aria-label="New ticket"
          >
            <PlusIcon />
            <span className="hidden sm:inline">New Ticket</span>
          </Button>
        </div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 px-4 pt-3">
          <Skeleton className="h-8 w-24" />
          <div className="flex flex-1 items-center justify-end gap-2 max-sm:w-full">
            <Skeleton className="h-8 w-full sm:max-w-xs lg:w-72" />
            <Skeleton className="h-8 w-56" />
          </div>
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
            statuses={allStatuses}
            onStatusChange={moveTicketStatus}
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

      {searchActive && !boardQuery.isFetching && !hasSearchResults ? (
        <p className="px-4 pt-2 text-sm text-muted-foreground">
          No tickets match &ldquo;{searchQuery.trim()}&rdquo;.
        </p>
      ) : null}

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
          onDragCancel={onDragCancel}
        >
          <div className="min-h-0 flex-1 overflow-x-auto overflow-y-hidden">
            <div className="flex h-full w-max min-w-full justify-center gap-4 p-4">
              {lanes.map((lane) => (
                <LaneColumn
                  key={lane.status.id}
                  lane={lane}
                  sortable
                  onTicketClick={setSelectedId}
                  hasMore={searchActive ? false : (lane.has_more ?? false)}
                  loadingMore={loadingLaneIds.has(lane.status.id)}
                  onLoadMore={() => void loadMore(lane)}
                  dropPreviewIndex={
                    dropPreview?.laneId === lane.status.id
                      ? dropPreview.index
                      : null
                  }
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
          statuses={allStatuses}
          onStatusChange={moveTicketStatus}
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
            reloadBoard();
          }}
        />
      )}
    </div>
  );
}
