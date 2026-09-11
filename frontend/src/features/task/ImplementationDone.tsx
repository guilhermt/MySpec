import { repoLabel } from "@/features/task/StepList";
import type { TaskSummary } from "@/lib/wails";
import { useAppStore } from "@/store/app-store";

export interface ImplementationDoneProps {
  task: TaskSummary;
}

/**
 * ImplementationDone closes the implementation: every step is committed and no
 * session is running, in the moment before the task moves on to the PR stage.
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
      <div className="mx-auto flex max-w-[58.5rem] flex-col gap-2 rounded-lg border p-4">
        <p className="font-medium">Every step is committed</p>
        <p className="text-sm text-muted-foreground">
          {repos.length === 0 ? `${count}.` : `${count} in ${repos.join(", ")}.`}
        </p>
        <p className="text-sm text-muted-foreground">
          The PR stage starts next, one pull request per repository.
        </p>
      </div>
    </div>
  );
}
