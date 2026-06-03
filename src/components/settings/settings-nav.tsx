"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { SettingsSectionDescriptor } from "@shared/settings/types";

type SettingsNavProps = {
  sections: readonly SettingsSectionDescriptor[];
  activeSectionId: string;
};

export function SettingsNav({ sections, activeSectionId }: SettingsNavProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return (
    <nav
      className="-mx-1 flex gap-0.5 overflow-x-auto px-1 pb-1 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0 lg:pb-0"
      aria-label="Settings sections"
    >
      {sections.map((section) => {
        const params = new URLSearchParams(searchParams.toString());
        params.set("section", section.id);
        const href = `${pathname}?${params.toString()}`;
        const isActive = section.id === activeSectionId;

        return (
          <Button
            key={section.id}
            variant="ghost"
            size="default"
            asChild
            className={cn(
              "h-10 shrink-0 justify-start px-3 text-base font-normal lg:w-full",
              isActive && "bg-accent font-medium text-accent-foreground",
            )}
          >
            <Link
              href={href}
              scroll={false}
              aria-current={isActive ? "page" : undefined}
            >
              {section.label}
            </Link>
          </Button>
        );
      })}
    </nav>
  );
}
