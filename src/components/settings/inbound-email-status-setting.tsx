"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api-client";
import {
  adminSettingsQueryKey,
  useAdminSettings,
} from "@/hooks/use-admin-settings";
import { useStatuses } from "@/hooks/use-statuses";

type StatusOption = {
  id: string;
  name: string;
  color: string;
  position: number;
};

export function InboundEmailStatusSetting() {
  const queryClient = useQueryClient();
  const statusesQuery = useStatuses<StatusOption>();
  const settingsQuery = useAdminSettings(true);
  const [error, setError] = useState<string | null>(null);
  const [overrideInboundStatusId, setOverrideInboundStatusId] = useState<
    string | null
  >(null);

  const statuses = statusesQuery.data ?? [];
  const defaultInboundStatusId =
    overrideInboundStatusId ??
    settingsQuery.data?.default_inbound_status_id ??
    null;
  const loading = statusesQuery.isPending || settingsQuery.isPending;

  const resolvedInboundStatusId =
    defaultInboundStatusId &&
    statuses.some((s) => s.id === defaultInboundStatusId)
      ? defaultInboundStatusId
      : (statuses[0]?.id ?? "");

  if (loading) {
    return <Skeleton className="h-9 w-full" />;
  }

  return (
    <div className="space-y-3">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-2">
        <Label htmlFor="default-inbound-status">Starting status</Label>
        <Select
          value={resolvedInboundStatusId}
          onValueChange={async (value) => {
            const previous = defaultInboundStatusId;
            setOverrideInboundStatusId(value);
            try {
              await apiFetch("/api/v1/settings", {
                method: "PATCH",
                body: JSON.stringify({ default_inbound_status_id: value }),
              });
              setOverrideInboundStatusId(null);
              void queryClient.invalidateQueries({
                queryKey: adminSettingsQueryKey,
              });
              setError(null);
            } catch (e) {
              setOverrideInboundStatusId(previous);
              setError(
                e instanceof Error
                  ? e.message
                  : "Failed to update inbound email status",
              );
            }
          }}
        >
          <SelectTrigger id="default-inbound-status" className="w-full">
            <SelectValue placeholder="Choose a status" />
          </SelectTrigger>
          <SelectContent>
            {statuses.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                <span className="flex items-center gap-2">
                  <span
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: s.color }}
                  />
                  {s.name}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
