"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { apiFetch } from "@/lib/api-client";

export type CurrentUser = {
  username: string;
  email: string;
  role: string;
};

type UserStore = {
  user: CurrentUser | null;
  loaded: boolean;
};

let store: UserStore = { user: null, loaded: false };
let inflight: Promise<void> | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): UserStore {
  return store;
}

const serverSnapshot: UserStore = { user: null, loaded: false };

function getServerSnapshot(): UserStore {
  return serverSnapshot;
}

function ensureLoaded() {
  if (store.loaded || inflight) return inflight;

  inflight = apiFetch<CurrentUser>("/api/v1/users/me")
    .then((user) => {
      store = { user, loaded: true };
    })
    .catch(() => {
      store = { user: null, loaded: true };
    })
    .finally(() => {
      inflight = null;
      emit();
    });

  return inflight;
}

export function invalidateCurrentUser() {
  store = { user: null, loaded: false };
  inflight = null;
  emit();
  void ensureLoaded();
}

export function useCurrentUser() {
  const { user, loaded } = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  useEffect(() => {
    void ensureLoaded();
  }, []);

  const reload = useCallback(() => {
    store = { user: null, loaded: false };
    inflight = null;
    emit();
    void ensureLoaded();
  }, []);

  return { user, loading: !loaded, reload };
}
