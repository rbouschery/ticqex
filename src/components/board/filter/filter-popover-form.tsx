"use client";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  formatOperatorLabel,
  type FilterOperator,
} from "@shared/ticket-filter";
import { CustomFieldValuePicker } from "./custom-field-value-picker";
import type {
  Assignee,
  CustomFieldDef,
  Customer,
  FilterField,
  Tag,
} from "./filter-types";
import { MultiCheckboxList } from "./multi-checkbox-list";
import { ScalarValuePicker } from "./scalar-value-picker";

type FilterPopoverFormProps = {
  field: FilterField | "";
  onFieldChange: (field: FilterField) => void;
  customFieldKey: string;
  onCustomFieldKeyChange: (key: string) => void;
  customFields: CustomFieldDef[];
  selectedCustomField: CustomFieldDef | undefined;
  showOperator: boolean;
  operator: FilterOperator | "";
  onOperatorChange: (operator: FilterOperator) => void;
  availableOperators: FilterOperator[];
  assignees: Assignee[];
  customers: Customer[];
  tags: Tag[];
  singleValue: string;
  onSingleValueChange: (value: string) => void;
  multiValues: string[];
  onMultiValuesChange: (values: string[]) => void;
  onToggleMultiValue: (value: string) => void;
  customValue: string;
  onCustomValueChange: (value: string) => void;
  customMultiValues: string[];
  onCustomMultiValuesChange: (values: string[]) => void;
  onToggleCustomMultiValue: (value: string) => void;
  unreadValue: boolean;
  onUnreadValueChange: (value: boolean) => void;
  onReset: () => void;
  onApply: () => void;
};

export function FilterPopoverForm({
  field,
  onFieldChange,
  customFieldKey,
  onCustomFieldKeyChange,
  customFields,
  selectedCustomField,
  showOperator,
  operator,
  onOperatorChange,
  availableOperators,
  assignees,
  customers,
  tags,
  singleValue,
  onSingleValueChange,
  multiValues,
  onMultiValuesChange,
  onToggleMultiValue,
  customValue,
  onCustomValueChange,
  customMultiValues,
  onCustomMultiValuesChange,
  onToggleCustomMultiValue,
  unreadValue,
  onUnreadValueChange,
  onReset,
  onApply,
}: FilterPopoverFormProps) {
  return (
    <>
      <div className="space-y-2">
        <Label>Field</Label>
        <Select
          value={field}
          onValueChange={(value) => onFieldChange(value as FilterField)}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Choose field" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="assignee_id">Assignee</SelectItem>
            <SelectItem value="customer_id">Customer</SelectItem>
            <SelectItem value="tag">Tag</SelectItem>
            <SelectItem value="kind">Kind</SelectItem>
            <SelectItem value="channel">Channel</SelectItem>
            <SelectItem value="origin">Origin</SelectItem>
            <SelectItem value="unread">Unread status</SelectItem>
            <SelectItem value="ticket_field">Custom field</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {field === "ticket_field" && (
        <div className="space-y-2">
          <Label>Custom field</Label>
          <Select value={customFieldKey} onValueChange={onCustomFieldKeyChange}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select field" />
            </SelectTrigger>
            <SelectContent>
              {customFields.map((def) => (
                <SelectItem key={def.id} value={def.key}>
                  {def.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {showOperator && (
        <div className="space-y-2">
          <Label>Operator</Label>
          <Select
            value={operator}
            onValueChange={(value) => onOperatorChange(value as FilterOperator)}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Choose operator" />
            </SelectTrigger>
            <SelectContent>
              {availableOperators.map((op) => (
                <SelectItem key={op} value={op}>
                  {formatOperatorLabel(op)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {field &&
        field !== "tag" &&
        field !== "unread" &&
        field !== "ticket_field" && (
          <ScalarValuePicker
            scalarField={field}
            operator={operator}
            assignees={assignees}
            customers={customers}
            singleValue={singleValue}
            onSingleValueChange={onSingleValueChange}
            multiValues={multiValues}
            onMultiValuesChange={onMultiValuesChange}
            onToggleMultiValue={onToggleMultiValue}
          />
        )}

      {field === "tag" && operator && (
        <MultiCheckboxList
          label="Tags"
          options={tags.map((tag) => ({ value: tag.name, label: tag.name }))}
          selected={multiValues}
          onToggle={onToggleMultiValue}
        />
      )}

      {field === "unread" && (
        <div className="space-y-2">
          <Label>Status</Label>
          <Select
            value={unreadValue ? "true" : "false"}
            onValueChange={(v) => onUnreadValueChange(v === "true")}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="true">Has unread messages</SelectItem>
              <SelectItem value="false">Fully read</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {field === "ticket_field" && customFieldKey && operator && selectedCustomField && (
        <CustomFieldValuePicker
          customField={selectedCustomField}
          operator={operator}
          customValue={customValue}
          onCustomValueChange={onCustomValueChange}
          customMultiValues={customMultiValues}
          onCustomMultiValuesChange={onCustomMultiValuesChange}
          onToggleCustomMultiValue={onToggleCustomMultiValue}
        />
      )}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onReset}>
          Reset
        </Button>
        <Button type="button" size="sm" onClick={onApply} disabled={!field || !operator}>
          Apply
        </Button>
      </div>
    </>
  );
}
