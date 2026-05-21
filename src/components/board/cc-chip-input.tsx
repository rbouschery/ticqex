"use client";

import { KeyboardEvent, useRef, useState } from "react";
import { XIcon } from "@phosphor-icons/react";
import { Badge } from "@/components/ui/badge";

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function CcChipInput({
  cc,
  onChange,
}: {
  cc: string[];
  onChange: (next: string[]) => void;
}) {
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  function addEmail(raw: string) {
    const email = raw.trim().replace(/,$/, "");
    if (!email || !isValidEmail(email) || cc.includes(email)) return;
    onChange([...cc, email]);
    setInput("");
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === "," || e.key === "Tab") {
      if (input.trim()) {
        e.preventDefault();
        addEmail(input);
      }
    } else if (e.key === "Backspace" && !input && cc.length) {
      onChange(cc.slice(0, -1));
    }
  }

  return (
    <div
      className="flex min-h-8 flex-wrap items-center gap-1 rounded-lg border border-input bg-background px-2 py-1 dark:bg-input/30"
      onClick={() => inputRef.current?.focus()}
    >
      {cc.map((email) => (
        <Badge key={email} variant="secondary" className="gap-1 pr-1">
          {email}
          <button
            type="button"
            onClick={() => onChange(cc.filter((x) => x !== email))}
            className="rounded-sm hover:bg-muted"
            aria-label={`Remove ${email}`}
          >
            <XIcon className="size-3" />
          </button>
        </Badge>
      ))}
      <input
        ref={inputRef}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={() => {
          if (input.trim()) addEmail(input);
        }}
        placeholder={cc.length ? "" : "Add CC addresses…"}
        className="min-w-32 flex-1 bg-transparent text-sm outline-none"
      />
    </div>
  );
}
