import { prStatusTone } from "@/features/task/pr-status";
import { currentStepDisplay } from "@/features/task/step-status";
import { isOpen, isReviewed, prOf } from "@/lib/pull-requests";
import { situationTone, summaryLabel } from "@/lib/situations";
import { stageLabel } from "@/lib/stages";
import type { PullRequest, TaskSummary } from "@/lib/wails";
import { asPRStatus, asSessionStatus, asTaskStage } from "@/lib/wails";

/**
 * StatusTone is how urgent the status of a task looks. attention and error
 * come from the situations alone.
 */
export type StatusTone = "working" | "attention" | "paused" | "error" | "done" | "idle";

// What the pull request is doing, in the few words the list has room for.
function prPhrase(pr: PullRequest): string {
  switch (asPRStatus(pr.status)) {
    case "preparing":
      return "checking GitHub";
    case "blocked":
      return "blocked";
    case "drafting":
      return "writing the draft";
    case "draft_ready":
      return "draft to approve";
    case "awaiting_reply":
      return "waiting for your reply";
    case "opening":
      return "opening the pull request";
    case "reviewing":
      return "reviewing";
    case "awaiting_decision":
      return "decision needed";
    case "in_review":
      return `${pr.review?.percent ?? 0}% staged`;
    case "ready_to_approve":
      return "ready to approve";
    case "committing":
      return "committing";
    case "done":
      return pr.canClose ? "merge unconfirmed" : "waiting for the merge";
    case "merged":
      return "merged, ready to close";
    case "pr_closed":
      return "PR closed without merge";
    case "closing":
      return "closing";
    case "closed":
      return "closed";
  }
}

/**
 * prStatusLabel reads the PR stage as one line: which third of it the task is
 * in, and what its pull request is doing.
 */
function prStatusLabel(task: TaskSummary): string {
  const pr = prOf(task);
  const stage =
    pr !== null && isReviewed(pr) ? "Closing" : pr !== null && isOpen(pr) ? "PR review" : "PR";
  return pr === null ? stage : `${stage} · ${prPhrase(pr)}`;
}

/** taskStatusLabel is the one word the list and the header show. */
export function taskStatusLabel(task: TaskSummary): string {
  // What the task waits on the user for comes before anything it is doing.
  const summary = summaryLabel(task.situations ?? []);
  if (summary !== null) {
    return summary;
  }
  // The implementation stage has no conversation of its own: the current step
  // carries the state, and its number places the task in the plan.
  if (asTaskStage(task.stage) === "implementation") {
    const { label } = currentStepDisplay(task);
    if (task.currentStep === 0) {
      return label;
    }
    return `Step ${task.currentStep} of ${(task.steps ?? []).length} · ${label}`;
  }
  // The PR stage has no conversation of its own either: the pull request runs
  // it, and what it is doing speaks for the task.
  if (asTaskStage(task.stage) === "pr") {
    return prStatusLabel(task);
  }
  switch (asSessionStatus(task.sessionStatus)) {
    case "paused":
      return "Paused";
    case "error":
      return "Error";
    case "needs_permission":
      return "Permission";
    case "needs_answer":
      return "Question";
    case "working":
      return "Working";
    case "waiting":
      return "Waiting";
  }
}

/**
 * taskStatusTone maps a status to the colour that carries it: the one of the
 * most urgent situation, or, when the task waits for nothing, what it is doing.
 */
export function taskStatusTone(task: TaskSummary): StatusTone {
  const [situation] = task.situations ?? [];
  if (situation !== undefined) {
    return situationTone(situation);
  }
  if (asTaskStage(task.stage) === "implementation") {
    return currentStepDisplay(task).tone;
  }
  if (asTaskStage(task.stage) === "pr") {
    const pr = prOf(task);
    return pr === null ? "idle" : prStatusTone(pr);
  }
  switch (asSessionStatus(task.sessionStatus)) {
    case "paused":
      return "paused";
    case "working":
      return "working";
    // A session that is not working calls for the user only through a situation.
    case "waiting":
    case "needs_permission":
    case "needs_answer":
    case "error":
      return "idle";
  }
}

/** taskStageLabel names the stage a task is in, and says when it is reopened. */
export function taskStageLabel(task: TaskSummary): string {
  const label = stageLabel(asTaskStage(task.stage));
  return task.revisiting ? `${label} · revisiting` : label;
}

/** hasArtifacts reports whether the task has written anything to read yet. */
export function hasArtifacts(task: TaskSummary): boolean {
  return task.hasPrd || task.hasTechSpec || task.hasOneShot || (task.steps ?? []).length > 0;
}
