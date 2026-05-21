"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { apiFetch, apiFetchText } from "@/lib/api-client";
import type { TicketDetail } from "./types";

type StaffUser = { id: string; username: string };
export function TicketModal({
  ticketId,
  onClose,
  onBoardChange,
}: {
  ticketId: string;
  onClose: () => void;
  onBoardChange: () => void;
}) {
  const [ticket, setTicket] = useState<TicketDetail | null>(null);
  const [users, setUsers] = useState<StaffUser[]>([]);
  const [reply, setReply] = useState("");
  const [internal, setInternal] = useState(false);
  const [title, setTitle] = useState("");
  const [assigneeId, setAssigneeId] = useState<string>("");
  const [tagInput, setTagInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [t, staff] = await Promise.all([
        apiFetch<TicketDetail>(`/api/v1/tickets/${ticketId}`),
        apiFetch<StaffUser[]>("/api/v1/users"),
      ]);
      setTicket(t);
      setTitle(t.title);
      setAssigneeId(t.assignee_id ?? "");
      setTagInput(t.tags.map((x) => x.name).join(", "));
      setUsers(staff);
      await apiFetch(`/api/v1/tickets/${ticketId}/read`, { method: "POST" });
      setTicket((prev) =>
        prev
          ? {
              ...prev,
              unread_count: 0,
              messages: prev.messages.map((msg) =>
                msg.author_type === "customer" ? { ...msg, read: true } : msg,
              ),
            }
          : prev,
      );
      onBoardChange();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load ticket");
    } finally {
      setLoading(false);
    }
  }, [ticketId, onBoardChange]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load ticket on open
    void load();
  }, [load]);

  async function saveMeta() {
    if (!ticket) return;
    setSaving(true);
    setError(null);
    try {
      const tags = tagInput
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      await apiFetch(`/api/v1/tickets/${ticketId}`, {
        method: "PATCH",
        body: JSON.stringify({
          title,
          assignee_id: assigneeId || null,
          tags,
        }),
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function sendReply(e: FormEvent) {
    e.preventDefault();
    if (!reply.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await apiFetch(`/api/v1/tickets/${ticketId}/messages`, {
        method: "POST",
        body: JSON.stringify({
          body: reply,
          visibility: internal ? "internal" : "public",
          channel: "admin",
        }),
      });
      setReply("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reply failed");
    } finally {
      setSaving(false);
    }
  }

  async function copyContext(excludeInternal: boolean) {
    const q = excludeInternal ? "?exclude_internal=true" : "";
    const text = await apiFetchText(`/api/v1/tickets/${ticketId}/context${q}`);
    await navigator.clipboard.writeText(text);
  }

  async function toggleMessageRead(messageId: string) {
    try {
      const result = await apiFetch<{ read: boolean }>(
        `/api/v1/tickets/${ticketId}/messages/${messageId}/read`,
        { method: "PATCH" },
      );
      setTicket((prev) =>
        prev
          ? {
              ...prev,
              messages: prev.messages.map((msg) =>
                msg.id === messageId ? { ...msg, read: result.read } : msg,
              ),
            }
          : prev,
      );
      onBoardChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update read state");
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-xl bg-white shadow-xl dark:bg-zinc-900">
        <header className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
          <h2 className="font-semibold text-zinc-900 dark:text-zinc-50">
            Ticket
          </h2>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => copyContext(false)}
              className="text-xs text-indigo-600 hover:underline"
            >
              Copy context
            </button>
            <button
              type="button"
              onClick={onClose}
              className="text-sm text-zinc-500 hover:text-zinc-800"
            >
              Close
            </button>
          </div>
        </header>

        {loading && (
          <p className="p-6 text-sm text-zinc-500">Loading…</p>
        )}

        {!loading && ticket && (
          <div className="flex flex-1 flex-col overflow-hidden">
            <div className="space-y-3 border-b border-zinc-200 p-4 dark:border-zinc-800">
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-950"
              />
              <div className="flex flex-wrap gap-2 text-sm">
                <span className="text-zinc-500">
                  Customer: {ticket.customer?.username}
                </span>
                <span className="text-zinc-500">Status: {ticket.status?.name}</span>
              </div>
              <label className="block text-xs text-zinc-500">
                Assignee
                <select
                  value={assigneeId}
                  onChange={(e) => setAssigneeId(e.target.value)}
                  className="mt-1 block w-full rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                >
                  <option value="">Unassigned</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.username}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs text-zinc-500">
                Tags (comma-separated)
                <input
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  className="mt-1 block w-full rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                />
              </label>
              <button
                type="button"
                disabled={saving}
                onClick={() => void saveMeta()}
                className="rounded bg-zinc-800 px-3 py-1 text-xs text-white disabled:opacity-50"
              >
                Save details
              </button>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto p-4">
              {ticket.messages.map((msg) => {
                const isIncoming = msg.author_type === "customer";
                const isUnread = isIncoming && msg.read === false;

                return (
                  <div
                    key={msg.id}
                    role={isIncoming ? "button" : undefined}
                    tabIndex={isIncoming ? 0 : undefined}
                    onClick={
                      isIncoming
                        ? () => void toggleMessageRead(msg.id)
                        : undefined
                    }
                    onKeyDown={
                      isIncoming
                        ? (e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              void toggleMessageRead(msg.id);
                            }
                          }
                        : undefined
                    }
                    className={`rounded-lg p-3 text-sm ${
                      msg.visibility === "internal"
                        ? "border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40"
                        : isUnread
                          ? "border border-indigo-200 bg-indigo-50/80 dark:border-indigo-900 dark:bg-indigo-950/30"
                          : "bg-zinc-50 dark:bg-zinc-800/50"
                    } ${isIncoming ? "cursor-pointer hover:ring-1 hover:ring-indigo-300 dark:hover:ring-indigo-700" : ""}`}
                  >
                    <div className="mb-1 flex justify-between text-xs text-zinc-500">
                      <span className="flex items-center gap-1.5">
                        {isIncoming && (
                          <span
                            className={`inline-block h-2 w-2 shrink-0 rounded-full ${
                              isUnread ? "bg-indigo-600" : "bg-zinc-300 dark:bg-zinc-600"
                            }`}
                            aria-hidden="true"
                          />
                        )}
                        <span>
                          {msg.author_type}
                          {msg.visibility === "internal" && " · internal"}
                          {isIncoming && (isUnread ? " · unread" : " · read")}
                        </span>
                      </span>
                      <time dateTime={msg.created_at}>
                        {new Date(msg.created_at).toLocaleString()}
                      </time>
                    </div>
                    <p
                      className={`whitespace-pre-wrap text-zinc-800 dark:text-zinc-200 ${
                        isUnread ? "font-medium" : ""
                      }`}
                    >
                      {msg.body}
                    </p>
                  </div>
                );
              })}
            </div>

            <form
              onSubmit={sendReply}
              className="border-t border-zinc-200 p-4 dark:border-zinc-800"
            >
              <textarea
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                rows={3}
                placeholder="Write a reply…"
                className="w-full rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-950"
              />
              <div className="mt-2 flex items-center justify-between">
                <label className="flex items-center gap-2 text-xs text-zinc-600">
                  <input
                    type="checkbox"
                    checked={internal}
                    onChange={(e) => setInternal(e.target.checked)}
                  />
                  Internal note
                </label>
                <button
                  type="submit"
                  disabled={saving || !reply.trim()}
                  className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm text-white disabled:opacity-50"
                >
                  Send
                </button>
              </div>
            </form>
          </div>
        )}

        {error && (
          <p className="px-4 pb-3 text-sm text-red-600" role="alert">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}

