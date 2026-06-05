"use client";

import { useQuery } from "@tanstack/react-query";
import type { Tag } from "@/components/tags/types";
import type { EmailThreadOrder } from "@/components/board/email-conversation-panel";
import { apiFetch } from "@/lib/api-client";
import { resolveCopyContextSettings } from "@shared/copy-context";

type StaffUser = { id: string; username: string };

const REFERENCE_STALE_MS = 5 * 60_000;

export const ticketUsersQueryKey = ["ticket-reference", "users"] as const;
export const ticketTagsQueryKey = ["ticket-reference", "tags"] as const;
export const ticketThreadOrderQueryKey = [
  "ticket-reference",
  "thread-order",
] as const;
export const copyContextSettingsQueryKey = [
  "ticket-reference",
  "copy-context",
] as const;

export function useTicketUsers() {
  return useQuery({
    queryKey: ticketUsersQueryKey,
    queryFn: () => apiFetch<StaffUser[]>("/api/v1/users"),
    staleTime: REFERENCE_STALE_MS,
  });
}

export function useTicketTags() {
  return useQuery({
    queryKey: ticketTagsQueryKey,
    queryFn: () => apiFetch<Tag[]>("/api/v1/tags"),
    staleTime: REFERENCE_STALE_MS,
  });
}

export function useTicketThreadOrder() {
  return useQuery({
    queryKey: ticketThreadOrderQueryKey,
    queryFn: async () => {
      const settings = await apiFetch<{ email_thread_order?: EmailThreadOrder }>(
        "/api/v1/settings",
      );
      return settings.email_thread_order ?? "oldest_first";
    },
    staleTime: REFERENCE_STALE_MS,
  });
}

export function useCopyContextSettings() {
  return useQuery({
    queryKey: copyContextSettingsQueryKey,
    queryFn: async () => {
      const settings = await apiFetch<{ copy_context?: unknown }>(
        "/api/v1/settings",
      );
      return resolveCopyContextSettings(settings.copy_context);
    },
    staleTime: REFERENCE_STALE_MS,
  });
}

export function prefetchTicketReferenceData(
  queryClient: ReturnType<
    typeof import("@tanstack/react-query").useQueryClient
  >,
) {
  void queryClient.prefetchQuery({
    queryKey: ticketUsersQueryKey,
    queryFn: () => apiFetch<StaffUser[]>("/api/v1/users"),
    staleTime: REFERENCE_STALE_MS,
  });
  void queryClient.prefetchQuery({
    queryKey: ticketTagsQueryKey,
    queryFn: () => apiFetch<Tag[]>("/api/v1/tags"),
    staleTime: REFERENCE_STALE_MS,
  });
  void queryClient.prefetchQuery({
    queryKey: ticketThreadOrderQueryKey,
    queryFn: async () => {
      const settings = await apiFetch<{ email_thread_order?: EmailThreadOrder }>(
        "/api/v1/settings",
      );
      return settings.email_thread_order ?? "oldest_first";
    },
    staleTime: REFERENCE_STALE_MS,
  });
  void queryClient.prefetchQuery({
    queryKey: copyContextSettingsQueryKey,
    queryFn: async () => {
      const settings = await apiFetch<{ copy_context?: unknown }>(
        "/api/v1/settings",
      );
      return resolveCopyContextSettings(settings.copy_context);
    },
    staleTime: REFERENCE_STALE_MS,
  });
}
