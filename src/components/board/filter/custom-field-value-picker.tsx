import { Input } from "@/components/ui/input";
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
} from "@shared/ticket-filter";
import type { CustomFieldDef } from "./filter-types";
import { MultiCheckboxList } from "./multi-checkbox-list";

export function CustomFieldValuePicker({
  customField,
  operator,
  customValue,
  onCustomValueChange,
  customMultiValues,
  onCustomMultiValuesChange,
  onToggleCustomMultiValue,
}: {
  customField: CustomFieldDef;
  operator: FilterOperator | "";
  customValue: string;
  onCustomValueChange: (value: string) => void;
  customMultiValues: string[];
  onCustomMultiValuesChange: (values: string[]) => void;
  onToggleCustomMultiValue: (value: string) => void;
}) {
  if (!operator || operator === "empty" || operator === "not_empty") return null;

  if (operatorNeedsValues(operator)) {
    if (customField.type === "select") {
      return (
        <MultiCheckboxList
          label="Values"
          options={(customField.options?.values ?? []).map((value) => ({
            value,
            label: value,
          }))}
          selected={customMultiValues}
          onToggle={onToggleCustomMultiValue}
        />
      );
    }
    return (
      <div className="space-y-2">
        <Label>Values (comma-separated)</Label>
        <Input
          value={customMultiValues.join(", ")}
          onChange={(e) =>
            onCustomMultiValuesChange(
              e.target.value
                .split(",")
                .map((part) => part.trim())
                .filter(Boolean),
            )
          }
          placeholder="value1, value2"
        />
      </div>
    );
  }

  if (customField.type === "boolean") {
    return (
      <div className="space-y-2">
        <Label>Value</Label>
        <Select value={customValue} onValueChange={onCustomValueChange}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Value" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="true">True</SelectItem>
            <SelectItem value="false">False</SelectItem>
          </SelectContent>
        </Select>
      </div>
    );
  }

  if (customField.type === "select") {
    return (
      <div className="space-y-2">
        <Label>Value</Label>
        <Select value={customValue} onValueChange={onCustomValueChange}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Value" />
          </SelectTrigger>
          <SelectContent>
            {(customField.options?.values ?? []).map((value) => (
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
      <Label>Value</Label>
      <Input
        value={customValue}
        onChange={(e) => onCustomValueChange(e.target.value)}
        placeholder="Value"
      />
    </div>
  );
}
