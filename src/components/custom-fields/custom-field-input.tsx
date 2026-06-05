"use client";

import { useMemo } from "react";
import {
  parseMultiselectValue,
  parseSelectOptions,
} from "@shared/custom-fields/validation";
import { isOptionListType, type CustomFieldType } from "@shared/custom-fields/types";
import { MultiValueSelect } from "@/components/option-list/multi-value-select";
import { OptionCombobox } from "@/components/option-list/option-combobox";
import { OPTION_COMBOBOX_THRESHOLD } from "@/components/option-list/types";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";

const UNSET = "__unset__";

export type CustomFieldEditorDef = {
  id: string;
  key: string;
  label: string;
  type: string;
  position: number;
  required?: boolean;
  options: Record<string, unknown> | null;
};

function jsonDisplayValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export function CustomFieldInput({
  def,
  value,
  disabled,
  optionsLoading,
  onValueChange,
}: {
  def: CustomFieldEditorDef;
  value: unknown;
  disabled: boolean;
  optionsLoading: boolean;
  onValueChange: (value: unknown) => void;
}) {
  const type = def.type as CustomFieldType;
  const optionValues = parseSelectOptions(def.options);
  const optionItems = useMemo(
    () => optionValues.map((opt) => ({ value: opt, label: opt })),
    [optionValues],
  );

  if (isOptionListType(type) && optionsLoading) {
    return <Skeleton className="h-9 w-full" />;
  }

  switch (type) {
    case "boolean": {
      const selectValue =
        value === true ? "true" : value === false ? "false" : UNSET;
      return (
        <Select
          value={selectValue}
          onValueChange={(v) =>
            onValueChange(v === UNSET ? null : v === "true")
          }
          disabled={disabled}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Unset" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={UNSET}>Unset</SelectItem>
            <SelectItem value="true">Yes</SelectItem>
            <SelectItem value="false">No</SelectItem>
          </SelectContent>
        </Select>
      );
    }
    case "select": {
      const selectValue =
        typeof value === "string" && value ? value : UNSET;

      if (optionValues.length > OPTION_COMBOBOX_THRESHOLD) {
        return (
          <OptionCombobox
            value={selectValue}
            options={optionItems}
            onValueChange={(v) => onValueChange(v === UNSET ? null : v)}
            allowUnset
            unsetValue={UNSET}
            unsetLabel="Unset"
            disabled={disabled}
            placeholder="Unset"
            searchPlaceholder="Search options…"
            emptyMessage="No options found."
          />
        );
      }

      return (
        <Select
          value={selectValue}
          onValueChange={(v) => onValueChange(v === UNSET ? null : v)}
          disabled={disabled}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Unset" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={UNSET}>Unset</SelectItem>
            {optionValues.map((opt) => (
              <SelectItem key={opt} value={opt}>
                {opt}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }
    case "multiselect":
      return (
        <MultiValueSelect
          value={parseMultiselectValue(value)}
          options={optionItems}
          onChange={(next) => onValueChange(next.length ? next : null)}
          disabled={disabled}
          placeholder="Search options…"
          emptyMessage="No options found."
        />
      );
    case "number":
      return (
        <Input
          type="number"
          value={
            value === null || value === undefined
              ? ""
              : String(value)
          }
          onChange={(e) => {
            const raw = e.target.value;
            onValueChange(raw === "" ? null : raw);
          }}
          disabled={disabled}
        />
      );
    case "date":
      return (
        <Input
          type="date"
          value={
            typeof value === "string"
              ? value
              : value
                ? String(value)
                : ""
          }
          onChange={(e) =>
            onValueChange(e.target.value === "" ? null : e.target.value)
          }
          disabled={disabled}
        />
      );
    case "json":
      return (
        <Textarea
          value={jsonDisplayValue(value)}
          onChange={(e) => onValueChange(e.target.value)}
          rows={4}
          className="font-mono text-xs"
          disabled={disabled}
        />
      );
    case "url":
      return (
        <Input
          type="url"
          value={value === null || value === undefined ? "" : String(value)}
          onChange={(e) =>
            onValueChange(e.target.value === "" ? null : e.target.value)
          }
          disabled={disabled}
          placeholder="https://"
        />
      );
    case "text":
    default:
      return (
        <Input
          value={value === null || value === undefined ? "" : String(value)}
          onChange={(e) =>
            onValueChange(e.target.value === "" ? null : e.target.value)
          }
          disabled={disabled}
        />
      );
  }
}
