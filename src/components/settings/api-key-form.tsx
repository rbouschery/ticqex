"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

export function RevokeButton({
  id,
  name,
  keyPrefix,
  onRevoked,
  onError,
}: {
  id: string;
  name: string;
  keyPrefix: string;
  onRevoked: () => void | Promise<void>;
  onError?: (message: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [revoking, setRevoking] = useState(false);

  async function revoke() {
    setRevoking(true);
    try {
      await apiFetch(`/api/v1/api-keys/${id}`, { method: "DELETE" });
      await onRevoked();
      onError?.(null);
      setOpen(false);
    } catch (err) {
      onError?.(err instanceof Error ? err.message : "Failed to revoke API key");
    } finally {
      setRevoking(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!revoking) setOpen(nextOpen);
      }}
    >
      <Button
        type="button"
        variant="destructive"
        size="xs"
        onClick={() => setOpen(true)}
      >
        Revoke
      </Button>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Revoke &ldquo;{name}&rdquo;?</DialogTitle>
          <DialogDescription>
            This will permanently revoke API key {keyPrefix}…. Any integrations
            using this key will stop working immediately.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={revoking}
            onClick={() => setOpen(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={revoking}
            onClick={() => void revoke()}
          >
            {revoking ? "Revoking…" : "Revoke key"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
