import { ProblemList } from "@/features/task/StepList";
import { MAX_CORRECTIONS } from "@/features/task/stage-actions";
import { asTaskStage, type TaskSummary } from "@/lib/wails";

export interface PlanProblemsNoticeProps {
  task: TaskSummary;
}

/**
 * PlanProblemsNotice is the plan handed back to the user: the app corrected it
 * as often as it will, and the step files are still not a plan.
 */
export function PlanProblemsNotice({ task }: PlanProblemsNoticeProps) {
  const problems = task.planProblems ?? [];
  const stuck =
    asTaskStage(task.stage) === "plan" &&
    problems.length > 0 &&
    task.corrections >= MAX_CORRECTIONS;

  if (!stuck) {
    return null;
  }

  return (
    <div className="mx-auto w-full max-w-[58.5rem] px-6 pb-3">
      <div
        role="alert"
        className="flex flex-col gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm"
      >
        <p>
          The plan is still invalid after three automatic corrections. Ask the agent to fix it, or
          discard the plan and start over.
        </p>
        <ProblemList problems={problems} />
      </div>
    </div>
  );
}
