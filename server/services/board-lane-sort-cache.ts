/** Reuse sorted lane IDs across load-more requests within a warm instance. */
export const LANE_SORT_CACHE_TTL_MS = 30_000;

const laneSortCache = new Map<
  string,
  { ids: string[]; expiresAt: number }
>();

export function getLaneSortCacheEntry(key: string) {
  const cached = laneSortCache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.ids;
  }
  laneSortCache.delete(key);
  return null;
}

export function setLaneSortCacheEntry(key: string, ids: string[]) {
  laneSortCache.set(key, { ids, expiresAt: Date.now() + LANE_SORT_CACHE_TTL_MS });
}

/** Drop cached lane sorts after ticket status or lane membership changes. */
export function invalidateLaneSortCache(statusIds?: string[]) {
  if (!statusIds?.length) {
    laneSortCache.clear();
    return;
  }
  for (const key of laneSortCache.keys()) {
    if (statusIds.some((statusId) => key.startsWith(`${statusId}:`))) {
      laneSortCache.delete(key);
    }
  }
}
