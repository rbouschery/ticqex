const STORAGE_KEY = "ticqex.board.lastLaneCount.v1";
const DEFAULT_LANE_COUNT = 3;
const MAX_LANE_COUNT = 24;

function clampLaneCount(count: number): number {
  if (!Number.isFinite(count)) return DEFAULT_LANE_COUNT;
  return Math.max(1, Math.min(Math.floor(count), MAX_LANE_COUNT));
}

export function readLastBoardLaneCount(
  fallback = DEFAULT_LANE_COUNT,
): number {
  if (typeof window === "undefined") {
    return clampLaneCount(fallback);
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return clampLaneCount(fallback);
    const parsed = Number.parseInt(raw, 10);
    if (!Number.isFinite(parsed)) return clampLaneCount(fallback);
    return clampLaneCount(parsed);
  } catch {
    return clampLaneCount(fallback);
  }
}

export function writeLastBoardLaneCount(count: number): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, String(clampLaneCount(count)));
  } catch {
    // ignore quota / private mode errors
  }
}
