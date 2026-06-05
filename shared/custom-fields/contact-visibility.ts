import type { CustomFieldDefinition } from "./types";

export function hasCustomFieldValue(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim() !== "";
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

/** @deprecated Prefer `hasCustomFieldValue` — kept for existing imports. */
export const hasCustomFieldDisplayValue = hasCustomFieldValue;

export type ContactFieldRow<
  T extends Pick<CustomFieldDefinition, "key" | "show_open_in_ticket">,
> = {
  def: T;
  value: unknown;
};

export function buildContactFieldRows<
  T extends Pick<
    CustomFieldDefinition,
    "key" | "position" | "show_open_in_ticket"
  >,
>(definitions: T[], values: Record<string, unknown>): ContactFieldRow<T>[] {
  return [...definitions]
    .sort((a, b) => a.position - b.position)
    .map((def) => ({
      def,
      value: values[def.key],
    }));
}

export function isContactFieldProminent<
  T extends Pick<CustomFieldDefinition, "show_open_in_ticket">,
>(def: T, value: unknown): boolean {
  return def.show_open_in_ticket || hasCustomFieldDisplayValue(value);
}

export function resolveContactFieldVisibility<
  T extends Pick<CustomFieldDefinition, "key" | "show_open_in_ticket">,
>(rows: ContactFieldRow<T>[], showAllFields: boolean) {
  const prominentRows = rows.filter(({ def, value }) =>
    isContactFieldProminent(def, value),
  );
  const hiddenCount = rows.length - prominentRows.length;

  return {
    visibleRows: showAllFields ? rows : prominentRows,
    hiddenCount,
    hasHiddenFields: hiddenCount > 0,
  };
}
