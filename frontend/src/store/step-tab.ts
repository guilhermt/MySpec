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
