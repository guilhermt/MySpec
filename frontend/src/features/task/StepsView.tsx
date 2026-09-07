import { StepList } from "@/features/task/StepList";
import type { TaskSummary } from "@/lib/wails";

export interface StepsViewProps {
  task: TaskSummary;
}

/** StepsView takes the place of the conversation once the plan is written. */
export function StepsView({ task }: StepsViewProps) {
  const steps = task.steps ?? [];
  const problems = task.planProblems ?? [];

  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-6">
      <div className="mx-auto flex max-w-[760px] flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-[20px] font-semibold">Steps</h2>
          <p className="text-sm text-muted-foreground">
            Planned in order. Running them comes in a later version.
          </p>
        </div>
        {steps.length === 0 && problems.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">No steps were found.</p>
        ) : (
          <StepList steps={steps} problems={problems} />
        )}
      </div>
    </div>
  );
}
