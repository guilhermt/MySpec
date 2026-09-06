import { type StatusTone, taskStatusLabel, taskStatusTone } from "@/features/task/status";
import { cn } from "@/lib/utils";
import type { TaskSummary } from "@/lib/wails";

// Written out so Tailwind sees every class; the tones are chosen at runtime.
const TONE_CLASS: Record<StatusTone, string> = {
  working: "bg-[var(--status-working)] animate-pulse",
  attention: "bg-[var(--status-attention)]",
  paused: "bg-[var(--status-paused)]",
  error: "bg-destructive",
  done: "bg-[var(--status-success)]",
  idle: "bg-muted-foreground",
};

export interface StatusDotProps {
  task: TaskSummary;
  /** labelled adds the status in sr-only text, for rows that do not show it. */
  labelled?: boolean;
  className?: string;
}

export function StatusDot({ task, labelled = false, className }: StatusDotProps) {
  return (
    <>
      <span
        aria-hidden="true"
        className={cn("size-2 shrink-0 rounded-full", TONE_CLASS[taskStatusTone(task)], className)}
      />
      {labelled && <span className="sr-only">{taskStatusLabel(task)}</span>}
    </>
  );
}
