import type { SessionState } from "@/features/chat/session";
import type { StatusTone } from "@/features/task/status";
import { MAX_REVIEW_ROUNDS } from "@/lib/review-modes";
import type { BlockReason, Review, Step, TaskSummary } from "@/lib/wails";
import { asBlockReason, asReviewMode, asSessionStatus, asStepStatus } from "@/lib/wails";

/** currentStepOf is the step that runs or runs next, null when there is none. */
export function currentStepOf(task: TaskSummary): Step | null {
  return (task.steps ?? []).find((step) => step.number === task.currentStep) ?? null;
}

/** stepStage is the session key of a step, the way the Go side names it. */
export function stepStage(number: number): string {
  return `step:${number}`;
}

/** hasStepSession reports whether the step already has a conversation to show. */
export function hasStepSession(step: Step | null): boolean {
  if (step === null) {
    return false;
  }
  switch (asStepStatus(step.status)) {
    case "implementing":
    case "agent_review":
    case "addressing_review":
    case "awaiting_review":
    case "in_review":
    case "ready_to_approve":
    case "nothing_to_commit":
    case "review_failed":
    case "committing":
      return true;
    case "not_started":
    case "preparing":
    case "blocked":
    case "done":
      return false;
  }
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
    case "agent_review":
      return "Agent review";
    case "addressing_review":
      return "Addressing review";
    case "awaiting_review":
      return "Awaiting review";
    case "in_review":
      return "In review";
    case "ready_to_approve":
      return "Ready to approve";
    case "nothing_to_commit":
      return "Nothing to approve";
    case "review_failed":
      return "Can't read the worktree";
    case "committing":
      return "Committing";
    case "done":
      return "Done";
  }
}

/** stepStateLabel is the state of a step as its bar reads it, with the pass and the round of the agent review spelled out. */
export function stepStateLabel(step: Step): string {
  switch (asStepStatus(step.status)) {
    case "agent_review":
      return `Agent review · pass ${step.reviewPass}`;
    case "addressing_review":
      return `Addressing review · round ${step.reviewRound} of ${MAX_REVIEW_ROUNDS}`;
    default:
      return stepStatusLabel(step);
  }
}

/**
 * stepStatusTone maps the state of a step to the colour that carries it. It
 * never calls for the user: that colour comes from the situation of the step
 * alone.
 */
export function stepStatusTone(step: Step): StatusTone {
  switch (asStepStatus(step.status)) {
    case "preparing":
    case "implementing":
    case "agent_review":
    case "addressing_review":
    case "committing":
      return "working";
    case "done":
      return "done";
    case "not_started":
    case "blocked":
    case "awaiting_review":
    case "in_review":
    case "ready_to_approve":
    case "nothing_to_commit":
    case "review_failed":
      return "idle";
  }
}

/** reviewCountLabel says how much of the review is done, in files. */
export function reviewCountLabel(review: Review): string {
  return `${review.staged} of ${review.total} ${review.total === 1 ? "file" : "files"} staged`;
}

/** canApprove reports whether the step is reviewed and waiting for the approval. */
export function canApprove(step: Step): boolean {
  return asStepStatus(step.status) === "ready_to_approve";
}

/** canReviewMyself reports whether the review of a step can be taken back from the agent: it is under the agent review and not committing. */
export function canReviewMyself(step: Step): boolean {
  return (
    asReviewMode(step.reviewMode) === "agent" &&
    hasStepSession(step) &&
    asStepStatus(step.status) !== "committing"
  );
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

/** LoopSession is the conversation a step waits on: its reviewer during a pass, its implementer otherwise. */
export interface LoopSession extends SessionState {
  /** stage names the session: step:<n> or step_review:<n>. */
  stage: string;
  contextPercent: number;
}

/** loopSession is the conversation the current step of a task waits on. */
export function loopSession(task: TaskSummary, step: Step): LoopSession {
  if (asStepStatus(step.status) === "agent_review" && step.reviewer !== null) {
    return { ...step.reviewer, stage: step.reviewer.sessionStage };
  }
  return {
    stage: stepStage(step.number),
    sessionStatus: task.sessionStatus,
    sessionModel: task.sessionModel,
    sessionEffort: task.sessionEffort,
    turnRunning: task.turnRunning,
    processRunning: task.processRunning,
    retryAttempt: task.retryAttempt,
    contextPercent: task.contextPercent,
  };
}

/** conversationDisplay is what one conversation of a step is doing, for its tab. */
export function conversationDisplay(session: SessionState): StepDisplay {
  switch (asSessionStatus(session.sessionStatus)) {
    case "working":
      return { label: "Working", tone: "working" };
    case "paused":
      return { label: "Paused", tone: "paused" };
    case "error":
      return { label: "Error", tone: "idle" };
    case "needs_permission":
      return { label: "Permission", tone: "idle" };
    case "needs_answer":
      return { label: "Question", tone: "idle" };
    case "waiting":
      return { label: "Waiting", tone: "idle" };
  }
}

// What the conversation a running step waits on says, when that comes before
// the step: a paused, failed or asking session. null while it simply works or
// rests, and for a step with no conversation in progress.
function sessionDisplay(task: TaskSummary, step: Step): StepDisplay | null {
  const status = asStepStatus(step.status);
  if (status !== "implementing" && status !== "agent_review" && status !== "addressing_review") {
    return null;
  }
  switch (asSessionStatus(loopSession(task, step).sessionStatus)) {
    case "paused":
      return { label: "Paused", tone: "paused" };
    case "error":
      return { label: "Error", tone: "idle" };
    case "needs_permission":
      return { label: "Permission", tone: "idle" };
    case "needs_answer":
      return { label: "Question", tone: "idle" };
    case "working":
    case "waiting":
      return null;
  }
}

/**
 * currentStepDisplay combines the step with the session behind it: while the
 * step runs, a paused, failed or asking session is what the user sees. Like
 * stepStatusTone, it leaves the colour of what waits on the user to the
 * situations.
 */
export function currentStepDisplay(task: TaskSummary): StepDisplay {
  const step = currentStepOf(task);
  if (step === null) {
    // No current step with a plan behind it means every step is committed.
    return (task.steps ?? []).length > 0
      ? { label: "Implemented", tone: "done" }
      : { label: "No steps", tone: "idle" };
  }
  const status = asStepStatus(step.status);
  if (status === "in_review" || status === "ready_to_approve") {
    return { label: `Review ${step.review?.percent ?? 0}%`, tone: stepStatusTone(step) };
  }
  return sessionDisplay(task, step) ?? { label: stepStatusLabel(step), tone: stepStatusTone(step) };
}

/** stepBarDisplay is the state of the current step as its bar reads it: what the conversation it waits on says, when that comes first. */
export function stepBarDisplay(task: TaskSummary, step: Step): StepDisplay {
  return sessionDisplay(task, step) ?? { label: stepStateLabel(step), tone: stepStatusTone(step) };
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
    case "clone_missing":
      return "The clone of the repository is missing";
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
    case "clone_missing":
      return "Change the path of the repository in Settings › Repositories, then try again.";
  }
}
