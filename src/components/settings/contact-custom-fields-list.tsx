"use client";

import { PlusIcon } from "@phosphor-icons/react";
import {
  type CustomFieldDefinition,
  type CustomFieldGroup,
} from "@shared/custom-fields";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  SortableCustomFieldRow,
  SortableCustomFieldsList,
} from "@/components/settings/sortable-custom-fields-list";
import { cn } from "@/lib/utils";

const contactVisibilityGrid =
  "grid grid-cols-[1.75rem_minmax(0,1fr)_5rem_4.5rem] items-center gap-2";

function ContactFieldsVisibilityHeader() {
  return (
    <div
      className={cn(
        contactVisibilityGrid,
        "px-2 pb-1 text-xs font-medium text-muted-foreground",
      )}
    >
      <span aria-hidden className="block w-0" />
      <span>Field</span>
      <span className="text-center">Show openly</span>
      <span aria-hidden className="block w-0" />
    </div>
  );
}

export function ContactCustomFieldsList({
  fields,
  onReorder,
  onEdit,
  onDelete,
  onAdd,
  onShowOpenChange,
  savingVisibilityId,
}: {
  fields: CustomFieldDefinition[];
  onReorder: (group: CustomFieldGroup, orderedIds: string[]) => Promise<void>;
  onEdit: (field: CustomFieldDefinition) => void;
  onDelete: (field: CustomFieldDefinition) => void;
  onAdd: (group: CustomFieldGroup) => void;
  onShowOpenChange: (field: CustomFieldDefinition, showOpen: boolean) => void;
  savingVisibilityId: string | null;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onAdd("contact")}
        >
          <PlusIcon />
          Add
        </Button>
      </div>

      <SortableCustomFieldsList
        fields={fields}
        group="contact"
        emptyMessage="No contact fields yet."
        onReorder={onReorder}
        header={<ContactFieldsVisibilityHeader />}
        renderRow={(field) => (
          <SortableCustomFieldRow
            field={field}
            onEdit={onEdit}
            onDelete={onDelete}
            className={contactVisibilityGrid}
            infoClassName="min-w-0"
          >
            <div className="flex justify-center">
              <Checkbox
                checked={field.show_open_in_ticket}
                disabled={savingVisibilityId === field.id}
                aria-label={`Show ${field.label} openly in ticket`}
                onCheckedChange={(checked) =>
                  onShowOpenChange(field, checked === true)
                }
              />
            </div>
          </SortableCustomFieldRow>
        )}
      />
    </div>
  );
}
