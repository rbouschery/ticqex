"use client";

import { useCallback, useSyncExternalStore } from "react";
import {
  normalizeTicketFilter,
  ticketFilterSchema,
  type TicketFilter,
} from "@shared/ticket-filter";
import {
  DEFAULT_BOARD_SORT,
  normalizeBoardSort,
  boardSortSchema,
  serializeBoardSort,
  type BoardSort,
} from "@shared/board-sort";

const LEGACY_FILTER_KEY = "ticqex.board.filter.v2";
const STORAGE_KEY = "ticqex.board.view.v1";

type BoardViewState = {
  filter: TicketFilter;
  sort: BoardSort;
  searchQuery: string;
};

const DEFAULT_BOARD_VIEW: BoardViewState = {
  filter: [],
  sort: DEFAULT_BOARD_SORT,
  searchQuery: "",
};

function readStoredView(): BoardViewState {
  if (typeof window === "undefined") {
    return { filter: [], sort: DEFAULT_BOARD_SORT, searchQuery: "" };
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as unknown;
      const obj = parsed as {
        filter?: unknown;
        sort?: unknown;
        searchQuery?: unknown;
      };
      return {
        filter: normalizeTicketFilter(
          ticketFilterSchema.parse(obj.filter ?? []),
        ),
        sort: normalizeBoardSort(
          boardSortSchema.parse(obj.sort ?? DEFAULT_BOARD_SORT),
        ),
        searchQuery:
          typeof obj.searchQuery === "string" ? obj.searchQuery : "",
      };
    }
  } catch {
    // fall through to legacy migration
  }

  try {
    const legacy = localStorage.getItem(LEGACY_FILTER_KEY);
    if (legacy) {
      return {
        filter: normalizeTicketFilter(
          ticketFilterSchema.parse(JSON.parse(legacy)),
        ),
        sort: DEFAULT_BOARD_SORT,
        searchQuery: "",
      };
    }
  } catch {
    // ignore
  }

  return { filter: [], sort: DEFAULT_BOARD_SORT, searchQuery: "" };
}

function writeStoredView(view: BoardViewState) {
  const hasFilter = view.filter.length > 0;
  const hasCustomSort =
    serializeBoardSort(view.sort) !== serializeBoardSort(DEFAULT_BOARD_SORT);
  const hasSearch = view.searchQuery.trim().length > 0;

  if (!hasFilter && !hasCustomSort && !hasSearch) {
    localStorage.removeItem(STORAGE_KEY);
    return;
  }

  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      filter: view.filter,
      sort: view.sort,
      searchQuery: view.searchQuery,
    }),
  );
}

const boardViewListeners = new Set<() => void>();

function subscribeBoardView(listener: () => void) {
  boardViewListeners.add(listener);
  if (typeof window === "undefined") {
    return () => boardViewListeners.delete(listener);
  }

  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY || event.key === LEGACY_FILTER_KEY) {
      listener();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    boardViewListeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

function emitBoardViewChange() {
  for (const listener of boardViewListeners) listener();
}

export function useBoardView() {
  const view = useSyncExternalStore(
    subscribeBoardView,
    readStoredView,
    () => DEFAULT_BOARD_VIEW,
  );

  const setFilter = useCallback((filter: TicketFilter) => {
    const next = { ...readStoredView(), filter };
    writeStoredView(next);
    emitBoardViewChange();
  }, []);

  const setSort = useCallback((sort: BoardSort) => {
    const next = { ...readStoredView(), sort };
    writeStoredView(next);
    emitBoardViewChange();
  }, []);

  const setSearchQuery = useCallback((searchQuery: string) => {
    const next = { ...readStoredView(), searchQuery };
    writeStoredView(next);
    emitBoardViewChange();
  }, []);

  const searchActive = view.searchQuery.trim().length > 0;
  const filterActive = view.filter.length > 0;
  const viewNarrowedActive = filterActive || searchActive;

  return {
    filter: view.filter,
    sort: view.sort,
    searchQuery: view.searchQuery,
    setFilter,
    setSort,
    setSearchQuery,
    filterActive,
    searchActive,
    viewNarrowedActive,
  };
}
