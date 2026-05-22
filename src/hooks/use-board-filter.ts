"use client";

import { useCallback, useMemo, useState } from "react";
import {
  normalizeTicketFilter,
  serializeTicketFilter,
  ticketFilterSchema,
  type TicketFilter,
} from "@shared/ticket-filter";

const STORAGE_KEY = "ticqex.board.filter.v2";

function readStoredFilter(): TicketFilter {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return normalizeTicketFilter(ticketFilterSchema.parse(JSON.parse(raw)));
  } catch {
    return [];
  }
}

export function useBoardFilter() {
  const [filter, setFilterState] = useState<TicketFilter>(readStoredFilter);

  const setFilter = useCallback((next: TicketFilter) => {
    setFilterState(next);
    if (next.length === 0) {
      localStorage.removeItem(STORAGE_KEY);
    } else {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    }
  }, []);

  const boardQueryString = useMemo(() => {
    if (filter.length === 0) return "";
    return `?filter=${encodeURIComponent(serializeTicketFilter(filter))}`;
  }, [filter]);

  return {
    filter,
    setFilter,
    boardQueryString,
    filterActive: filter.length > 0,
  };
}
