"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch } from "@/lib/api-client";

export function EmailSignatureForm({
  signature,
  onSaved,
}: {
  signature: string;
  onSaved: () => void;
}) {
  const [value, setValue] = useState(signature);

  return (
    <form
      className="space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        await apiFetch("/api/v1/settings", {
          method: "PATCH",
          body: JSON.stringify({ email_signature: value }),
        });
        onSaved();
      }}
    >
      <Textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        rows={5}
        placeholder={"Best regards,\nSupport Team"}
        className="font-mono"
      />
      <Button type="submit" size="sm">
        Save email signature
      </Button>
    </form>
  );
}
