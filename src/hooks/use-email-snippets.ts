"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { apiFetch } from "@/lib/api-client";
import type { EmailSnippet } from "@/components/board/types";

type SnippetsStore = {
  snippets: EmailSnippet[];
  loaded: boolean;
};

let store: SnippetsStore = { snippets: [], loaded: false };
let inflight: Promise<void> | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): SnippetsStore {
  return store;
}

function getServerSnapshot(): SnippetsStore {
  return { snippets: [], loaded: false };
}

function ensureLoaded() {
  if (store.loaded || inflight) return inflight;

  inflight = apiFetch<EmailSnippet[]>("/api/v1/email-snippets")
    .then((snippets) => {
      store = { snippets, loaded: true };
    })
    .catch(() => {
      store = { snippets: [], loaded: true };
    })
    .finally(() => {
      inflight = null;
      emit();
    });

  return inflight;
}

export function invalidateEmailSnippets() {
  store = { snippets: [], loaded: false };
  inflight = null;
  emit();
  void ensureLoaded();
}

export function useEmailSnippets() {
  const { snippets, loaded } = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  useEffect(() => {
    void ensureLoaded();
  }, []);

  const reload = useCallback(() => {
    store = { snippets: [], loaded: false };
    inflight = null;
    emit();
    void ensureLoaded();
  }, []);

  return { snippets, loading: !loaded, reload };
}
