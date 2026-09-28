import { reviewerSituation, stepSituation } from "@/lib/situations";
import type { Step, TaskSummary } from "@/lib/wails";
import { asStepStatus } from "@/lib/wails";
import type { StepTab } from "@/store/app-store";

/**
 * firstTab is the conversation of a step that opens when nothing is stored: the one with a situation,
 * the older one when both have; without any, the reviewer's during a pass and the implementer's in
 * the rest.
 */
export function firstTab(task: TaskSummary, step: Step): StepTab {
  const implementer = stepSituation(task, step.number);
  const reviewer = reviewerSituation(task, step.number);
  if (implementer !== null && reviewer !== null) {
    return Date.parse(reviewer.startedAt) < Date.parse(implementer.startedAt)
      ? "reviewer"
      : "implementer";
  }
  if (implementer !== null || reviewer !== null) {
    return reviewer !== null ? "reviewer" : "implementer";
  }
  return asStepStatus(step.status) === "agent_review" && step.reviewer !== null
    ? "reviewer"
    : "implementer";
}

/**
 * firstTabDecided says whether firstTab already has grounds to pick a side: the reviewer
 * conversation exists, or a situation, the implementer's or the reviewer's, does. In a pass
 * before the reviewer's session starts, none of those hold, and firstTab falls back to
 * "implementer" only to have something to display; that guess must not be stored, or the
 * reviewer tab stays stuck on it once the session actually starts.
 */
export function firstTabDecided(task: TaskSummary, step: Step): boolean {
  return (
    step.reviewer !== null ||
    stepSituation(task, step.number) !== null ||
    reviewerSituation(task, step.number) !== null
  );
}
