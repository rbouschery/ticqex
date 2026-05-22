import type { ScalarFilterField } from "@shared/ticket-filter";

export type Assignee = { id: string; username: string };
export type Tag = { id: string; name: string; color: string };
export type Customer = { id: string; username: string };
export type BoardFilterOptions = {
  customers: Customer[];
  assignees: Assignee[];
  tags: Tag[];
};
export type CustomFieldDef = {
  id: string;
  key: string;
  label: string;
  type: string;
  options: { values?: string[] } | null;
};

export type FilterField =
  | ScalarFilterField
  | "tag"
  | "unread"
  | "ticket_field";

export const KIND_OPTIONS = ["task", "conversation"] as const;
export const ORIGIN_OPTIONS = ["manual", "api", "email"] as const;
export const CHANNEL_OPTIONS = ["email"] as const;
