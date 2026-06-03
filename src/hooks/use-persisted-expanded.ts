"use client";

import { useCallback, useState } from "react";
import { useCurrentUser } from "@/hooks/use-current-user";

function storageKey(prefix: string, userEmail: string) {
  return `${prefix}:${userEmail}`;
}

function readExpanded(
  prefix: string,
  userEmail: string,
  defaultExpanded: boolean,
): boolean {
  if (typeof window === "undefined") return defaultExpanded;
  try {
    const raw = localStorage.getItem(storageKey(prefix, userEmail));
    if (raw === null) return defaultExpanded;
    return raw === "true";
  } catch {
    return defaultExpanded;
  }
}

function writeExpanded(prefix: string, userEmail: string, expanded: boolean) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(storageKey(prefix, userEmail), String(expanded));
  } catch {
    // ignore quota / private mode errors
  }
}

export function usePersistedExpanded(prefix: string, defaultExpanded: boolean) {
  const { user, loading } = useCurrentUser();
  const userEmail = user?.email ?? null;
  const hydrationKey = loading ? "loading" : (userEmail ?? "anonymous");

  const [expanded, setExpanded] = useState(defaultExpanded);
  const [hydratedKey, setHydratedKey] = useState<string | null>(null);

  if (!loading && hydrationKey !== hydratedKey) {
    setHydratedKey(hydrationKey);
    setExpanded(
      userEmail
        ? readExpanded(prefix, userEmail, defaultExpanded)
        : defaultExpanded,
    );
  }

  const hydrated = !loading && hydratedKey === hydrationKey;

  const toggleExpanded = useCallback(() => {
    setExpanded((prev) => {
      const next = !prev;
      if (userEmail) writeExpanded(prefix, userEmail, next);
      return next;
    });
  }, [prefix, userEmail]);

  return { expanded, toggleExpanded, hydrated };
}
