export * from "@shared/board-sort";

import { ApiError } from "@server/lib/errors";
import {
  DEFAULT_BOARD_SORT,
  normalizeBoardSort,
  boardSortSchema,
  type BoardSort,
} from "@shared/board-sort";

export function parseBoardSortParam(raw: string | null): BoardSort {
  if (!raw || raw.trim() === "") return DEFAULT_BOARD_SORT;
  try {
    const parsed = JSON.parse(raw) as unknown;
    return normalizeBoardSort(boardSortSchema.parse(parsed));
  } catch {
    throw ApiError.badRequest("Invalid sort parameter");
  }
}
