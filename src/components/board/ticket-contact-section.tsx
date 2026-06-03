"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { usePersistedExpanded } from "@/hooks/use-persisted-expanded";
import {
  useContactCustomFieldDefinitions,
  useContactDetail,
  type ContactCustomFieldDefinition,
  type ContactDetail,
} from "@/hooks/use-contact-detail";

type CustomFieldRow = {
  def: ContactCustomFieldDefinition;
  value: unknown;
};

function contactInitials(name: string): string {
  const parts = name.trim().split(/[\s@._-]+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function hasCustomFieldValue(value: unknown): boolean {
  return value !== null && value !== undefined && value !== "";
}

function buildCustomFieldRows(
  definitions: ContactCustomFieldDefinition[],
  values: Record<string, unknown>,
): CustomFieldRow[] {
  return [...definitions]
    .sort((a, b) => a.position - b.position)
    .map((def) => ({
      def,
      value: values[def.key],
    }));
}

function formatCustomFieldValue(type: string, value: unknown): string {
  if (!hasCustomFieldValue(value)) return "—";

  switch (type) {
    case "boolean":
      return value ? "Yes" : "No";
    case "date":
      return formatDate(String(value));
    case "json":
      return typeof value === "string" ? value : JSON.stringify(value);
    case "multiselect":
      return Array.isArray(value) ? value.join(", ") : String(value);
    default:
      return String(value);
  }
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
  const { expanded, toggleExpanded, hydrated } = usePersistedExpanded(
    "ticqex.ticket-contact.expanded.v1",
    false,
  );
  const [showAllFields, setShowAllFields] = useState(false);

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
    if (expanded) setShowAllFields(false);
    toggleExpanded();
  };

  const showContactAddress =
    contactAddress &&
    contactAddress.trim().toLowerCase() !== displayName.trim().toLowerCase();

  const fieldRows = useMemo(
    () => buildCustomFieldRows(definitions, detail?.custom_fields ?? {}),
    [definitions, detail?.custom_fields],
  );

  const populatedFieldCount = fieldRows.filter(({ value }) =>
    hasCustomFieldValue(value),
  ).length;

  const visibleFieldRows =
    expanded && showAllFields
      ? fieldRows
      : fieldRows.filter(({ value }) => hasCustomFieldValue(value));

  const hasHiddenFields = definitions.length > populatedFieldCount;

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
              </div>

              <dl className="space-y-1.5 text-xs">
                {showContactAddress && (
                  <div className="grid grid-cols-[minmax(5.5rem,8rem)_1fr] gap-x-2">
                    <dt className="text-muted-foreground">Email</dt>
                    <dd className="break-all text-foreground">{contactAddress}</dd>
                  </div>
                )}
                <div className="grid grid-cols-[minmax(5.5rem,8rem)_1fr] gap-x-2">
                  <dt className="text-muted-foreground">Tickets</dt>
                  <dd className="text-foreground">{detail.ticket_count}</dd>
                </div>
                <div className="grid grid-cols-[minmax(5.5rem,8rem)_1fr] gap-x-2">
                  <dt className="text-muted-foreground">Member since</dt>
                  <dd className="text-foreground">
                    {formatDate(detail.created_at)}
                  </dd>
                </div>
                {visibleFieldRows.map(({ def, value }) => (
                  <div
                    key={def.id}
                    className="grid grid-cols-[minmax(5.5rem,8rem)_1fr] gap-x-2"
                  >
                    <dt className="truncate text-muted-foreground">{def.label}</dt>
                    <dd className="break-all text-foreground">
                      {formatCustomFieldValue(def.type, value)}
                    </dd>
                  </div>
                ))}
              </dl>

              {hasHiddenFields && (
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
