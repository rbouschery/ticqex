"use client";

import { useQuery, keepPreviousData } from "@tanstack/react-query";
import {
  serializeTicketFilter,
  type TicketFilter,
} from "@shared/ticket-filter";
import { serializeBoardSort, type BoardSort } from "@shared/board-sort";
import { buildBoardApiPath } from "@shared/board-api-path";
import { apiFetch } from "@/lib/api-client";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import type { BoardLane } from "@/components/board/types";
import type { ResolvedTicketFieldLayout } from "@shared/ticket-fields";

export type BoardResponse = {
  lanes: BoardLane[];
  settings?: Record<string, unknown>;
  ticket_field_layout?: ResolvedTicketFieldLayout;
  filter_active?: boolean;
  search_active?: boolean;
  capped?: boolean;
  sort?: BoardSort;
};

export function boardQueryKey(
  filter: TicketFilter,
  sort: BoardSort,
  searchQuery: string,
) {
  return [
    "board",
    serializeTicketFilter(filter),
    serializeBoardSort(sort),
    searchQuery.trim(),
  ] as const;
}

export function useBoardQuery(
  filter: TicketFilter,
  sort: BoardSort,
  searchQuery: string,
) {
  const debouncedSearch = useDebouncedValue(searchQuery, 300);
  const queryKey = boardQueryKey(filter, sort, debouncedSearch);

  const query = useQuery({
    queryKey,
    queryFn: () =>
      apiFetch<BoardResponse>(
        buildBoardApiPath(filter, sort, debouncedSearch),
      ),
    placeholderData: keepPreviousData,
  });

  return { ...query, queryKey };
}
