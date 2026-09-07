import type { StatusTone } from "@/features/task/status";
import type { BlockReason, Step, TaskSummary } from "@/lib/wails";
import { asBlockReason, asSessionStatus, asStepStatus } from "@/lib/wails";

/** currentStepOf is the step that runs or runs next, null when there is none. */
export function currentStepOf(task: TaskSummary): Step | null {
  return (task.steps ?? []).find((step) => step.number === task.currentStep) ?? null;
}

/** hasStepSession reports whether the step already has a conversation to show. */
export function hasStepSession(step: Step | null): boolean {
  if (step === null) {
    return false;
  }
  const status = asStepStatus(step.status);
  return status === "implementing" || status === "awaiting_review";
}

/** stepStatusLabel is how a step reads on its own, without its session. */
export function stepStatusLabel(step: Step): string {
  switch (asStepStatus(step.status)) {
    case "not_started":
      return "Not started";
    case "preparing":
      return "Preparing";
    case "blocked":
      return "Blocked";
    case "implementing":
      return "Implementing";
    case "awaiting_review":
      return "Awaiting review";
  }
}

/** stepStatusTone maps the state of a step to the colour that carries it. */
export function stepStatusTone(step: Step): StatusTone {
  switch (asStepStatus(step.status)) {
    case "not_started":
      return "idle";
    case "preparing":
      return "working";
    case "blocked":
      return "attention";
    case "implementing":
      return "working";
    // The agent is done and the user has to look at what it did.
    case "awaiting_review":
      return "attention";
  }
}

/** stepPhaseLabel names what the app is doing while the step prepares. */
export function stepPhaseLabel(phase: string): string {
  switch (phase) {
    case "fetching":
      return "Fetching origin…";
    case "creating":
      return "Creating the worktree…";
    case "checking":
      return "Checking the worktree…";
    default:
      return "Preparing…";
  }
}

/** StepDisplay is how the state of the current step reads, in a word and a tone. */
export interface StepDisplay {
  label: string;
  tone: StatusTone;
}

/**
 * currentStepDisplay combines the step with the session behind it: while
 * implementing, a paused, failed or asking session is what the user sees.
 */
export function currentStepDisplay(task: TaskSummary): StepDisplay {
  const step = currentStepOf(task);
  if (step === null) {
    return { label: "No steps", tone: "idle" };
  }
  if (asStepStatus(step.status) !== "implementing") {
    return { label: stepStatusLabel(step), tone: stepStatusTone(step) };
  }
  switch (asSessionStatus(task.sessionStatus)) {
    case "paused":
      return { label: "Paused", tone: "paused" };
    case "error":
      return { label: "Error", tone: "error" };
    case "needs_permission":
      return { label: "Permission", tone: "attention" };
    case "working":
    case "waiting":
      return { label: "Implementing", tone: "working" };
  }
}

/** blockTitle names why a step could not start. */
export function blockTitle(reason: BlockReason): string {
  switch (reason) {
    case "dirty_worktree":
      return "The worktree has uncommitted changes";
    case "fetch_failed":
      return "Couldn't fetch origin";
    case "no_base_branch":
      return "No base branch";
    case "path_exists":
      return "The worktree folder already exists";
    case "branch_exists":
      return "The branch already exists";
    case "git_failed":
      return "Git failed";
    case "no_repository":
      return "The step doesn't name a repository of this task";
  }
}

/** blockHint tells the user what to do about a block. */
export function blockHint(step: Step, task: TaskSummary): string {
  const files = step.block?.files ?? 0;
  switch (asBlockReason(step.block?.reason ?? "")) {
    case "dirty_worktree":
      return `${files} changed ${files === 1 ? "file" : "files"} in the worktree. Clean it yourself and try again, or let the app discard every change and start the step.`;
    case "fetch_failed":
      return "Check the network and the credentials of origin, then try again.";
    case "no_base_branch":
      return "Neither origin/dev nor origin/main exists. Create one of them, then try again.";
    case "path_exists":
      return "Move or delete the folder, then try again.";
    case "branch_exists":
      return `Delete or rename the branch "${task.name}", then try again.`;
    case "git_failed":
      return "Fix what git reports, then try again.";
    case "no_repository":
      return "Fix the repository header of the step file, then try again.";
  }
}
