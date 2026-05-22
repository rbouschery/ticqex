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
import { CustomFieldForm } from "@/components/settings/custom-field-form";
import { EmailThreadOrderSetting } from "@/components/settings/email-thread-order-setting";
import { EmailSignatureForm } from "@/components/settings/email-signature-form";
import { EmailSnippetsSection } from "@/components/settings/email-snippets-section";
import { InboundEmailStatusSetting } from "@/components/settings/inbound-email-status-setting";
import { StatusColumnsSection } from "@/components/settings/status-columns-section";
import { TagForm } from "@/components/settings/tag-form";
import { ThemeSetting } from "@/components/settings/theme-setting";
import { apiFetch } from "@/lib/api-client";

type Tag = { id: string; name: string; color: string };
type CustomField = {
  id: string;
  group: string;
  key: string;
  label: string;
  type: string;
};
type Settings = {
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

/** Admin settings cards — keep skeleton count in sync with rendered sections below. */
const ADMIN_SETTINGS_SECTIONS = [
  { key: "appearance" },
  { key: "board-columns" },
  { key: "inbound-email" },
  { key: "tags" },
  { key: "custom-fields" },
  { key: "email-thread-order" },
  { key: "email-signature" },
  { key: "email-snippets" },
  { key: "api-keys" },
] as const;

function SettingsLoadingSkeleton() {
  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div className="space-y-2">
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-4 w-72" />
      </div>
      {ADMIN_SETTINGS_SECTIONS.map(({ key }) => (
        <Card key={key}>
          <CardHeader>
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-64" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-24 w-full" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function SettingsPanel() {
  const [me, setMe] = useState<Me | null>(null);
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
      const [t, f, g] = await Promise.all([
        apiFetch<Tag[]>("/api/v1/tags"),
        apiFetch<CustomField[]>("/api/v1/custom-fields"),
        apiFetch<Settings>("/api/v1/settings"),
      ]);
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
    return <SettingsLoadingSkeleton />;
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
          Manage appearance, board columns, tags, and integrations.
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <ThemeSetting />

      <EmailThreadOrderSetting />

      <Card>
        <CardHeader>
          <CardTitle>Board columns</CardTitle>
          <CardDescription>
            Drag to reorder lanes, pick colors, rename statuses, and choose
            board visibility.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <StatusColumnsSection />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>New inbound emails</CardTitle>
          <CardDescription>
            Status assigned when an email creates a new ticket. Defaults to the
            first board column in order.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <InboundEmailStatusSetting />
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
