import type { BoardSort } from "./schema";

export type BoardSortableTicket = {
  id: string;
  created_at: string;
  updated_at: string;
};

export function sortBoardTickets<T extends BoardSortableTicket>(
  tickets: T[],
  sort: BoardSort,
  manualOrder?: string[],
): T[] {
  if (sort.mode === "manual") {
    const order = manualOrder ?? [];
    const index = new Map(order.map((id, i) => [id, i]));
    const tail = order.length;
    return [...tickets].sort((a, b) => {
      const ia = index.has(a.id) ? index.get(a.id)! : tail;
      const ib = index.has(b.id) ? index.get(b.id)! : tail;
      if (ia !== ib) return ia - ib;
      return b.updated_at.localeCompare(a.updated_at);
    });
  }

  const field = sort.mode;
  const asc = sort.direction === "asc";
  return [...tickets].sort((a, b) => {
    const cmp = a[field].localeCompare(b[field]);
    return asc ? cmp : -cmp;
  });
}
