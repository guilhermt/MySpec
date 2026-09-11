import { RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { blockHint, blockTitle } from "@/features/task/step-status";
import { asBlockReason, type Step, type TaskSummary } from "@/lib/wails";
import { cleanAndStartStep, retryStep } from "@/store/actions";

export interface StepBlockedProps {
  task: TaskSummary;
  step: Step;
}

/**
 * StepBlocked is why a step could not start and how to get out of it. What git
 * said is shown as git said it, never translated.
 */
export function StepBlocked({ task, step }: StepBlockedProps) {
  const reason = asBlockReason(step.block?.reason ?? "");
  const detail = step.block?.detail ?? "";

  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-6">
      <div className="mx-auto flex max-w-[58.5rem] flex-col gap-4">
        <div
          role="alert"
          className="flex flex-col gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-4"
        >
          <p className="font-medium">{blockTitle(reason)}</p>
          <p className="text-sm">{blockHint(step, task)}</p>
          {detail !== "" && (
            <pre className="max-h-72 overflow-auto rounded-md bg-muted p-3 font-mono text-xs whitespace-pre-wrap select-text">
              {detail}
            </pre>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => void retryStep(task.id)}>
            <RotateCcw />
            Try again
          </Button>
          {reason === "dirty_worktree" && (
            <Button variant="destructive" size="sm" onClick={() => void cleanAndStartStep(task.id)}>
              <Trash2 />
              Clean and start
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
