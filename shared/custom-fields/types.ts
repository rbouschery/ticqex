export const CUSTOM_FIELD_TYPES = [
  "text",
  "number",
  "date",
  "boolean",
  "select",
  "multiselect",
  "url",
  "json",
] as const;

export type CustomFieldType = (typeof CUSTOM_FIELD_TYPES)[number];

export type CustomFieldGroup = "ticket" | "contact";

export type SelectFieldOptions = {
  values: string[];
};

export type CustomFieldDefinitionOptions = SelectFieldOptions | null;

export function isOptionListType(type: CustomFieldType): boolean {
  return type === "select" || type === "multiselect";
}

export type CustomFieldDefinition = {
  id: string;
  group: CustomFieldGroup;
  key: string;
  label: string;
  type: CustomFieldType;
  options: Record<string, unknown> | null;
  required: boolean;
  /** Contact fields: show in ticket contact panel without expanding "Show all fields". */
  show_open_in_ticket: boolean;
  position: number;
  created_at?: string;
};
