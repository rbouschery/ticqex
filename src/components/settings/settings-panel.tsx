"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { SettingsLayout } from "@/components/settings/settings-layout";
import { SettingsSectionContent } from "@/components/settings/settings-section-content";
import { ThemeSetting } from "@/components/settings/theme-setting";
import { apiFetch } from "@/lib/api-client";
import { useCurrentUser } from "@/hooks/use-current-user";
import {
  CORE_SETTINGS_SECTIONS,
  NON_ADMIN_SETTINGS_SECTIONS,
} from "@shared/settings/core-sections";
import { resolveSettingsSectionId } from "@shared/settings/resolve";
import type { SettingsSectionDescriptor } from "@shared/settings/types";

type Settings = {
  email_signature?: string;
  channels?: {
    email?: {
      enabled: boolean;
      integration: string | null;
    };
  };
  sections?: SettingsSectionDescriptor[];
};

type ApiKey = {
  id: string;
  name: string;
  key_prefix: string;
  created_at: string;
};

const SKELETON_SECTION_COUNT = CORE_SETTINGS_SECTIONS.length + 1;

export function SettingsLoadingSkeleton() {
  return (
    <div className="mx-auto w-full max-w-[1600px] px-4 py-6">
      <div className="flex flex-col gap-6 lg:flex-row lg:gap-10">
        <aside className="w-full shrink-0 space-y-1 lg:w-52">
          <Skeleton className="mb-2 h-3 w-16" />
          {Array.from({ length: SKELETON_SECTION_COUNT }, (_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </aside>
        <div className="flex min-w-0 flex-1 justify-center">
          <div className="w-full max-w-3xl space-y-6">
            <div className="space-y-2">
              <Skeleton className="h-7 w-40" />
              <Skeleton className="h-4 w-72" />
            </div>
            <Card>
              <CardHeader>
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-4 w-64" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-24 w-full" />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

function SettingsPanelBody() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user: me, loading: userLoading } = useCurrentUser();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isAdmin = me?.role === "admin";

  const load = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const g = await apiFetch<Settings>("/api/v1/settings");
      setSettings(g);
      setApiKeys(await apiFetch<ApiKey[]>("/api/v1/api-keys"));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load settings");
    }
  }, [isAdmin]);

  useEffect(() => {
    if (!isAdmin) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load admin settings on mount
    void load();
  }, [isAdmin, load]);

  const sectionParam = searchParams.get("section");

  const sections = useMemo(() => {
    if (!isAdmin) return NON_ADMIN_SETTINGS_SECTIONS;
    if (settings?.sections?.length) return settings.sections;
    return CORE_SETTINGS_SECTIONS;
  }, [isAdmin, settings?.sections]);

  const activeSectionId = useMemo(
    () => resolveSettingsSectionId(sections, sectionParam),
    [sections, sectionParam],
  );

  const activeSection = useMemo(
    () => sections.find((section) => section.id === activeSectionId) ?? null,
    [sections, activeSectionId],
  );

  useEffect(() => {
    // Before /users/me resolves, isAdmin is false and sections is appearance-only;
    // syncing early would strip ?section=board (etc.) from the URL.
    if (userLoading) return;
    // Before GET /settings, admin sections omit channel sections (e.g. email).
    if (isAdmin && settings === null) return;
    if (sections.length === 0) return;

    if (sectionParam && sections.some((section) => section.id === sectionParam)) {
      return;
    }

    const resolved = resolveSettingsSectionId(sections, sectionParam);
    if (sectionParam === resolved) return;

    const params = new URLSearchParams(searchParams.toString());
    params.set("section", resolved);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [
    userLoading,
    isAdmin,
    settings,
    sections,
    sectionParam,
    pathname,
    router,
    searchParams,
  ]);

  const copyNewKey = useCallback(async () => {
    if (!newKey) return;
    if (!navigator.clipboard) {
      const message = "Clipboard is unavailable in this browser.";
      setError(message);
      toast.error("Could not copy API key", { description: message });
      return;
    }

    try {
      await navigator.clipboard.writeText(newKey);
      setError(null);
      toast.success("API key copied");
    } catch {
      const message = "Failed to copy API key to clipboard.";
      setError(message);
      toast.error("Could not copy API key", { description: message });
    }
  }, [newKey]);

  if (userLoading || !me) {
    return <SettingsLoadingSkeleton />;
  }

  if (!isAdmin) {
    const appearance = NON_ADMIN_SETTINGS_SECTIONS[0];
    return (
      <SettingsLayout
        sections={[...NON_ADMIN_SETTINGS_SECTIONS]}
        activeSectionId={activeSectionId}
        title="Settings"
      >
        {activeSectionId === appearance.id ? <ThemeSetting /> : null}
        <Alert>
          <AlertDescription>
            Organization settings require an admin account.
          </AlertDescription>
        </Alert>
      </SettingsLayout>
    );
  }

  if (!settings || !activeSection) {
    return <SettingsLoadingSkeleton />;
  }

  return (
    <SettingsLayout
      sections={sections}
      activeSectionId={activeSectionId}
      title="Settings"
    >
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <SettingsSectionContent
        section={activeSection}
        settings={settings}
        apiKeys={apiKeys}
        newKey={newKey}
        onNewKey={setNewKey}
        onReload={() => {
          void load();
        }}
        onCopyNewKey={() => {
          void copyNewKey();
        }}
        onError={setError}
      />
    </SettingsLayout>
  );
}

export function SettingsPanel() {
  return (
    <Suspense fallback={<SettingsLoadingSkeleton />}>
      <SettingsPanelBody />
    </Suspense>
  );
}
