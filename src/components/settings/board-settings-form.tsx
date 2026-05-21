"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { apiFetch } from "@/lib/api-client";

type Status = { id: string; name: string; color: string; position: number };
type Settings = {
  visible_status_ids: string[];
  show_customer_on_ticket: boolean;
  show_assignee_on_ticket: boolean;
  show_body_on_ticket: boolean;
  email_signature?: string;
};

export function BoardSettingsForm({
  settings,
  statuses,
  onSaved,
}: {
  settings: Settings;
  statuses: Status[];
  onSaved: () => void;
}) {
  const [visible, setVisible] = useState<string[]>(settings.visible_status_ids);

  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        await apiFetch("/api/v1/settings", {
          method: "PATCH",
          body: JSON.stringify({ visible_status_ids: visible }),
        });
        onSaved();
      }}
    >
      <div className="space-y-3">
        {statuses.map((s) => (
          <div key={s.id} className="flex items-center gap-2">
            <Checkbox
              id={`status-${s.id}`}
              checked={visible.includes(s.id)}
              onCheckedChange={(checked) => {
                setVisible((prev) =>
                  checked
                    ? [...prev, s.id]
                    : prev.filter((id) => id !== s.id),
                );
              }}
            />
            <Label htmlFor={`status-${s.id}`}>{s.name}</Label>
          </div>
        ))}
      </div>
      <Button type="submit" size="sm">
        Save board settings
      </Button>
    </form>
  );
}
