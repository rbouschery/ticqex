import { Suspense } from "react";
import { AppShell } from "@/components/layout/app-shell";
import {
  SettingsLoadingSkeleton,
  SettingsPanel,
} from "@/components/settings/settings-panel";

export default function SettingsPage() {
  return (
    <AppShell>
      <Suspense fallback={<SettingsLoadingSkeleton />}>
        <SettingsPanel />
      </Suspense>
    </AppShell>
  );
}
