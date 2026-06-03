"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";

export type BoardStatusOption = {
  id: string;
  name: string;
  color: string;
};

const STALE_MS = 60_000;

export const statusesQueryKey = ["statuses"] as const;

export function useStatuses<T extends BoardStatusOption = BoardStatusOption>() {
  return useQuery({
    queryKey: statusesQueryKey,
    queryFn: () => apiFetch<T[]>("/api/v1/statuses"),
    staleTime: STALE_MS,
  });
}
