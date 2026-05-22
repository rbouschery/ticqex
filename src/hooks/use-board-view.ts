"use client";

import { useCallback, useMemo, useState } from "react";
import {
  normalizeTicketFilter,
  serializeTicketFilter,
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
};

function readStoredView(): BoardViewState {
  if (typeof window === "undefined") {
    return { filter: [], sort: DEFAULT_BOARD_SORT };
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as unknown;
      const obj = parsed as { filter?: unknown; sort?: unknown };
      return {
        filter: normalizeTicketFilter(
          ticketFilterSchema.parse(obj.filter ?? []),
        ),
        sort: normalizeBoardSort(
          boardSortSchema.parse(obj.sort ?? DEFAULT_BOARD_SORT),
        ),
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
      };
    }
  } catch {
    // ignore
  }

  return { filter: [], sort: DEFAULT_BOARD_SORT };
}

function writeStoredView(view: BoardViewState) {
  const hasFilter = view.filter.length > 0;
  const hasCustomSort =
    serializeBoardSort(view.sort) !== serializeBoardSort(DEFAULT_BOARD_SORT);

  if (!hasFilter && !hasCustomSort) {
    localStorage.removeItem(STORAGE_KEY);
    return;
  }

  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ filter: view.filter, sort: view.sort }),
  );
}

export function useBoardView() {
  const [view, setViewState] = useState<BoardViewState>(readStoredView);

  const setFilter = useCallback((filter: TicketFilter) => {
    setViewState((prev) => {
      const next = { ...prev, filter };
      writeStoredView(next);
      return next;
    });
  }, []);

  const setSort = useCallback((sort: BoardSort) => {
    setViewState((prev) => {
      const next = { ...prev, sort };
      writeStoredView(next);
      return next;
    });
  }, []);

  const boardQueryString = useMemo(() => {
    const params = new URLSearchParams();
    if (view.filter.length > 0) {
      params.set("filter", serializeTicketFilter(view.filter));
    }
    if (
      serializeBoardSort(view.sort) !== serializeBoardSort(DEFAULT_BOARD_SORT)
    ) {
      params.set("sort", serializeBoardSort(view.sort));
    }
    const qs = params.toString();
    return qs ? `?${qs}` : "";
  }, [view.filter, view.sort]);

  return {
    filter: view.filter,
    sort: view.sort,
    setFilter,
    setSort,
    boardQueryString,
    filterActive: view.filter.length > 0,
  };
}
