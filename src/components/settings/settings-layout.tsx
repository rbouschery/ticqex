"use client";

import type { ReactNode } from "react";
import type { SettingsSectionDescriptor } from "@shared/settings/types";
import { SettingsNav } from "@/components/settings/settings-nav";

type SettingsLayoutProps = {
  sections: readonly SettingsSectionDescriptor[];
  activeSectionId: string;
  title: string;
  children: ReactNode;
};

export function SettingsLayout({
  sections,
  activeSectionId,
  title,
  children,
}: SettingsLayoutProps) {
  const activeSection = sections.find((s) => s.id === activeSectionId);

  return (
    <div className="mx-auto w-full max-w-[1600px] px-4 py-6">
      <div className="flex flex-col gap-6 lg:flex-row lg:gap-10">
        <aside className="w-full shrink-0 lg:w-52">
          <div className="lg:sticky lg:top-6">
            <h1 className="px-3 pb-4 font-heading text-xl font-semibold">
              {title}
            </h1>
            <SettingsNav
              sections={sections}
              activeSectionId={activeSectionId}
            />
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 justify-center">
          <div className="w-full max-w-3xl space-y-6">
            {activeSection ? (
              <div>
                <h2 className="font-heading text-lg font-semibold">
                  {activeSection.label}
                </h2>
                {activeSection.description ? (
                  <p className="text-sm text-muted-foreground">
                    {activeSection.description}
                  </p>
                ) : null}
              </div>
            ) : null}
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
