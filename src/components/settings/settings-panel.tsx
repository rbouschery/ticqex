"use client";

import { useCallback, useEffect, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiKeyForm, RevokeButton } from "@/components/settings/api-key-form";
import { BoardSettingsForm } from "@/components/settings/board-settings-form";
import { CustomFieldForm } from "@/components/settings/custom-field-form";
import { EmailSignatureForm } from "@/components/settings/email-signature-form";
import { EmailSnippetsSection } from "@/components/settings/email-snippets-section";
import { StatusForm } from "@/components/settings/status-form";
import { TagForm } from "@/components/settings/tag-form";
import { ThemeSetting } from "@/components/settings/theme-setting";
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
  email_signature?: string;
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
    return (
      <div className="mx-auto max-w-3xl space-y-4 p-6">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (me.role !== "admin") {
    return (
      <div className="mx-auto max-w-3xl space-y-6 p-6">
        <div>
          <h1 className="font-heading text-xl font-semibold">Settings</h1>
          <p className="text-sm text-muted-foreground">
            Personal preferences for your account.
          </p>
        </div>
        <ThemeSetting />
        <Alert>
          <AlertDescription>
            Organization settings require an admin account.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div>
        <h1 className="font-heading text-xl font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Manage appearance, statuses, tags, board visibility, and integrations.
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <ThemeSetting />

      <Card>
        <CardHeader>
          <CardTitle>Status types</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <ul className="space-y-2 text-sm">
            {statuses.map((s) => (
              <li key={s.id} className="flex items-center gap-2">
                <span
                  className="size-3 rounded-full"
                  style={{ backgroundColor: s.color }}
                />
                {s.name}
              </li>
            ))}
          </ul>
          <StatusForm onCreated={load} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tags</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <TagForm onCreated={load} />
          <div className="flex flex-wrap gap-2">
            {tags.map((tag) => (
              <Badge
                key={tag.id}
                className="text-white"
                style={{ backgroundColor: tag.color }}
              >
                {tag.name}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Custom fields</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <CustomFieldForm onCreated={load} />
          <ul className="space-y-1 text-sm text-muted-foreground">
            {fields.map((f) => (
              <li key={f.id}>
                [{f.group}] {f.label} ({f.key}) — {f.type}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {settings && (
        <Card>
          <CardHeader>
            <CardTitle>Board visibility</CardTitle>
            <CardDescription>
              Choose which status columns appear on the support board.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <BoardSettingsForm settings={settings} statuses={statuses} onSaved={load} />
          </CardContent>
        </Card>
      )}

      {settings && (
        <Card>
          <CardHeader>
            <CardTitle>Email signature</CardTitle>
            <CardDescription>
              Appended to outbound email replies sent from the ticket view.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <EmailSignatureForm
              key={settings.email_signature ?? ""}
              signature={settings.email_signature ?? ""}
              onSaved={load}
            />
          </CardContent>
        </Card>
      )}

      {me?.role === "admin" && (
        <Card>
          <CardHeader>
            <CardTitle>Email snippets</CardTitle>
            <CardDescription>
              Canned responses available in the ticket email compose snippet picker.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <EmailSnippetsSection />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>API keys</CardTitle>
          <CardDescription>
            Programmatic access to the Ticqex API.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ApiKeyForm
            onCreated={(key) => {
              setNewKey(key);
              void load();
            }}
          />
          {newKey && (
            <Alert>
              <AlertDescription>
                Copy your new key now — it won&apos;t be shown again:
                <code className="mt-1 block break-all font-mono text-xs">
                  {newKey}
                </code>
              </AlertDescription>
            </Alert>
          )}
          <Separator />
          <ul className="space-y-2 text-sm">
            {apiKeys.map((k) => (
              <li key={k.id} className="flex items-center justify-between">
                <span>
                  {k.name} ({k.key_prefix}…)
                </span>
                <RevokeButton id={k.id} onRevoked={load} />
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
