"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiFetch } from "@/lib/api-client";

export function CustomFieldForm({ onCreated }: { onCreated: () => void }) {
  const [key, setKey] = useState("");
  const [label, setLabel] = useState("");
  const [group, setGroup] = useState<"ticket" | "customer">("ticket");
  return (
    <form
      className="flex flex-wrap gap-2"
      onSubmit={async (e) => {
        e.preventDefault();
        await apiFetch("/api/v1/custom-fields", {
          method: "POST",
          body: JSON.stringify({ group, key, label, type: "text" }),
        });
        setKey("");
        setLabel("");
        onCreated();
      }}
    >
      <Select value={group} onValueChange={(v) => setGroup(v as "ticket" | "customer")}>
        <SelectTrigger className="w-32">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="ticket">Ticket</SelectItem>
          <SelectItem value="customer">Customer</SelectItem>
        </SelectContent>
      </Select>
      <Input
        value={key}
        onChange={(e) => setKey(e.target.value)}
        placeholder="key"
        className="w-32"
      />
      <Input
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        placeholder="Label"
        className="flex-1"
      />
      <Button type="submit" size="sm">
        Add field
      </Button>
    </form>
  );
}
