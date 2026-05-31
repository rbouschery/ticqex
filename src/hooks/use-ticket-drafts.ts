"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import type { MessageRow } from "@/components/board/types";

export function ticketDraftsQueryKey(ticketId: string) {
  return ["ticket", ticketId, "drafts"] as const;
}

export function useTicketDrafts(ticketId: string) {
  return useQuery({
    queryKey: ticketDraftsQueryKey(ticketId),
    queryFn: () =>
      apiFetch<MessageRow[]>(`/api/v1/tickets/${ticketId}/messages/drafts`),
  });
}

export function invalidateTicketDrafts(
  queryClient: ReturnType<typeof useQueryClient>,
  ticketId: string,
) {
  void queryClient.invalidateQueries({
    queryKey: ticketDraftsQueryKey(ticketId),
  });
}
