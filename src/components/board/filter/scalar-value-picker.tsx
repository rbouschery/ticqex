import {
  CustomerFilterCombobox,
  CustomerFilterMultiCombobox,
} from "@/components/board/customer-filter-combobox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  operatorNeedsValues,
  type FilterOperator,
  type ScalarFilterField,
} from "@shared/ticket-filter";
import {
  CHANNEL_OPTIONS,
  KIND_OPTIONS,
  ORIGIN_OPTIONS,
  type Assignee,
  type Customer,
} from "./filter-types";
import { MultiCheckboxList } from "./multi-checkbox-list";

export function ScalarValuePicker({
  scalarField,
  operator,
  assignees,
  customers,
  singleValue,
  onSingleValueChange,
  multiValues,
  onMultiValuesChange,
  onToggleMultiValue,
}: {
  scalarField: ScalarFilterField;
  operator: FilterOperator | "";
  assignees: Assignee[];
  customers: Customer[];
  singleValue: string;
  onSingleValueChange: (value: string) => void;
  multiValues: string[];
  onMultiValuesChange: (values: string[]) => void;
  onToggleMultiValue: (value: string) => void;
}) {
  if (!operator || operator === "empty" || operator === "not_empty") return null;

  if (operatorNeedsValues(operator)) {
    if (scalarField === "assignee_id") {
      return (
        <MultiCheckboxList
          label="Assignees"
          options={assignees.map((u) => ({ value: u.id, label: u.username }))}
          selected={multiValues}
          onToggle={onToggleMultiValue}
        />
      );
    }
    if (scalarField === "customer_id") {
      return (
        <CustomerFilterMultiCombobox
          customers={customers}
          selected={multiValues}
          onSelectedChange={onMultiValuesChange}
        />
      );
    }
    if (scalarField === "kind") {
      return (
        <MultiCheckboxList
          label="Kinds"
          options={KIND_OPTIONS.map((value) => ({ value, label: value }))}
          selected={multiValues}
          onToggle={onToggleMultiValue}
        />
      );
    }
    if (scalarField === "origin") {
      return (
        <MultiCheckboxList
          label="Origins"
          options={ORIGIN_OPTIONS.map((value) => ({ value, label: value }))}
          selected={multiValues}
          onToggle={onToggleMultiValue}
        />
      );
    }
    return (
      <MultiCheckboxList
        label="Channels"
        options={CHANNEL_OPTIONS.map((value) => ({ value, label: value }))}
        selected={multiValues}
        onToggle={onToggleMultiValue}
      />
    );
  }

  if (scalarField === "assignee_id") {
    return (
      <div className="space-y-2">
        <Label>Assignee</Label>
        <Select value={singleValue} onValueChange={onSingleValueChange}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select assignee" />
          </SelectTrigger>
          <SelectContent>
            {assignees.map((user) => (
              <SelectItem key={user.id} value={user.id}>
                {user.username}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }

  if (scalarField === "customer_id") {
    return (
      <CustomerFilterCombobox
        customers={customers}
        value={singleValue}
        onValueChange={onSingleValueChange}
      />
    );
  }

  if (scalarField === "kind") {
    return (
      <div className="space-y-2">
        <Label>Kind</Label>
        <Select value={singleValue} onValueChange={onSingleValueChange}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select kind" />
          </SelectTrigger>
          <SelectContent>
            {KIND_OPTIONS.map((value) => (
              <SelectItem key={value} value={value}>
                {value}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }

  if (scalarField === "origin") {
    return (
      <div className="space-y-2">
        <Label>Origin</Label>
        <Select value={singleValue} onValueChange={onSingleValueChange}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select origin" />
          </SelectTrigger>
          <SelectContent>
            {ORIGIN_OPTIONS.map((value) => (
              <SelectItem key={value} value={value}>
                {value}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Label>Channel</Label>
      <Select value={singleValue} onValueChange={onSingleValueChange}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Select channel" />
        </SelectTrigger>
        <SelectContent>
          {CHANNEL_OPTIONS.map((value) => (
            <SelectItem key={value} value={value}>
              {value}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
