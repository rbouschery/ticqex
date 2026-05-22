import {
  normalizeCondition,
  type FilterOperator,
  type ScalarFilterField,
  type TicketFilterCondition,
} from "./schema";

export function formatOperatorLabel(op: FilterOperator | "any"): string {
  switch (op) {
    case "eq":
      return "equals";
    case "neq":
      return "does not equal";
    case "in":
    case "any":
      return "is any of";
    case "nin":
      return "is none of";
    case "empty":
      return "is empty";
    case "not_empty":
      return "is not empty";
    case "contains":
      return "contains";
    case "not_contains":
      return "does not contain";
    default:
      return op;
  }
}

export function getScalarOperators(field: ScalarFilterField): FilterOperator[] {
  switch (field) {
    case "kind":
    case "origin":
      return ["eq", "neq", "in", "nin"];
    case "assignee_id":
    case "customer_id":
    case "channel":
      return ["eq", "neq", "in", "nin", "empty", "not_empty"];
    default:
      return ["eq", "neq", "in", "nin"];
  }
}

export function getTagOperators(): Array<"in" | "nin"> {
  return ["in", "nin"];
}

export function getUnreadOperators(): Array<"eq" | "neq"> {
  return ["eq", "neq"];
}

export function getCustomFieldOperators(type: string): FilterOperator[] {
  switch (type) {
    case "boolean":
      return ["eq", "neq", "empty", "not_empty"];
    case "number":
      return ["eq", "neq", "in", "nin", "empty", "not_empty"];
    case "select":
      return ["eq", "neq", "in", "nin", "empty", "not_empty"];
    case "text":
    case "url":
      return ["eq", "neq", "contains", "not_contains", "empty", "not_empty"];
    default:
      return ["eq", "neq", "empty", "not_empty"];
  }
}

export function operatorNeedsValues(op: FilterOperator | "any"): boolean {
  return op === "in" || op === "nin" || op === "any";
}

export function operatorNeedsValue(op: FilterOperator | "any"): boolean {
  return (
    op === "eq" ||
    op === "neq" ||
    op === "contains" ||
    op === "not_contains"
  );
}

const FIELD_LABELS: Record<string, string> = {
  assignee_id: "Assignee",
  customer_id: "Customer",
  kind: "Kind",
  channel: "Channel",
  origin: "Origin",
  tag: "Tag",
  unread: "Unread",
  ticket_field: "Field",
};

export function formatFilterConditionLabel(
  condition: TicketFilterCondition,
  labels: {
    users?: Map<string, string>;
    customers?: Map<string, string>;
    customFields?: Map<string, string>;
  } = {},
): string {
  const normalized = normalizeCondition(condition);
  const fieldLabel =
    normalized.field === "ticket_field"
      ? (labels.customFields?.get(normalized.key) ?? normalized.key)
      : (FIELD_LABELS[normalized.field] ?? normalized.field);
  const opLabel = formatOperatorLabel(normalized.op);

  switch (normalized.field) {
    case "assignee_id":
      if (normalized.op === "empty" || normalized.op === "not_empty") {
        return `${fieldLabel} ${opLabel}`;
      }
      if (operatorNeedsValues(normalized.op)) {
        const names = (normalized.values ?? []).map(
          (id) => labels.users?.get(id) ?? id,
        );
        return `${fieldLabel} ${opLabel} ${names.join(", ")}`;
      }
      return `${fieldLabel} ${opLabel} ${labels.users?.get(normalized.value!) ?? normalized.value}`;
    case "customer_id":
      if (normalized.op === "empty" || normalized.op === "not_empty") {
        return `${fieldLabel} ${opLabel}`;
      }
      if (operatorNeedsValues(normalized.op)) {
        const names = (normalized.values ?? []).map(
          (id) => labels.customers?.get(id) ?? id,
        );
        return `${fieldLabel} ${opLabel} ${names.join(", ")}`;
      }
      return `${fieldLabel} ${opLabel} ${labels.customers?.get(normalized.value!) ?? normalized.value}`;
    case "kind":
    case "channel":
    case "origin":
      if (operatorNeedsValues(normalized.op)) {
        return `${fieldLabel} ${opLabel} ${(normalized.values ?? []).join(", ")}`;
      }
      return `${fieldLabel} ${opLabel} ${normalized.value}`;
    case "tag":
      return `${fieldLabel} ${opLabel} ${normalized.values.join(", ")}`;
    case "unread":
      return normalized.value ? "Has unread" : "Fully read";
    case "ticket_field":
      if (normalized.op === "empty" || normalized.op === "not_empty") {
        return `${fieldLabel} ${opLabel}`;
      }
      if (operatorNeedsValues(normalized.op)) {
        return `${fieldLabel} ${opLabel} ${(normalized.values ?? []).join(", ")}`;
      }
      return `${fieldLabel} ${opLabel} ${String(normalized.value)}`;
    default:
      return "Filter";
  }
}
