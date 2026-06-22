"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";
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
import {
  DEFAULT_BOARD_LANE_COUNT,
  readLastBoardLaneCount,
  writeLastBoardLaneCount,
} from "@/lib/board-last-lane-count";
import { useBoardView } from "@/hooks/use-board-view";
import { useBoardQuery, type BoardResponse } from "@/hooks/use-board-query";
import { useBoardDrag } from "@/hooks/use-board-drag";
import { useBoardRealtime } from "@/hooks/use-board-realtime";
import { useBoardLaneLoadMore } from "@/hooks/use-board-lane-load-more";
import { prefetchTicketReferenceData } from "@/hooks/use-ticket-reference-data";
import { useStatuses } from "@/hooks/use-statuses";
import {
  ticketSummaryQueryKey,
} from "@/hooks/use-ticket-summary";
import { ticketMessagesQueryKey } from "@/hooks/use-ticket-messages";
import { applyTicketDrop } from "./board-dnd-utils";
import {
  buildFilterContext,
  moveTicketOnBoard,
  seedManualOrder,
  visibleIdsForLane,
} from "./board-lane-order-client";
import { BoardFilterBar } from "./board-filter-bar";
import { BoardFilterSheet } from "./board-filter-sheet";
import { BoardSearchBar } from "./board-search-bar";
import { BoardSortSelect } from "./board-sort-select";
import { BoardSortSheet } from "./board-sort-sheet";
import { TicketCard } from "./ticket-card";
import { LaneColumn } from "./lane-column";
import { CreateTicketModal } from "./create-ticket-modal";
import { BoardTicketModalProvider } from "./board-ticket-modal-context";
import {
  buildOptimisticBoardTicket,
  insertNewTicketIntoLane,
  removeTicketFromLanes,
  replaceTicketInLanes,
  shouldOptimisticallyShowTicket,
  ticketDetailToBoardTicket,
  type CreateTicketPayload,
} from "./board-create-client";
import {
  boardTicketToModalSeed,
  findBoardTicketWithStatus,
} from "./board-ticket-seed";
import { boardTicketPath } from "./board-ticket-route";
import type { BoardLane, BoardTicket, TicketDetail } from "./types";

const MANUAL_SORT: BoardSort = { mode: "manual" };
const REALTIME_MUTE_MS = 600;
const EMPTY_LANES: BoardLane[] = [];

export function KanbanBoard({ children }: { children?: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
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

  const skeletonLaneCount = useSyncExternalStore(
    () => () => {},
    () => readLastBoardLaneCount(),
    () => DEFAULT_BOARD_LANE_COUNT,
  );

  const boardQuery = useBoardQuery(filter, sort, searchQuery);
  const lanes = boardQuery.data?.lanes ?? EMPTY_LANES;
  const ticketFieldLayout = boardQuery.data?.ticket_field_layout ?? null;
  const capped = boardQuery.data?.capped ?? false;
  const subsetActive = viewNarrowedActive || capped;

  const { loadMore, loadingLaneIds } = useBoardLaneLoadMore({
    filter,
    sort,
    searchQuery,
    searchActive,
  });

  const statusesQuery = useStatuses();
  const allStatuses = useMemo(
    () => statusesQuery.data ?? [],
    [statusesQuery.data],
  );
  const [showCreate, setShowCreate] = useState(false);
  const [moveError, setMoveError] = useState<string | null>(null);

  const openTicket = useCallback(
    (ticket: BoardTicket) => {
      if (ticket.is_pending) return;

      const ticketId = ticket.id;
      void queryClient.prefetchQuery({
        queryKey: ticketSummaryQueryKey(ticketId),
        queryFn: () =>
          apiFetch(`/api/v1/tickets/${ticketId}/summary`),
      });
      if (ticket.kind === "conversation") {
        void queryClient.prefetchQuery({
          queryKey: ticketMessagesQueryKey(ticketId),
          queryFn: () => apiFetch(`/api/v1/tickets/${ticketId}/messages`),
        });
      }
      router.push(boardTicketPath(ticketId));
    },
    [queryClient, router],
  );

  const getInitialSeed = useCallback(
    (ticketId: string) => {
      const match = findBoardTicketWithStatus(lanes, ticketId);
      if (!match) return undefined;
      return boardTicketToModalSeed(match.ticket, match.status);
    },
    [lanes],
  );

  const loading = boardQuery.isPending && !boardQuery.data;
  const error =
    boardQuery.error instanceof Error ? boardQuery.error.message : null;

  useEffect(() => {
    if (lanes.length > 0) writeLastBoardLaneCount(lanes.length);
  }, [lanes.length]);

  useEffect(() => {
    if (boardQuery.isSuccess) {
      prefetchTicketReferenceData(queryClient);
    }
  }, [boardQuery.isSuccess, queryClient]);

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
        sort,
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
        sort,
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
    [lanes, sort, setLanes, subsetActive],
  );

  const patchTicketUnread = useCallback(
    (ticketId: string, unreadCount: number) => {
      queryClient.setQueryData<BoardResponse>(
        boardQuery.queryKey,
        (current) => {
          if (!current?.lanes) return current;
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
    [queryClient, boardQuery.queryKey],
  );

  const handleBoardChange = useCallback(
    (updated?: { id: string; unread_count?: number }) => {
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
    },
    [lanes, setSort, sort.mode, subsetActive],
  );

  const onDragCommitManual = useCallback(() => {
    setSort(MANUAL_SORT);
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

  const handleCreateTicket = useCallback(
    (payload: CreateTicketPayload) => {
      setShowCreate(false);
      setMoveError(null);

      const tempId = crypto.randomUUID();
      const now = new Date().toISOString();
      const optimistic = buildOptimisticBoardTicket(payload, tempId, now);
      const showOptimistic = shouldOptimisticallyShowTicket({
        ticket: optimistic,
        filter,
        searchQuery,
        searchActive,
        capped,
      });

      if (showOptimistic) {
        dragSessionRef.current.mutedUntil = Date.now() + REALTIME_MUTE_MS;
        setLanes((current) =>
          insertNewTicketIntoLane(current, payload.statusId, optimistic, sort),
        );
      }

      const tagNames = payload.tags
        .map((tag) => tag.name.trim())
        .filter(Boolean);

      void (async () => {
        try {
          const created = await apiFetch<TicketDetail>("/api/v1/tickets", {
            method: "POST",
            body: JSON.stringify({
              kind: "task",
              title: payload.title,
              ...(payload.body ? { body: payload.body } : {}),
              ...(payload.contactUsername
                ? { contact: { username: payload.contactUsername } }
                : {}),
              ...(payload.statusId ? { status_id: payload.statusId } : {}),
              ...(tagNames.length ? { tags: tagNames } : {}),
              origin: "manual",
            }),
          });

          dragSessionRef.current.mutedUntil = Date.now() + REALTIME_MUTE_MS;

          if (showOptimistic) {
            setLanes((current) =>
              replaceTicketInLanes(
                current,
                tempId,
                ticketDetailToBoardTicket(created),
              ),
            );
          }

          void queryClient.refetchQueries({
            queryKey: ["board"],
            type: "active",
          });
        } catch (err) {
          if (showOptimistic) {
            setLanes((current) => removeTicketFromLanes(current, tempId));
          }
          setMoveError(err instanceof Error ? err.message : "Create failed");
        }
      })();
    },
    [
      capped,
      dragSessionRef,
      filter,
      queryClient,
      sort,
      searchActive,
      searchQuery,
      setLanes,
    ],
  );

  const hasSearchResults = lanes.some((lane) => lane.tickets.length > 0);
  const handleTicketDeleted = useCallback(
    (ticketId: string) => {
      dragSessionRef.current.mutedUntil = Date.now() + REALTIME_MUTE_MS;
      setLanes((current) => removeTicketFromLanes(current, ticketId));
      void queryClient.removeQueries({
        queryKey: ticketSummaryQueryKey(ticketId),
      });
      void queryClient.removeQueries({
        queryKey: ticketMessagesQueryKey(ticketId),
      });
      if (pathname === boardTicketPath(ticketId)) {
        router.push("/board");
      }

      void (async () => {
        try {
          await apiFetch(`/api/v1/tickets/${ticketId}`, { method: "DELETE" });
          void queryClient.refetchQueries({
            queryKey: ["board"],
            type: "active",
          });
        } catch (err) {
          reloadBoard();
          setMoveError(err instanceof Error ? err.message : "Delete failed");
        }
      })();
    },
    [dragSessionRef, pathname, queryClient, reloadBoard, router, setLanes],
  );

  const modalContext = useMemo(
    () => ({
      statuses: allStatuses,
      ticketFieldLayout,
      getInitialSeed,
      onStatusChange: moveTicketStatus,
      onBoardChange: handleBoardChange,
      onTicketDeleted: handleTicketDeleted,
    }),
    [
      allStatuses,
      ticketFieldLayout,
      getInitialSeed,
      handleBoardChange,
      handleTicketDeleted,
      moveTicketStatus,
    ],
  );

  const header = (
    <>
      <div className="mx-auto hidden w-full max-w-[1600px] shrink-0 items-center gap-3 px-4 pt-3 sm:flex">
        <BoardSearchBar
          value={searchQuery}
          onChange={setSearchQuery}
          className="w-full shrink-0 sm:max-w-xs lg:w-72"
        />
        <BoardFilterBar
          filter={filter}
          onFilterChange={setFilter}
          className="min-w-0 flex-1"
        />
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

      <div className="flex w-full shrink-0 items-center gap-2 px-4 pt-3 sm:hidden">
        <BoardSearchBar value={searchQuery} onChange={setSearchQuery} />
        <BoardFilterSheet filter={filter} onFilterChange={setFilter} />
        <BoardSortSheet
          sort={sort}
          onSortChange={(next) => void handleSortChange(next)}
        />
      </div>
    </>
  );

  const createFab = (
    <Button
      size="icon-lg"
      className="fixed right-4 bottom-4 z-30 size-12 rounded-full shadow-lg sm:hidden"
      onClick={() => setShowCreate(true)}
      aria-label="New ticket"
    >
      <PlusIcon className="size-5" />
    </Button>
  );

  if (loading) {
    return (
      <BoardTicketModalProvider value={modalContext}>
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="mx-auto hidden w-full max-w-[1600px] shrink-0 items-center gap-3 px-4 pt-3 sm:flex">
            <Skeleton className="h-8 w-full shrink-0 sm:max-w-xs lg:w-72" />
            <Skeleton className="h-8 flex-1" />
            <Skeleton className="h-8 w-28 shrink-0" />
            <Skeleton className="h-8 w-28 shrink-0" />
          </div>
          <div className="flex w-full shrink-0 items-center gap-2 px-4 pt-3 sm:hidden">
            <Skeleton className="h-8 flex-1" />
            <Skeleton className="size-8 shrink-0" />
            <Skeleton className="size-8 shrink-0" />
          </div>
          <div className="min-h-0 flex-1 overflow-x-auto overflow-y-hidden">
            <div className="flex h-full w-max min-w-full justify-center gap-4 p-4">
              {Array.from({ length: skeletonLaneCount }).map((_, i) => (
                <Skeleton key={i} className="h-full w-72 shrink-0 rounded-xl" />
              ))}
            </div>
          </div>
          {children}
        </div>
      </BoardTicketModalProvider>
    );
  }

  if (error) {
    return (
      <BoardTicketModalProvider value={modalContext}>
        <div className="flex flex-1 p-8">
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </div>
        {children}
      </BoardTicketModalProvider>
    );
  }

  return (
    <BoardTicketModalProvider value={modalContext}>
      <div className="flex min-h-0 flex-1 flex-col">
        {header}
        {createFab}

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
                  fieldLayout={ticketFieldLayout}
                  onTicketClick={openTicket}
                  onTicketDeleted={handleTicketDeleted}
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
                <TicketCard
                  ticket={activeTicket}
                  onClick={() => {}}
                  dragOverlay
                  fieldLayout={ticketFieldLayout}
                />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>

        {children}

        {showCreate && (
          <CreateTicketModal
            statuses={allStatuses}
            onClose={() => setShowCreate(false)}
            onCreate={handleCreateTicket}
          />
        )}
      </div>
    </BoardTicketModalProvider>
  );
}
