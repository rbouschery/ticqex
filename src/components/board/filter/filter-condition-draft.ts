import {
  operatorNeedsValue,
  operatorNeedsValues,
  type FilterOperator,
  type ScalarFilterField,
  type TicketFilterCondition,
} from "@shared/ticket-filter";
import type { CustomFieldDef, FilterField } from "./filter-types";

export type FilterConditionDraft = {
  field: FilterField | "";
  operator: FilterOperator | "";
  customFieldKey: string;
  selectedCustomField: CustomFieldDef | undefined;
  singleValue: string;
  multiValues: string[];
  customValue: string;
  customMultiValues: string[];
  unreadValue: boolean;
};

function isUnreadOp(op: FilterOperator): op is "eq" | "neq" {
  return op === "eq" || op === "neq";
}

function isInNinOp(op: FilterOperator): op is "in" | "nin" {
  return op === "in" || op === "nin";
}

function isEmptyOp(op: FilterOperator): op is "empty" | "not_empty" {
  return op === "empty" || op === "not_empty";
}

function isEqNeqOp(op: FilterOperator): op is "eq" | "neq" {
  return op === "eq" || op === "neq";
}

function isTicketFieldValueOp(
  op: FilterOperator,
): op is "eq" | "neq" | "contains" | "not_contains" {
  return (
    op === "eq" ||
    op === "neq" ||
    op === "contains" ||
    op === "not_contains"
  );
}

function isScalarField(field: FilterField): field is ScalarFilterField {
  return (
    field !== "tag" &&
    field !== "unread" &&
    field !== "ticket_field"
  );
}

export function buildConditionFromDraft(
  draft: FilterConditionDraft,
): TicketFilterCondition | null {
  const { field, operator } = draft;
  if (!field || !operator) return null;

  if (field === "unread") {
    if (!isUnreadOp(operator)) return null;
    return {
      field: "unread",
      op: operator,
      value: draft.unreadValue,
    };
  }

  if (field === "tag") {
    if (!isInNinOp(operator)) return null;
    if (draft.multiValues.length === 0) return null;
    return {
      field: "tag",
      op: operator,
      values: draft.multiValues,
    };
  }

  if (field === "ticket_field") {
    const { customFieldKey, selectedCustomField } = draft;
    if (!customFieldKey || !selectedCustomField) return null;

    if (isEmptyOp(operator)) {
      return {
        field: "ticket_field",
        key: customFieldKey,
        op: operator,
      };
    }

    if (operatorNeedsValues(operator)) {
      if (!isInNinOp(operator)) return null;
      if (draft.customMultiValues.length === 0) return null;
      return {
        field: "ticket_field",
        key: customFieldKey,
        op: operator,
        values:
          selectedCustomField.type === "number"
            ? draft.customMultiValues.map(Number)
            : draft.customMultiValues,
      };
    }

    if (!operatorNeedsValue(operator)) return null;
    if (!isTicketFieldValueOp(operator)) return null;

    let value: string | boolean | number = draft.customValue;
    if (selectedCustomField.type === "boolean") {
      value = draft.customValue === "true";
    } else if (selectedCustomField.type === "number") {
      value = Number(draft.customValue);
      if (Number.isNaN(value)) return null;
    } else if (!draft.customValue.trim()) {
      return null;
    }

    return {
      field: "ticket_field",
      key: customFieldKey,
      op: operator,
      value,
    };
  }

  if (!isScalarField(field)) return null;

  if (isEmptyOp(operator)) {
    return { field, op: operator };
  }

  if (operatorNeedsValues(operator)) {
    if (!isInNinOp(operator)) return null;
    if (draft.multiValues.length === 0) return null;
    return {
      field,
      op: operator,
      values: draft.multiValues,
    };
  }

  if (!isEqNeqOp(operator)) return null;
  if (!draft.singleValue) return null;
  return {
    field,
    op: operator,
    value: draft.singleValue,
  };
}
