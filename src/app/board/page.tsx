import { AppShell } from "@/components/layout/app-shell";
import { KanbanBoard } from "@/components/board/kanban-board";

export default function BoardPage() {
  return (
    <AppShell>
      <KanbanBoard />
    </AppShell>
  );
}
