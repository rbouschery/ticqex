"use client";

import { useCallback, useEffect, useState } from "react";
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
  const [order, setOrder] = useState<EmailThreadOrder | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const settings = await apiFetch<{ email_thread_order?: EmailThreadOrder }>(
      "/api/v1/settings",
    );
    setOrder(settings.email_thread_order ?? "oldest_first");
  }, []);

  useEffect(() => {
    void load().catch(() => setOrder("oldest_first"));
  }, [load]);

  if (!order) {
    return <Skeleton className="h-9 w-full max-w-md" />;
  }

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
          value={order}
          onValueChange={async (value: EmailThreadOrder) => {
            const previous = order;
            setOrder(value);
            setSaving(true);
            try {
              await apiFetch("/api/v1/settings", {
                method: "PATCH",
                body: JSON.stringify({ email_thread_order: value }),
              });
            } catch {
              setOrder(previous);
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
          {OPTIONS.find((o) => o.value === order)?.description}
        </p>
      </CardContent>
    </Card>
  );
}
