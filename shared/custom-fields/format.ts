import type { CustomFieldDefinition } from "./types";
import { buildContactFieldRows, hasCustomFieldValue } from "./contact-visibility";

export { hasCustomFieldValue };

export type CustomFieldFormatMode = "display" | "export";

export type ContactOpenFieldDisplay = {
  label: string;
  value: string;
};

export function formatCustomFieldValue(
  type: string,
  value: unknown,
  mode: CustomFieldFormatMode = "display",
): string {
  if (!hasCustomFieldValue(value)) {
    return mode === "display" ? "—" : "";
  }

  switch (type) {
    case "boolean":
      return value ? "Yes" : "No";
    case "date":
      return new Date(String(value)).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    case "json":
      return typeof value === "string" ? value : JSON.stringify(value);
    case "multiselect":
      return Array.isArray(value) ? value.join(", ") : String(value);
    default:
      return String(value);
  }
}

export function formatCustomFieldDisplayValue(type: string, value: unknown): string {
  return formatCustomFieldValue(type, value, "display");
}

export function resolveOpenContactFieldsForDisplay<
  T extends Pick<
    CustomFieldDefinition,
    "key" | "label" | "type" | "position" | "show_open_in_ticket"
  >,
>(definitions: T[], values: Record<string, unknown>): ContactOpenFieldDisplay[] {
  return buildContactFieldRows(definitions, values)
    .filter(({ def }) => def.show_open_in_ticket)
    .map(({ def, value }) => ({
      label: def.label,
      value: formatCustomFieldDisplayValue(def.type, value),
    }));
}
