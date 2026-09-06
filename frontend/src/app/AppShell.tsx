import { NodePanel } from "@/features/node-panel/NodePanel";
import { TaskView } from "@/features/task/TaskView";
import { NewTaskDialog } from "@/features/task-create/NewTaskDialog";
import { Sidebar } from "@/features/workspace/Sidebar";
import { useAppStore } from "@/store/app-store";

export function AppShell() {
  const openTaskId = useAppStore((state) => state.openTaskId);

  return (
    <div className="grid h-dvh grid-cols-[var(--sidebar-width)_minmax(0,1fr)]">
      <Sidebar />
      {openTaskId === null ? <NodePanel /> : <TaskView taskId={openTaskId} />}
      <NewTaskDialog />
    </div>
  );
}
