"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch } from "@/lib/api-client";
import { useEmailSnippets } from "@/hooks/use-email-snippets";

export function EmailSnippetsSection() {
  const { snippets, reload } = useEmailSnippets();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  return (
    <div className="space-y-4">
      <ul className="space-y-2">
        {snippets.map((snippet) => (
          <li
            key={snippet.id}
            className="flex items-start justify-between gap-2 rounded-lg border border-border p-3"
          >
            <div>
              <p className="font-medium">{snippet.title}</p>
              <p className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground">
                {snippet.body.slice(0, 120)}
                {snippet.body.length > 120 ? "…" : ""}
              </p>
            </div>
            <Button
              type="button"
              variant="destructive"
              size="xs"
              onClick={async () => {
                await apiFetch(`/api/v1/email-snippets/${snippet.id}`, {
                  method: "DELETE",
                });
                await reload();
              }}
            >
              Delete
            </Button>
          </li>
        ))}
        {snippets.length === 0 && (
          <li className="text-sm text-muted-foreground">No snippets yet.</li>
        )}
      </ul>
      <form
        className="space-y-3"
        onSubmit={async (e) => {
          e.preventDefault();
          await apiFetch("/api/v1/email-snippets", {
            method: "POST",
            body: JSON.stringify({ title, body }),
          });
          setTitle("");
          setBody("");
          await reload();
        }}
      >
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Snippet title"
          required
        />
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Snippet body"
          rows={3}
          required
        />
        <Button type="submit" size="sm">
          Add snippet
        </Button>
      </form>
    </div>
  );
}
