"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";

export type ContactDetail = {
  id: string;
  username: string;
  created_at: string;
  ticket_count: number;
  custom_fields: Record<string, unknown>;
};

export type ContactCustomFieldDefinition = {
  id: string;
  key: string;
  label: string;
  type: string;
  position: number;
  required: boolean;
  show_open_in_ticket: boolean;
  options: Record<string, unknown> | null;
};

const STALE_MS = 60_000;

export const contactDetailQueryKey = (contactId: string) =>
  ["contacts", contactId] as const;

export const contactCustomFieldsQueryKey = [
  "custom-fields",
  "contact",
] as const;

export function useContactDetail(contactId: string, enabled: boolean) {
  return useQuery({
    queryKey: contactDetailQueryKey(contactId),
    queryFn: () => apiFetch<ContactDetail>(`/api/v1/contacts/${contactId}`),
    enabled,
    staleTime: STALE_MS,
  });
}

export function useContactCustomFieldDefinitions(enabled: boolean) {
  return useQuery({
    queryKey: contactCustomFieldsQueryKey,
    queryFn: () =>
      apiFetch<ContactCustomFieldDefinition[]>(
        "/api/v1/custom-fields?group=contact",
      ),
    enabled,
    staleTime: STALE_MS,
  });
}
