"use client";

import { FormEvent, useState } from "react";
import { apiFetch } from "@/lib/api-client";

export function CreateTicketModal({
  statuses,
  onClose,
  onCreated,
}: {
  statuses: { id: string; name: string }[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [title, setTitle] = useState("");
  const [customer, setCustomer] = useState("");
  const [statusId, setStatusId] = useState(statuses[0]?.id ?? "");
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await apiFetch("/api/v1/tickets", {
        method: "POST",
        body: JSON.stringify({
          title,
          customer: { username: customer },
          status_id: statusId,
          origin: "manual",
          message: body ? { body, visibility: "public", channel: "admin" } : undefined,
        }),
      });
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl dark:bg-zinc-900"
      >
        <h2 className="text-lg font-semibold">New ticket</h2>
        <div className="mt-4 space-y-3">
          <label className="block text-sm">
            Title
            <input
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1 w-full rounded border border-zinc-300 px-2 py-1 dark:border-zinc-700 dark:bg-zinc-950"
            />
          </label>
          <label className="block text-sm">
            Customer
            <input
              required
              placeholder="email or username"
              value={customer}
              onChange={(e) => setCustomer(e.target.value)}
              className="mt-1 w-full rounded border border-zinc-300 px-2 py-1 dark:border-zinc-700 dark:bg-zinc-950"
            />
          </label>
          <label className="block text-sm">
            Status
            <select
              value={statusId}
              onChange={(e) => setStatusId(e.target.value)}
              className="mt-1 w-full rounded border border-zinc-300 px-2 py-1 dark:border-zinc-700 dark:bg-zinc-950"
            >
              {statuses.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            Initial message
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={3}
              className="mt-1 w-full rounded border border-zinc-300 px-2 py-1 dark:border-zinc-700 dark:bg-zinc-950"
            />
          </label>
        </div>
        {error && (
          <p className="mt-2 text-sm text-red-600" role="alert">
            {error}
          </p>
        )}
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded px-3 py-1.5 text-sm text-zinc-600"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm text-white disabled:opacity-50"
          >
            Create
          </button>
        </div>
      </form>
    </div>
  );
}
