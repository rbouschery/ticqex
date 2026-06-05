"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { UserMenu } from "@/components/layout/user-menu";
import { cn } from "@/lib/utils";

const nav = [
  { href: "/board", label: "Board" },
  { href: "/settings", label: "Settings" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden bg-background">
      <header className="z-10 shrink-0 border-b border-border bg-card">
        <div className="mx-auto flex h-14 max-w-[1600px] items-center justify-between px-4">
          <div className="flex items-center gap-6">
            <Link
              href="/board"
              className="font-heading text-lg font-semibold text-foreground"
            >
              ticqex
            </Link>
            <Separator orientation="vertical" className="h-5" />
            <nav className="flex gap-1">
              {nav.map((item) => (
                <Button
                  key={item.href}
                  variant="ghost"
                  size="sm"
                  asChild
                  className={cn(
                    pathname.startsWith(item.href) &&
                      "bg-accent text-accent-foreground",
                  )}
                >
                  <Link href={item.href}>{item.label}</Link>
                </Button>
              ))}
            </nav>
          </div>
          <UserMenu />
        </div>
      </header>
      <main className="flex min-h-0 flex-1 flex-col overflow-y-auto [scrollbar-gutter:stable]">
        {children}
      </main>
    </div>
  );
}
