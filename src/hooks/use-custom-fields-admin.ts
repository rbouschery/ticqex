"use client";

import { useQuery } from "@tanstack/react-query";
import type { CustomFieldDefinition } from "@shared/custom-fields";
import type { TicketFieldCatalogEntry } from "@shared/ticket-fields";
import { apiFetch } from "@/lib/api-client";
import type { AdminSettings } from "@/hooks/use-admin-settings";

const STALE_MS = 30_000;

export const customFieldsAdminQueryKey = ["custom-fields", "admin"] as const;

export type CustomFieldsAdminData = {
  fields: CustomFieldDefinition[];
  catalog: TicketFieldCatalogEntry[];
};

export function useCustomFieldsAdmin() {
  return useQuery({
    queryKey: customFieldsAdminQueryKey,
    queryFn: async (): Promise<CustomFieldsAdminData> => {
      const [fields, settings] = await Promise.all([
        apiFetch<CustomFieldDefinition[]>("/api/v1/custom-fields"),
        apiFetch<AdminSettings>("/api/v1/settings"),
      ]);
      return {
        fields,
        catalog: settings.ticket_field_layout?.catalog ?? [],
      };
    },
    staleTime: STALE_MS,
  });
}
