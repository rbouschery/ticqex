"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { adminSettingsQueryKey } from "@/hooks/use-admin-settings";
import {
  ticketThreadOrderQueryKey,
  useTicketThreadOrder,
} from "@/hooks/use-ticket-reference-data";

export type EmailThreadOrder = "oldest_first" | "newest_first";

const OPTIONS = [
  {
    value: "oldest_first" as const,
    label: "Oldest at top",
    description: "Chat-style — newest at the bottom, scroll down to read latest",
  },
  {
    value: "newest_first" as const,
    label: "Newest at top",
    description: "Inbox-style — newest at the top, scroll up for history",
  },
];

export function EmailThreadOrderSetting() {
  const queryClient = useQueryClient();
  const threadOrderQuery = useTicketThreadOrder();
  const [orderOverride, setOrderOverride] = useState<EmailThreadOrder | null>(
    null,
  );
  const [saving, setSaving] = useState(false);

  const order = orderOverride ?? threadOrderQuery.data ?? null;

  if (threadOrderQuery.isPending && order === null) {
    return <Skeleton className="h-9 w-full max-w-md" />;
  }

  const resolvedOrder = order ?? "oldest_first";

  return (
    <Card>
      <CardHeader>
        <CardTitle>Email thread order</CardTitle>
        <CardDescription>
          How messages are sorted in the ticket conversation view.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        <Label htmlFor="email-thread-order">Message order</Label>
        <Select
          value={resolvedOrder}
          onValueChange={async (value: EmailThreadOrder) => {
            const previous = resolvedOrder;
            setOrderOverride(value);
            setSaving(true);
            try {
              await apiFetch("/api/v1/settings", {
                method: "PATCH",
                body: JSON.stringify({ email_thread_order: value }),
              });
              setOrderOverride(null);
              void queryClient.invalidateQueries({
                queryKey: ticketThreadOrderQueryKey,
              });
              void queryClient.invalidateQueries({
                queryKey: adminSettingsQueryKey,
              });
            } catch {
              setOrderOverride(previous);
            } finally {
              setSaving(false);
            }
          }}
          disabled={saving}
        >
          <SelectTrigger id="email-thread-order" className="w-full max-w-md">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          {OPTIONS.find((o) => o.value === resolvedOrder)?.description}
        </p>
      </CardContent>
    </Card>
  );
}
