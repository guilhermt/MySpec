import { Badge } from "@/components/ui/badge";
import { ContextGauge } from "@/features/task/ContextGauge";
import { StatusDot } from "@/features/task/StatusDot";
import { taskStatusLabel } from "@/features/task/status";
import type { TaskSummary } from "@/lib/wails";
import { asTaskStage } from "@/lib/wails";
import { useAppStore } from "@/store/app-store";

function stageLabel(task: TaskSummary): string {
  return asTaskStage(task.stage) === "prd_done" ? "PRD done" : "PRD";
}

export interface TaskListProps {
  tasks: readonly TaskSummary[];
}

export function TaskList({ tasks }: TaskListProps) {
  const openTask = useAppStore((state) => state.openTask);

  return (
    <ul className="flex flex-col">
      {tasks.map((task) => (
        <li key={task.id}>
          <button
            type="button"
            onClick={() => openTask(task.id)}
            className="flex h-10 w-full items-center gap-2 rounded-md px-2 text-left outline-none transition-colors duration-[var(--duration-fast)] hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
          >
            <StatusDot task={task} />
            <span className="min-w-0 truncate font-medium">{task.name}</span>
            <Badge variant="secondary">{stageLabel(task)}</Badge>
            <span className="flex-1" />
            <ContextGauge percent={task.contextPercent} />
            <span className="shrink-0 text-xs text-muted-foreground">{taskStatusLabel(task)}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
