"use client";

import { useState } from "react";
import { FunnelIcon, PlusIcon, XIcon } from "@phosphor-icons/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  formatFilterConditionLabel,
  removeFilterCondition,
  type TicketFilter,
} from "@shared/ticket-filter";
import { FilterPopoverForm } from "./filter/filter-popover-form";
import { useFilterDraft } from "./filter/use-filter-draft";

export function BoardFilterBar({
  filter,
  onFilterChange,
}: {
  filter: TicketFilter;
  onFilterChange: (filter: TicketFilter) => void;
}) {
  const [open, setOpen] = useState(false);
  const draft = useFilterDraft(filter, onFilterChange, () => setOpen(false));

  return (
    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
      <FunnelIcon className="size-4 shrink-0 text-muted-foreground" />
      {filter.map((condition, index) => (
        <Badge key={`${condition.field}-${index}`} variant="secondary" className="gap-1">
          {formatFilterConditionLabel(condition, {
            users: draft.userLabels,
            customers: draft.customerLabels,
            customFields: draft.customFieldLabels,
          })}
          <button
            type="button"
            className="rounded-sm opacity-70 hover:opacity-100"
            aria-label="Remove filter"
            onClick={() => onFilterChange(removeFilterCondition(filter, index))}
          >
            <XIcon className="size-3" />
          </button>
        </Badge>
      ))}

      <Popover
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (next) void draft.loadOptions();
        }}
      >
        <PopoverTrigger asChild>
          <Button type="button" variant="outline" size="sm">
            <PlusIcon />
            Filter
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-80 space-y-3">
          <FilterPopoverForm
            field={draft.field}
            onFieldChange={draft.handleFieldChange}
            customFieldKey={draft.customFieldKey}
            onCustomFieldKeyChange={draft.setCustomFieldKey}
            customFields={draft.customFields}
            selectedCustomField={draft.selectedCustomField}
            showOperator={draft.showOperator}
            operator={draft.operator}
            onOperatorChange={draft.handleOperatorChange}
            availableOperators={draft.availableOperators}
            assignees={draft.assignees}
            customers={draft.customers}
            tags={draft.tags}
            singleValue={draft.singleValue}
            onSingleValueChange={draft.setSingleValue}
            multiValues={draft.multiValues}
            onMultiValuesChange={draft.setMultiValues}
            onToggleMultiValue={(value) =>
              draft.toggleMultiValue(value, draft.multiValues, draft.setMultiValues)
            }
            customValue={draft.customValue}
            onCustomValueChange={draft.setCustomValue}
            customMultiValues={draft.customMultiValues}
            onCustomMultiValuesChange={draft.setCustomMultiValues}
            onToggleCustomMultiValue={(value) =>
              draft.toggleMultiValue(
                value,
                draft.customMultiValues,
                draft.setCustomMultiValues,
              )
            }
            unreadValue={draft.unreadValue}
            onUnreadValueChange={draft.setUnreadValue}
            onReset={draft.resetDraft}
            onApply={draft.handleApply}
          />
        </PopoverContent>
      </Popover>

      {filter.length > 0 && (
        <Button type="button" variant="ghost" size="sm" onClick={() => onFilterChange([])}>
          Clear all
        </Button>
      )}
    </div>
  );
}
