"use client";

import { useCallback, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  type CustomFieldDefinition,
  type CustomFieldGroup,
} from "@shared/custom-fields";
import {
  buildVisibilityPatch,
  type ResolvedTicketFieldLayout,
  type TicketFieldCatalogEntry,
} from "@shared/ticket-fields";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api-client";
import {
  customFieldsAdminQueryKey,
  useCustomFieldsAdmin,
} from "@/hooks/use-custom-fields-admin";
import {
  CustomFieldDefinitionDialog,
  type CustomFieldFormValues,
} from "@/components/settings/custom-field-definition-dialog";
import { ContactCustomFieldsList } from "@/components/settings/contact-custom-fields-list";
import { DeleteCustomFieldDialog } from "@/components/settings/delete-custom-field-dialog";
import { TicketFieldVisibilitySection } from "@/components/settings/ticket-field-visibility-section";

type FieldRow = CustomFieldDefinition;

type SettingsWithLayout = {
  ticket_field_layout?: ResolvedTicketFieldLayout;
};

export function CustomFieldsSection() {
  const queryClient = useQueryClient();
  const adminQuery = useCustomFieldsAdmin();
  const [fields, setFields] = useState<FieldRow[]>([]);
  const [catalog, setCatalog] = useState<TicketFieldCatalogEntry[]>([]);
  const [savedCatalog, setSavedCatalog] = useState<TicketFieldCatalogEntry[]>([]);
  const [syncedAt, setSyncedAt] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create");
  const [dialogGroup, setDialogGroup] = useState<CustomFieldGroup>("ticket");
  const [editingField, setEditingField] = useState<FieldRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [savingVisibility, setSavingVisibility] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<FieldRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  if (adminQuery.dataUpdatedAt !== syncedAt && adminQuery.data) {
    setSyncedAt(adminQuery.dataUpdatedAt);
    setFields(adminQuery.data.fields);
    setCatalog(adminQuery.data.catalog);
    setSavedCatalog(adminQuery.data.catalog);
  }

  const reload = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: customFieldsAdminQueryKey });
  }, [queryClient]);

  const loading = adminQuery.isPending && !adminQuery.data;

  const ticketFields = useMemo(
    () =>
      fields
        .filter((f) => f.group === "ticket")
        .sort((a, b) => a.position - b.position),
    [fields],
  );

  const contactFields = useMemo(
    () =>
      fields
        .filter((f) => f.group === "contact")
        .sort((a, b) => a.position - b.position),
    [fields],
  );

  const coreCatalog = useMemo(
    () => catalog.filter((entry) => entry.kind === "core"),
    [catalog],
  );

  const customCatalog = useMemo(
    () => catalog.filter((entry) => entry.kind === "custom"),
    [catalog],
  );

  const visibilityDirty = useMemo(
    () => JSON.stringify(catalog) !== JSON.stringify(savedCatalog),
    [catalog, savedCatalog],
  );

  function updateCatalogEntry(
    id: string,
    patch: Partial<Pick<TicketFieldCatalogEntry, "showOnCard" | "showInTicket">>,
  ) {
    setCatalog((current) =>
      current.map((entry) =>
        entry.id === id ? { ...entry, ...patch } : entry,
      ),
    );
  }

  async function saveVisibility() {
    setSavingVisibility(true);
    try {
      const ticket_field_visibility = buildVisibilityPatch(catalog);
      const settings = await apiFetch<SettingsWithLayout>("/api/v1/settings", {
        method: "PATCH",
        body: JSON.stringify({ ticket_field_visibility }),
      });
      const nextCatalog = settings.ticket_field_layout?.catalog ?? catalog;
      setCatalog(nextCatalog);
      setSavedCatalog(nextCatalog);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save visibility");
    } finally {
      setSavingVisibility(false);
    }
  }

  function openCreate(group: CustomFieldGroup) {
    setDialogMode("create");
    setDialogGroup(group);
    setEditingField(null);
    setDialogOpen(true);
  }

  function openEdit(field: FieldRow) {
    setDialogMode("edit");
    setDialogGroup(field.group);
    setEditingField(field);
    setDialogOpen(true);
  }

  async function handleReorder(group: CustomFieldGroup, orderedIds: string[]) {
    const previous = fields;
    const byId = new Map(fields.map((f) => [f.id, f]));
    const reordered = orderedIds
      .map((id, position) => {
        const field = byId.get(id);
        return field ? { ...field, position } : null;
      })
      .filter((f): f is FieldRow => f !== null);
    const other = fields.filter((f) => f.group !== group);
    setFields([...other, ...reordered]);

    try {
      const updated = await apiFetch<FieldRow[]>("/api/v1/custom-fields/reorder", {
        method: "PUT",
        body: JSON.stringify({ group, ids: orderedIds }),
      });
      setFields((current) => [
        ...current.filter((f) => f.group !== group),
        ...updated,
      ]);
      setError(null);
    } catch (e) {
      setFields(previous);
      setError(e instanceof Error ? e.message : "Failed to reorder fields");
    }
  }

  async function handleDialogSubmit(values: CustomFieldFormValues) {
    setSaving(true);
    try {
      if (dialogMode === "create") {
        const created = await apiFetch<FieldRow>("/api/v1/custom-fields", {
          method: "POST",
          body: JSON.stringify({
            group: values.group,
            key: values.key,
            label: values.label,
            type: values.type,
            required: values.required,
            options: values.options,
            position: fields.filter((f) => f.group === values.group).length,
          }),
        });
        setFields((current) => [...current, created]);
        reload();
      } else if (editingField) {
        const updated = await apiFetch<FieldRow>(
          `/api/v1/custom-fields/${editingField.id}`,
          {
            method: "PATCH",
            body: JSON.stringify({
              label: values.label,
              type: values.type,
              required: values.required,
              options: values.options,
            }),
          },
        );
        setFields((current) =>
          current.map((f) => (f.id === editingField.id ? updated : f)),
        );
        reload();
      }
      setError(null);
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiFetch(`/api/v1/custom-fields/${deleteTarget.id}`, {
        method: "DELETE",
      });
      setFields((current) => current.filter((f) => f.id !== deleteTarget.id));
      setDeleteTarget(null);
      reload();
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete field");
    } finally {
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Ticket fields</CardTitle>
          </CardHeader>
          <CardContent>
            <Skeleton className="h-16 w-full" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Contact fields</CardTitle>
          </CardHeader>
          <CardContent>
            <Skeleton className="h-16 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Ticket fields</CardTitle>
        </CardHeader>
        <CardContent>
          <TicketFieldVisibilitySection
            coreEntries={coreCatalog}
            customEntries={customCatalog}
            fields={ticketFields}
            onVisibilityChange={updateCatalogEntry}
            onReorder={handleReorder}
            onEdit={openEdit}
            onDelete={setDeleteTarget}
            onAdd={openCreate}
            onSaveVisibility={saveVisibility}
            savingVisibility={savingVisibility}
            visibilityDirty={visibilityDirty}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Contact fields</CardTitle>
        </CardHeader>
        <CardContent>
          <ContactCustomFieldsList
            fields={contactFields}
            onReorder={handleReorder}
            onEdit={openEdit}
            onDelete={setDeleteTarget}
            onAdd={openCreate}
          />
        </CardContent>
      </Card>

      <CustomFieldDefinitionDialog
        open={dialogOpen}
        mode={dialogMode}
        initialGroup={dialogGroup}
        field={editingField}
        saving={saving}
        onOpenChange={setDialogOpen}
        onSubmit={handleDialogSubmit}
      />

      {deleteTarget && (
        <DeleteCustomFieldDialog
          field={deleteTarget}
          deleting={deleting}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => void confirmDelete()}
        />
      )}
    </div>
  );
}
