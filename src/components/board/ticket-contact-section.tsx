"use client";

import { useCallback, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  buildContactFieldRows,
  formatCustomFieldDisplayValue,
  resolveContactFieldVisibility,
} from "@shared/custom-fields";
import { PencilSimpleIcon } from "@phosphor-icons/react";
import { ChevronDown, ChevronRight } from "lucide-react";
import {
  CustomFieldInput,
  type CustomFieldEditorDef,
} from "@/components/custom-fields/custom-field-input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api-client";
import { usePersistedExpanded } from "@/hooks/use-persisted-expanded";
import {
  contactDetailQueryKey,
  useContactCustomFieldDefinitions,
  useContactDetail,
  type ContactCustomFieldDefinition,
  type ContactDetail,
} from "@/hooks/use-contact-detail";

function contactInitials(name: string): string {
  const parts = name.trim().split(/[\s@._-]+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
}

function toEditorDef(def: ContactCustomFieldDefinition): CustomFieldEditorDef {
  return {
    id: def.id,
    key: def.key,
    label: def.label,
    type: def.type,
    position: def.position,
    required: def.required,
    options: def.options,
  };
}

function TicketContactSectionBody({
  contactId,
  displayName,
  contactAddress,
}: {
  contactId: string;
  displayName: string;
  contactAddress?: string | null;
}) {
  const queryClient = useQueryClient();
  const { expanded, toggleExpanded, hydrated } = usePersistedExpanded(
    "ticqex.ticket-contact.expanded.v1",
    false,
  );
  const [showAllFields, setShowAllFields] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [customFieldPatch, setCustomFieldPatch] = useState<
    Record<string, unknown> | undefined
  >(undefined);

  const contactQuery = useContactDetail(contactId, expanded);
  const fieldsQuery = useContactCustomFieldDefinitions(expanded);

  const detail: ContactDetail | null = contactQuery.data ?? null;
  const definitions = useMemo(
    () => fieldsQuery.data ?? [],
    [fieldsQuery.data],
  );
  const loading = contactQuery.isPending || fieldsQuery.isPending;
  const error =
    contactQuery.error instanceof Error
      ? contactQuery.error.message
      : fieldsQuery.error instanceof Error
        ? fieldsQuery.error.message
        : null;

  const handleToggleExpanded = () => {
    if (expanded) {
      setShowAllFields(false);
      setEditing(false);
      setCustomFieldPatch(undefined);
      setSaveError(null);
    }
    toggleExpanded();
  };

  const showContactAddress =
    contactAddress &&
    contactAddress.trim().toLowerCase() !== displayName.trim().toLowerCase();

  const fieldRows = useMemo(
    () => buildContactFieldRows(definitions, detail?.custom_fields ?? {}),
    [definitions, detail?.custom_fields],
  );

  const { visibleRows, hasHiddenFields } = useMemo(
    () => resolveContactFieldVisibility(fieldRows, showAllFields),
    [fieldRows, showAllFields],
  );

  const customFieldValues = useMemo(() => {
    const base = detail?.custom_fields ?? {};
    if (!customFieldPatch) return base;
    return { ...base, ...customFieldPatch };
  }, [detail?.custom_fields, customFieldPatch]);

  const customFieldsDirty =
    !!customFieldPatch && Object.keys(customFieldPatch).length > 0;

  const updateCustomFieldValue = useCallback((key: string, value: unknown) => {
    setCustomFieldPatch((current) => ({
      ...(current ?? {}),
      [key]: value,
    }));
  }, []);

  const cancelEditing = useCallback(() => {
    setEditing(false);
    setCustomFieldPatch(undefined);
    setSaveError(null);
  }, []);

  const saveCustomFields = useCallback(async () => {
    if (!customFieldPatch || Object.keys(customFieldPatch).length === 0) {
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      await apiFetch(`/api/v1/contacts/${contactId}`, {
        method: "PATCH",
        body: JSON.stringify({ custom_fields: customFieldPatch }),
      });
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: contactDetailQueryKey(contactId),
        }),
        queryClient.invalidateQueries({ queryKey: ["board"] }),
      ]);
      setCustomFieldPatch(undefined);
      setEditing(false);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }, [contactId, customFieldPatch, queryClient]);

  const canEditFields = definitions.length > 0;

  return (
    <div className="-mx-4 border-t border-border">
      <button
        type="button"
        className="flex w-full items-center gap-2 border-b border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted/50"
        aria-expanded={expanded}
        onClick={handleToggleExpanded}
      >
        {expanded ? (
          <ChevronDown className="size-3.5 shrink-0" />
        ) : (
          <ChevronRight className="size-3.5 shrink-0" />
        )}
        Contact
        {!expanded && (
          <span className="ml-auto min-w-0 truncate text-xs font-normal text-muted-foreground">
            {displayName}
          </span>
        )}
      </button>

      {hydrated && expanded && (
        <div className="p-4">
          {loading && (
            <div className="space-y-2">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          )}

          {!loading && error && (
            <p className="text-xs text-destructive">{error}</p>
          )}

          {!loading && !error && detail && (
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-2">
                <Avatar size="sm">
                  <AvatarFallback className="bg-primary/10 text-[10px] text-primary">
                    {contactInitials(detail.username)}
                  </AvatarFallback>
                </Avatar>
                <span className="font-medium text-foreground">
                  {detail.username}
                </span>
                {canEditFields && !editing && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="ml-auto h-7 gap-1 px-2 text-xs"
                    onClick={() => setEditing(true)}
                  >
                    <PencilSimpleIcon className="size-3.5" />
                    Edit
                  </Button>
                )}
                {canEditFields && editing && (
                  <div className="ml-auto flex items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      disabled={saving}
                      onClick={cancelEditing}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      disabled={saving || !customFieldsDirty}
                      onClick={() => void saveCustomFields()}
                    >
                      {saving ? "Saving…" : "Save"}
                    </Button>
                  </div>
                )}
              </div>

              {saveError && (
                <p className="text-xs text-destructive">{saveError}</p>
              )}

              <dl className="space-y-1.5 text-xs">
                {showContactAddress && (
                  <div className="grid grid-cols-[minmax(5.5rem,8rem)_1fr] gap-x-2">
                    <dt className="text-muted-foreground">Email</dt>
                    <dd className="break-all text-foreground">{contactAddress}</dd>
                  </div>
                )}
                {!editing &&
                  visibleRows.map(({ def, value }) => (
                    <div
                      key={def.id}
                      className="grid grid-cols-[minmax(5.5rem,8rem)_1fr] gap-x-2"
                    >
                      <dt className="truncate text-muted-foreground">
                        {def.label}
                      </dt>
                      <dd className="break-all text-foreground">
                        {formatCustomFieldDisplayValue(def.type, value)}
                      </dd>
                    </div>
                  ))}
              </dl>

              {editing && (
                <div className="space-y-3">
                  {fieldRows.map(({ def }) => (
                    <div key={def.id} className="space-y-2">
                      <Label className="text-xs text-muted-foreground">
                        {def.label}
                        {def.required ? (
                          <span className="text-destructive"> *</span>
                        ) : null}
                      </Label>
                      <CustomFieldInput
                        def={toEditorDef(def)}
                        value={customFieldValues[def.key]}
                        disabled={saving}
                        optionsLoading={fieldsQuery.isPending}
                        onValueChange={(next) =>
                          updateCustomFieldValue(def.key, next)
                        }
                      />
                    </div>
                  ))}
                </div>
              )}

              {!editing && hasHiddenFields && (
                <button
                  type="button"
                  className="text-xs text-muted-foreground transition-colors hover:text-foreground"
                  onClick={() => setShowAllFields((value) => !value)}
                >
                  {showAllFields
                    ? "Show fewer fields"
                    : `Show all fields (${definitions.length})`}
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function TicketContactSection({
  contactId,
  displayName,
  contactAddress,
}: {
  contactId: string;
  displayName: string;
  contactAddress?: string | null;
}) {
  return (
    <TicketContactSectionBody
      key={contactId}
      contactId={contactId}
      displayName={displayName}
      contactAddress={contactAddress}
    />
  );
}
