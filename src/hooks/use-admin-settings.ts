"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import type { SettingsSectionDescriptor } from "@shared/settings/types";

export type AdminSettings = {
  email_signature?: string;
  channels?: {
    email?: {
      enabled: boolean;
      integration: string | null;
    };
  };
  sections?: SettingsSectionDescriptor[];
  default_inbound_status_id?: string | null;
  email_thread_order?: "oldest_first" | "newest_first";
  ticket_field_layout?: import("@shared/ticket-fields").ResolvedTicketFieldLayout;
};

export type AdminApiKey = {
  id: string;
  name: string;
  key_prefix: string;
  created_at: string;
};

const STALE_MS = 30_000;

export const adminSettingsQueryKey = ["admin", "settings"] as const;
export const adminApiKeysQueryKey = ["admin", "api-keys"] as const;

export function useAdminSettings(enabled: boolean) {
  return useQuery({
    queryKey: adminSettingsQueryKey,
    queryFn: () => apiFetch<AdminSettings>("/api/v1/settings"),
    enabled,
    staleTime: STALE_MS,
  });
}

export function useAdminApiKeys(enabled: boolean) {
  return useQuery({
    queryKey: adminApiKeysQueryKey,
    queryFn: () => apiFetch<AdminApiKey[]>("/api/v1/api-keys"),
    enabled,
    staleTime: STALE_MS,
  });
}
