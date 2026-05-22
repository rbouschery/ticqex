"use client";

import { useCallback, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api-client";
import {
  getCustomFieldOperators,
  getScalarOperators,
  getTagOperators,
  getUnreadOperators,
  upsertFilterCondition,
  type FilterOperator,
  type TicketFilter,
} from "@shared/ticket-filter";
import { buildConditionFromDraft } from "./filter-condition-draft";
import type {
  Assignee,
  BoardFilterOptions,
  CustomFieldDef,
  Customer,
  FilterField,
  Tag,
} from "./filter-types";

export function useFilterDraft(
  filter: TicketFilter,
  onFilterChange: (filter: TicketFilter) => void,
  onApplied: () => void,
) {
  const [field, setField] = useState<FilterField | "">("");
  const [operator, setOperator] = useState<FilterOperator | "">("");
  const [customFieldKey, setCustomFieldKey] = useState("");
  const [assignees, setAssignees] = useState<Assignee[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customFields, setCustomFields] = useState<CustomFieldDef[]>([]);
  const [singleValue, setSingleValue] = useState("");
  const [multiValues, setMultiValues] = useState<string[]>([]);
  const [customValue, setCustomValue] = useState("");
  const [customMultiValues, setCustomMultiValues] = useState<string[]>([]);
  const [unreadValue, setUnreadValue] = useState(true);

  const loadOptions = useCallback(async () => {
    const [options, fields] = await Promise.all([
      apiFetch<BoardFilterOptions>("/api/v1/board/filter-options"),
      apiFetch<CustomFieldDef[]>("/api/v1/custom-fields?group=ticket"),
    ]);
    setCustomers(options.customers);
    setAssignees(options.assignees);
    setTags(options.tags);
    setCustomFields(fields);
  }, []);

  const selectedCustomField = customFields.find((f) => f.key === customFieldKey);

  const availableOperators = useMemo(() => {
    if (!field) return [];
    if (field === "tag") return getTagOperators();
    if (field === "unread") return getUnreadOperators();
    if (field === "ticket_field") {
      return selectedCustomField
        ? getCustomFieldOperators(selectedCustomField.type)
        : [];
    }
    return getScalarOperators(field);
  }, [field, selectedCustomField]);

  const effectiveOperator =
    operator && availableOperators.includes(operator)
      ? operator
      : (availableOperators[0] ?? "");

  const userLabels = new Map(assignees.map((u) => [u.id, u.username]));
  const customerLabels = new Map(customers.map((c) => [c.id, c.username]));
  const customFieldLabels = new Map(customFields.map((f) => [f.key, f.label]));

  function resetDraft() {
    setField("");
    setOperator("");
    setCustomFieldKey("");
    setSingleValue("");
    setMultiValues([]);
    setCustomValue("");
    setCustomMultiValues([]);
    setUnreadValue(true);
  }

  function handleFieldChange(nextField: FilterField) {
    setField(nextField);
    setOperator("");
    setCustomFieldKey("");
    setSingleValue("");
    setMultiValues([]);
    setCustomValue("");
    setCustomMultiValues([]);
  }

  function handleOperatorChange(nextOperator: FilterOperator) {
    setOperator(nextOperator);
    setSingleValue("");
    setMultiValues([]);
    setCustomValue("");
    setCustomMultiValues([]);
  }

  function toggleMultiValue(
    value: string,
    selected: string[],
    setSelected: (v: string[]) => void,
  ) {
    setSelected(
      selected.includes(value)
        ? selected.filter((entry) => entry !== value)
        : [...selected, value],
    );
  }

  function handleApply() {
    const condition = buildConditionFromDraft({
      field,
      operator: effectiveOperator,
      customFieldKey,
      selectedCustomField,
      singleValue,
      multiValues,
      customValue,
      customMultiValues,
      unreadValue,
    });
    if (!condition) return;
    onFilterChange(upsertFilterCondition(filter, condition));
    resetDraft();
    onApplied();
  }

  const showOperator = Boolean(field && (field !== "ticket_field" || customFieldKey));

  return {
    loadOptions,
    userLabels,
    customerLabels,
    customFieldLabels,
    field,
    operator: effectiveOperator,
    customFieldKey,
    setCustomFieldKey,
    customFields,
    selectedCustomField,
    showOperator,
    availableOperators,
    assignees,
    customers,
    tags,
    singleValue,
    setSingleValue,
    multiValues,
    setMultiValues,
    customValue,
    setCustomValue,
    customMultiValues,
    setCustomMultiValues,
    unreadValue,
    setUnreadValue,
    resetDraft,
    handleFieldChange,
    handleOperatorChange,
    toggleMultiValue,
    handleApply,
  };
}
