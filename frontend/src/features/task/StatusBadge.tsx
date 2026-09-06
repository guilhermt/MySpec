import { StatusDot } from "@/features/task/StatusDot";
import { taskStatusLabel } from "@/features/task/status";
import { cn } from "@/lib/utils";
import type { TaskSummary } from "@/lib/wails";

export interface StatusBadgeProps {
  task: TaskSummary;
  className?: string;
}

export function StatusBadge({ task, className }: StatusBadgeProps) {
  return (
    <span
      aria-live="polite"
      role="status"
      className={cn("flex items-center gap-1.5 text-xs text-muted-foreground", className)}
    >
      <StatusDot task={task} />
      {taskStatusLabel(task)}
    </span>
  );
}
