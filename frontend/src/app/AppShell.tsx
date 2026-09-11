import { useViewedSituation } from "@/features/attention/useViewedSituation";
import { ArchivedTaskView } from "@/features/history/ArchivedTaskView";
import { HistoryPanel } from "@/features/history/HistoryPanel";
import { NodePanel } from "@/features/node-panel/NodePanel";
import { TaskView } from "@/features/task/TaskView";
import { NewTaskDialog } from "@/features/task-create/NewTaskDialog";
import { Sidebar } from "@/features/workspace/Sidebar";
import { useAppStore } from "@/store/app-store";

/** MainArea is the one screen the app is on: a task, the history, or a node. */
function MainArea() {
  const openTaskId = useAppStore((state) => state.openTaskId);
  const openArchivedId = useAppStore((state) => state.openArchivedId);
  const historyOpen = useAppStore((state) => state.historyOpen);

  if (openTaskId !== null) {
    return <TaskView taskId={openTaskId} />;
  }
  if (openArchivedId !== null) {
    return <ArchivedTaskView taskId={openArchivedId} />;
  }
  return historyOpen ? <HistoryPanel /> : <NodePanel />;
}

export function AppShell() {
  useViewedSituation();

  return (
    <div className="grid h-dvh grid-cols-[var(--sidebar-width)_minmax(0,1fr)]">
      <Sidebar />
      <MainArea />
      <NewTaskDialog />
    </div>
  );
}
