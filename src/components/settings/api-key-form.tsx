"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/api-client";

export function ApiKeyForm({ onCreated }: { onCreated: (key: string) => void }) {
  const [name, setName] = useState("");
  return (
    <form
      className="flex gap-2"
      onSubmit={async (e) => {
        e.preventDefault();
        const res = await apiFetch<{ key: string }>("/api/v1/api-keys", {
          method: "POST",
          body: JSON.stringify({ name }),
        });
        setName("");
        onCreated(res.key);
      }}
    >
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Key name"
        className="flex-1"
      />
      <Button type="submit" size="sm">
        Create key
      </Button>
    </form>
  );
}

export function RevokeButton({ id, onRevoked }: { id: string; onRevoked: () => void }) {
  return (
    <Button
      type="button"
      variant="destructive"
      size="xs"
      onClick={async () => {
        await apiFetch(`/api/v1/api-keys/${id}`, { method: "DELETE" });
        onRevoked();
      }}
    >
      Revoke
    </Button>
  );
}
