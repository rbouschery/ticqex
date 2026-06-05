"use client";

import { useMemo } from "react";
import { hasCustomFieldDisplayValue } from "@shared/custom-fields";
import { ChevronDown, ChevronRight } from "lucide-react";
import {
  CustomFieldInput,
  type CustomFieldEditorDef,
} from "@/components/custom-fields/custom-field-input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { usePersistedExpanded } from "@/hooks/use-persisted-expanded";

export type TicketCustomFieldEditorDef = CustomFieldEditorDef;

export function TicketCustomFieldsSection({
  definitions,
  values,
  optionsLoading = false,
  saving,
  dirty,
  onValueChange,
  onSave,
}: {
  definitions: TicketCustomFieldEditorDef[];
  values: Record<string, unknown>;
  optionsLoading?: boolean;
  saving: boolean;
  dirty: boolean;
  onValueChange: (key: string, value: unknown) => void;
  onSave: () => void;
}) {
  const { expanded, toggleExpanded } = usePersistedExpanded(
    "ticqex.ticket-custom-fields.expanded.v1",
    true,
  );

  const rows = useMemo(() => {
    return [...definitions]
      .sort((a, b) => a.position - b.position)
      .map((def) => ({
        def,
        value: values[def.key],
      }));
  }, [definitions, values]);

  const collapsedSummary = useMemo(() => {
    const filled = rows.filter(({ value }) => hasCustomFieldDisplayValue(value)).length;
    if (filled === 0) return `${rows.length} fields`;
    return `${filled} of ${rows.length}`;
  }, [rows]);

  if (rows.length === 0) return null;

  return (
    <div className="-mx-4 border-t border-border">
      <button
        type="button"
        className="flex w-full items-center gap-2 border-b border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted/50"
        aria-expanded={expanded}
        onClick={toggleExpanded}
      >
        {expanded ? (
          <ChevronDown className="size-3.5 shrink-0" />
        ) : (
          <ChevronRight className="size-3.5 shrink-0" />
        )}
        Custom fields
        {!expanded && (
          <span className="ml-auto min-w-0 truncate text-xs font-normal text-muted-foreground">
            {collapsedSummary}
          </span>
        )}
      </button>

      {expanded && (
        <div className="space-y-3 p-4">
          {rows.map(({ def, value }) => (
            <div key={def.id} className="space-y-2">
              <Label className="text-muted-foreground">
                {def.label}
                {def.required ? (
                  <span className="text-destructive"> *</span>
                ) : null}
              </Label>
              <CustomFieldInput
                def={def}
                value={value}
                disabled={saving}
                optionsLoading={optionsLoading}
                onValueChange={(next) => onValueChange(def.key, next)}
              />
            </div>
          ))}
          <div className="flex justify-end">
            <Button
              type="button"
              size="sm"
              disabled={saving || !dirty}
              onClick={onSave}
            >
              Save custom fields
            </Button>
          </div>
        </div>
      )}

    </div>
  );
}
