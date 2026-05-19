"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-client";

type Status = { id: string; name: string; color: string; position: number };
type Tag = { id: string; name: string; color: string };
type CustomField = {
  id: string;
  group: string;
  key: string;
  label: string;
  type: string;
};
type Settings = {
  visible_status_ids: string[];
  show_customer_on_ticket: boolean;
  show_assignee_on_ticket: boolean;
  show_body_on_ticket: boolean;
};
type ApiKey = {
  id: string;
  name: string;
  key_prefix: string;
  created_at: string;
};
type Me = { role: string };

export function SettingsPanel() {
  const [me, setMe] = useState<Me | null>(null);
  const [statuses, setStatuses] = useState<Status[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [fields, setFields] = useState<CustomField[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const user = await apiFetch<Me>("/api/v1/users/me");
      setMe(user);
      const [s, t, f, g] = await Promise.all([
        apiFetch<Status[]>("/api/v1/statuses"),
        apiFetch<Tag[]>("/api/v1/tags"),
        apiFetch<CustomField[]>("/api/v1/custom-fields"),
        apiFetch<Settings>("/api/v1/settings"),
      ]);
      setStatuses(s);
      setTags(t);
      setFields(f);
      setSettings(g);
      if (user.role === "admin") {
        setApiKeys(await apiFetch<ApiKey[]>("/api/v1/api-keys"));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load settings");
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load settings on mount
    void load();
  }, [load]);

  if (!me) {
    return <p className="p-8 text-zinc-500">Loading settings…</p>;
  }

  if (me.role !== "admin") {
    return (
      <p className="p-8 text-zinc-600">
        Settings management requires an admin account.
      </p>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-10 p-6">
      <h1 className="text-xl font-semibold">Settings</h1>
      {error && <p className="text-sm text-red-600">{error}</p>}

      <section>
        <h2 className="font-medium">Status types</h2>
        <ul className="mt-2 space-y-1 text-sm">
          {statuses.map((s) => (
            <li key={s.id} className="flex items-center gap-2">
              <span
                className="h-3 w-3 rounded-full"
                style={{ backgroundColor: s.color }}
              />
              {s.name}
            </li>
          ))}
        </ul>
        <StatusForm onCreated={load} />
      </section>

      <section>
        <h2 className="font-medium">Tags</h2>
        <TagForm onCreated={load} />
        <ul className="mt-2 flex flex-wrap gap-2">
          {tags.map((tag) => (
            <span
              key={tag.id}
              className="rounded px-2 py-0.5 text-xs text-white"
              style={{ backgroundColor: tag.color }}
            >
              {tag.name}
            </span>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="font-medium">Custom fields</h2>
        <CustomFieldForm onCreated={load} />
        <ul className="mt-2 text-sm text-zinc-600">
          {fields.map((f) => (
            <li key={f.id}>
              [{f.group}] {f.label} ({f.key}) — {f.type}
            </li>
          ))}
        </ul>
      </section>

      {settings && (
        <section>
          <h2 className="font-medium">Board visibility</h2>
          <BoardSettingsForm settings={settings} statuses={statuses} onSaved={load} />
        </section>
      )}

      <section>
        <h2 className="font-medium">API keys</h2>
        <ApiKeyForm
          onCreated={(key) => {
            setNewKey(key);
            void load();
          }}
        />
        {newKey && (
          <p className="mt-2 rounded bg-amber-50 p-2 text-xs text-amber-900">
            Copy your new key now — it won&apos;t be shown again:
            <code className="mt-1 block break-all">{newKey}</code>
          </p>
        )}
        <ul className="mt-2 text-sm">
          {apiKeys.map((k) => (
            <li key={k.id} className="flex justify-between py-1">
              <span>
                {k.name} ({k.key_prefix}…)
              </span>
              <RevokeButton id={k.id} onRevoked={load} />
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function StatusForm({ onCreated }: { onCreated: () => void }) {
  const [name, setName] = useState("");
  return (
    <form
      className="mt-2 flex gap-2"
      onSubmit={async (e) => {
        e.preventDefault();
        await apiFetch("/api/v1/statuses", {
          method: "POST",
          body: JSON.stringify({ name }),
        });
        setName("");
        onCreated();
      }}
    >
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="New status name"
        className="rounded border px-2 py-1 text-sm"
      />
      <button type="submit" className="rounded bg-indigo-600 px-2 py-1 text-xs text-white">
        Add
      </button>
    </form>
  );
}

function TagForm({ onCreated }: { onCreated: () => void }) {
  const [name, setName] = useState("");
  return (
    <form
      className="mt-2 flex gap-2"
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
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="New tag"
        className="rounded border px-2 py-1 text-sm"
      />
      <button type="submit" className="rounded bg-indigo-600 px-2 py-1 text-xs text-white">
        Add
      </button>
    </form>
  );
}

function CustomFieldForm({ onCreated }: { onCreated: () => void }) {
  const [key, setKey] = useState("");
  const [label, setLabel] = useState("");
  const [group, setGroup] = useState<"ticket" | "customer">("ticket");
  return (
    <form
      className="mt-2 flex flex-wrap gap-2"
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
      <select
        value={group}
        onChange={(e) => setGroup(e.target.value as "ticket" | "customer")}
        className="rounded border px-2 py-1 text-sm"
      >
        <option value="ticket">Ticket</option>
        <option value="customer">Customer</option>
      </select>
      <input
        value={key}
        onChange={(e) => setKey(e.target.value)}
        placeholder="key"
        className="rounded border px-2 py-1 text-sm"
      />
      <input
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        placeholder="Label"
        className="rounded border px-2 py-1 text-sm"
      />
      <button type="submit" className="rounded bg-indigo-600 px-2 py-1 text-xs text-white">
        Add field
      </button>
    </form>
  );
}

function BoardSettingsForm({
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
      className="mt-2 space-y-2 text-sm"
      onSubmit={async (e) => {
        e.preventDefault();
        await apiFetch("/api/v1/settings", {
          method: "PATCH",
          body: JSON.stringify({ visible_status_ids: visible }),
        });
        onSaved();
      }}
    >
      {statuses.map((s) => (
        <label key={s.id} className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={visible.includes(s.id)}
            onChange={(e) => {
              setVisible((prev) =>
                e.target.checked
                  ? [...prev, s.id]
                  : prev.filter((id) => id !== s.id),
              );
            }}
          />
          {s.name}
        </label>
      ))}
      <button type="submit" className="rounded bg-indigo-600 px-2 py-1 text-xs text-white">
        Save board settings
      </button>
    </form>
  );
}

function ApiKeyForm({ onCreated }: { onCreated: (key: string) => void }) {
  const [name, setName] = useState("");
  return (
    <form
      className="mt-2 flex gap-2"
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
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Key name"
        className="rounded border px-2 py-1 text-sm"
      />
      <button type="submit" className="rounded bg-indigo-600 px-2 py-1 text-xs text-white">
        Create key
      </button>
    </form>
  );
}

function RevokeButton({ id, onRevoked }: { id: string; onRevoked: () => void }) {
  return (
    <button
      type="button"
      className="text-xs text-red-600"
      onClick={async () => {
        await apiFetch(`/api/v1/api-keys/${id}`, { method: "DELETE" });
        onRevoked();
      }}
    >
      Revoke
    </button>
  );
}
