import { repoLabel } from "@/features/task/StepList";
import type { TaskSummary } from "@/lib/wails";
import { useAppStore } from "@/store/app-store";

export interface ImplementationDoneProps {
  task: TaskSummary;
}

/**
 * ImplementationDone closes the implementation: every step is committed, no
 * session is running, and the app says plainly that the PR stage is not here
 * yet instead of leaving the task looking stuck.
 */
export function ImplementationDone({ task }: ImplementationDoneProps) {
  const app = useAppStore((state) => state.app);

  const steps = task.steps ?? [];
  const repos = [
    ...new Set(steps.map((step) => repoLabel(app, step)).filter((name) => name !== "")),
  ];
  const count = `${steps.length} ${steps.length === 1 ? "step" : "steps"}`;

  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-6">
      <div className="mx-auto flex max-w-[760px] flex-col gap-2 rounded-lg border p-4">
        <p className="font-medium">Every step is committed</p>
        <p className="text-sm text-muted-foreground">
          {repos.length === 0 ? `${count}.` : `${count} in ${repos.join(", ")}.`}
        </p>
        <p className="text-sm text-muted-foreground">
          The PR stage doesn't exist in this version, so the task stops here. The commits are in the
          worktree of each repository.
        </p>
      </div>
    </div>
  );
}
