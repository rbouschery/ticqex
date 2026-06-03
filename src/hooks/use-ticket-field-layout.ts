"use client";

import { useQuery } from "@tanstack/react-query";
import type { ResolvedTicketFieldLayout } from "@shared/ticket-fields";
import { apiFetch } from "@/lib/api-client";
import { adminSettingsQueryKey } from "@/hooks/use-admin-settings";

const STALE_MS = 5 * 60_000;

export function useTicketFieldLayoutFallback(
  layoutFromBoard: ResolvedTicketFieldLayout | null,
) {
  const query = useQuery({
    queryKey: adminSettingsQueryKey,
    queryFn: async () => {
      const data = await apiFetch<{
        ticket_field_layout?: ResolvedTicketFieldLayout;
      }>("/api/v1/settings");
      return data.ticket_field_layout ?? null;
    },
    enabled: !layoutFromBoard,
    staleTime: STALE_MS,
  });

  return layoutFromBoard ?? query.data ?? null;
}
