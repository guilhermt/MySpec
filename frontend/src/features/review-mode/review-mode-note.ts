import { joinList } from "@/features/task/stage-actions";
import type { TaskSummary } from "@/lib/wails";
import { asStepStatus, asTaskMode } from "@/lib/wails";

/** ReviewModeNote is the note under the options of the Review mode popover; disabled says why the mode can't change. */
export interface ReviewModeNote {
  text: string;
  disabled: boolean;
}

/**
 * reviewModeNote is what the review mode of a task applies to: the steps the plan writes, the steps not
 * started that follow the task, or the implementation; and, when it can't change, why.
 */
export function reviewModeNote(task: TaskSummary): ReviewModeNote {
  const disabled = !task.reviewModeEditable;
  if (asTaskMode(task.mode) === "one_shot") {
    return disabled
      ? { text: "The implementation has started, so the mode can't change.", disabled }
      : { text: "Applies to the implementation, before it starts.", disabled };
  }
  const steps = task.steps ?? [];
  if (steps.length === 0) {
    return { text: "Applies to the steps the plan writes.", disabled };
  }
  const notStarted = steps.filter((step) => asStepStatus(step.status) === "not_started");
  const follow = notStarted.filter((step) => !step.reviewModeAdjusted).map((step) => step.number);
  const own = notStarted.filter((step) => step.reviewModeAdjusted).map((step) => step.number);
  if (follow.length === 0) {
    return own.length === 0
      ? { text: "No step is left to start, so the mode can't change.", disabled: true }
      : { text: "Every step not started has its own mode.", disabled: true };
  }
  const applies = `Applies to the steps not started that follow the task: ${follow.join(", ")}.`;
  if (own.length === 0) {
    return { text: applies, disabled };
  }
  const owners =
    own.length === 1
      ? ` Step ${own[0]} has its own mode.`
      : ` Steps ${joinList(own.map(String))} have their own mode.`;
  return { text: `${applies}${owners}`, disabled };
}
