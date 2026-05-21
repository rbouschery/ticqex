"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/api-client";

export function TagForm({ onCreated }: { onCreated: () => void }) {
  const [name, setName] = useState("");
  return (
    <form
      className="flex gap-2"
      onSubmit={async (e) => {
        e.preventDefault();
        await apiFetch("/api/v1/tags", {
          method: "POST",
          body: JSON.stringify({ name }),
        });
        setName("");
        onCreated();
      }}
    >
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="New tag"
        className="flex-1"
      />
      <Button type="submit" size="sm">
        Add
      </Button>
    </form>
  );
}
