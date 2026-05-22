import { z } from "zod";

export const boardSortSchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("updated_at"),
    direction: z.enum(["asc", "desc"]),
  }),
  z.object({
    mode: z.literal("created_at"),
    direction: z.enum(["asc", "desc"]),
  }),
  z.object({
    mode: z.literal("manual"),
  }),
]);

export type BoardSort = z.infer<typeof boardSortSchema>;

export const DEFAULT_BOARD_SORT: BoardSort = {
  mode: "updated_at",
  direction: "desc",
};

export const BOARD_SORT_OPTIONS: BoardSort[] = [
  { mode: "updated_at", direction: "desc" },
  { mode: "updated_at", direction: "asc" },
  { mode: "created_at", direction: "desc" },
  { mode: "created_at", direction: "asc" },
  { mode: "manual" },
];

export function normalizeBoardSort(raw: unknown): BoardSort {
  return boardSortSchema.parse(raw);
}

export function serializeBoardSort(sort: BoardSort): string {
  return JSON.stringify(sort);
}

export function boardSortsEqual(a: BoardSort, b: BoardSort): boolean {
  return serializeBoardSort(a) === serializeBoardSort(b);
}

export function formatBoardSortLabel(sort: BoardSort): string {
  switch (sort.mode) {
    case "updated_at":
      return sort.direction === "desc"
        ? "Last edited (newest)"
        : "Last edited (oldest)";
    case "created_at":
      return sort.direction === "desc"
        ? "Created (newest)"
        : "Created (oldest)";
    case "manual":
      return "Custom";
    default:
      return "Sort";
  }
}
