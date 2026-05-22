"use client";

import {
  BOARD_SORT_OPTIONS,
  serializeBoardSort,
  formatBoardSortLabel,
  type BoardSort,
} from "@shared/board-sort";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export function BoardSortSelect({
  sort,
  onSortChange,
  className,
}: {
  sort: BoardSort;
  onSortChange: (sort: BoardSort) => void;
  className?: string;
}) {
  const value = serializeBoardSort(sort);

  return (
    <Select
      value={value}
      onValueChange={(next) => {
        const option = BOARD_SORT_OPTIONS.find(
          (item) => serializeBoardSort(item) === next,
        );
        if (option) onSortChange(option);
      }}
    >
      <SelectTrigger size="sm" className={cn("w-[220px] shrink-0", className)}>
        <SelectValue placeholder="Sort" />
      </SelectTrigger>
      <SelectContent position="popper" align="start" sideOffset={4}>
        {BOARD_SORT_OPTIONS.map((option) => (
          <SelectItem
            key={serializeBoardSort(option)}
            value={serializeBoardSort(option)}
          >
            {formatBoardSortLabel(option)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
