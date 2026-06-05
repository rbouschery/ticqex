"use client";

import { createContext, useContext } from "react";
import type { TicketModalSeed } from "./board-ticket-seed";
import type { StatusOption } from "./ticket-status-combobox";
import type { ResolvedTicketFieldLayout } from "@shared/ticket-fields";

type BoardTicketModalContextValue = {
  statuses: StatusOption[];
  ticketFieldLayout: ResolvedTicketFieldLayout | null;
  getInitialSeed: (ticketId: string) => TicketModalSeed | undefined;
  onStatusChange: (
    ticketId: string,
    fromStatusId: string,
    toStatusId: string,
  ) => Promise<void>;
  onBoardChange: (updated?: { id: string; unread_count?: number }) => void;
  onTicketDeleted: (ticketId: string) => void;
};

const BoardTicketModalContext =
  createContext<BoardTicketModalContextValue | null>(null);

export function BoardTicketModalProvider({
  children,
  value,
}: {
  children: React.ReactNode;
  value: BoardTicketModalContextValue;
}) {
  return (
    <BoardTicketModalContext.Provider value={value}>
      {children}
    </BoardTicketModalContext.Provider>
  );
}

export function useBoardTicketModalContext() {
  const context = useContext(BoardTicketModalContext);
  if (!context) {
    throw new Error(
      "Board ticket modal routes must be rendered inside KanbanBoard.",
    );
  }
  return context;
}

export function useOptionalBoardTicketModalContext() {
  return useContext(BoardTicketModalContext);
}
