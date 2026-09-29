import { type MarkerView, mergedLineOf } from "@/features/chat/markers";
import { draftAtHand, prBlockHint } from "@/features/task/pr-status";
import { blockHint, currentStepOf, stepPhaseLabel } from "@/features/task/step-status";
import type { PRStatus, PullRequest, Step, TaskSummary } from "@/lib/wails";
import {
  asCheckState,
  asPRBlockReason,
  asPRState,
  asPRStatus,
  asStepStatus,
  asTaskMode,
} from "@/lib/wails";

/** PlaceView is what the place of a step or of the pull request shows (table O lugar sem conversa). */
export type PlaceView =
  /** conversation is the conversation of the place. */
  | { kind: "conversation" }
  /** activity is what the app does meanwhile: Starting step 5…, Fetching origin…, Closing the task… */
  | { kind: "activity"; text: string }
  /** blocked is the line of the step that is next and the error block of the block. */
  | { kind: "blocked"; line: MarkerView; explanation: string; detail: string }
  /** empty is the empty state of the place, with the live checks, the line of the merge or an error block. */
  | {
      kind: "empty";
      title: string;
      body: string;
      checks: boolean;
      endLine: MarkerView | null;
      error?: { explanation: string; detail: string };
    }
  /** closedReview is the conversation of the review of the pull request, read-only, with the line of its end. */
  | { kind: "closedReview"; endLine: MarkerView | null };

// counted is a count with its noun: "1 step", "7 steps".
function counted(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

// listed is names in a sentence: "a", "a and b", "a, b and c".
function listed(names: readonly string[]): string {
  const last = names.at(-1) ?? "";
  return names.length <= 1 ? last : `${names.slice(0, -1).join(", ")} and ${last}`;
}

// blockedLine is the start of the step that could not start: "Step 5 is next".
function blockedLine(task: TaskSummary, step: Step): MarkerView {
  const oneShot = asTaskMode(task.mode) === "one_shot";
  return {
    icon: "start",
    text: oneShot ? "Implementation is next" : `Step ${step.number} is next`,
    complement: oneShot ? task.name : step.title,
    body: { kind: "none" },
    timeHidden: false,
  };
}

// committedPlace is the implementation with every step committed, or without a step to run.
function committedPlace(task: TaskSummary): PlaceView {
  const steps = (task.steps ?? []).length;
  const empty = (title: string, body: string): PlaceView => ({
    kind: "empty",
    title,
    body,
    checks: false,
    endLine: null,
  });
  if (steps === 0) {
    return empty("No steps were found", "The plan has no step files.");
  }
  return asTaskMode(task.mode) === "one_shot"
    ? empty(
        "The implementation is committed",
        `${task.repository}. The pull request stage starts next.`,
      )
    : empty(
        "Every step is committed",
        `${counted(steps, "step")} in ${task.repository}. The pull request stage starts next.`,
      );
}

/** stepPlaceOf is what the implementation shows: the conversation of the step, or the place without one. */
export function stepPlaceOf(task: TaskSummary): PlaceView {
  const step = currentStepOf(task);
  if (step === null) {
    return committedPlace(task);
  }
  switch (asStepStatus(step.status)) {
    case "not_started":
      return {
        kind: "activity",
        text:
          asTaskMode(task.mode) === "one_shot"
            ? "Starting the implementation…"
            : `Starting step ${step.number}…`,
      };
    case "preparing":
      return { kind: "activity", text: stepPhaseLabel(step.phase) };
    case "done":
      return { kind: "activity", text: "Starting the next step…" };
    case "blocked":
      return {
        kind: "blocked",
        line: blockedLine(task, step),
        explanation: blockHint(step, task),
        detail: step.block?.detail ?? "",
      };
    default:
      return { kind: "conversation" };
  }
}

// waitingBody is what the place says while the checks run before the first pass.
function waitingBody(pr: PullRequest): string {
  const reads = `MySpec reads #${pr.prNumber} every minute.`;
  const pending = (pr.checks ?? [])
    .filter((check) => ["running", "queued"].includes(asCheckState(check.state)))
    .map((check) => check.name);
  if (pr.checkedAt === "" || pending.length === 0) {
    return reads;
  }
  const verb = pending.length === 1 ? "is" : "are";
  return `${reads} The first pass begins once ${listed(pending)} ${verb} done.`;
}

// endedBeforeReview is the pull request merged or closed before the first pass of its review.
function endedBeforeReview(pr: PullRequest): PlaceView {
  const merged = asPRState(pr.prState) === "merged" || asPRStatus(pr.status) === "merged";
  return {
    kind: "empty",
    title: merged
      ? "The pull request was merged before the first review pass."
      : "The pull request was closed without a merge before the first review pass.",
    body: "",
    checks: false,
    endLine: mergedLineOf(pr),
  };
}

/**
 * prPlaceOf is what the PR stage shows. hasReviewConversation says the
 * conversation of the review exists, which the index of the conversations of
 * the task lists once the first pass started. The pull request says the rest:
 * the task is taken for the symmetry with stepPlaceOf.
 */
export function prPlaceOf(
  _task: TaskSummary,
  pr: PullRequest,
  hasReviewConversation: boolean,
): PlaceView {
  const status = asPRStatus(pr.status);
  switch (status) {
    case "preparing":
      return { kind: "activity", text: "Preparing the pull request…" };
    case "blocked":
      return {
        kind: "empty",
        title: "The pull request stage stopped",
        body: "",
        checks: false,
        endLine: null,
        error: {
          explanation: pr.block === null ? "" : prBlockHint(asPRBlockReason(pr.block.reason)),
          detail: pr.block?.detail ?? "",
        },
      };
    case "waiting_checks":
      return hasReviewConversation
        ? { kind: "conversation" }
        : {
            kind: "empty",
            title: "The review starts when the checks finish.",
            body: waitingBody(pr),
            checks: true,
            endLine: null,
          };
    case "closing":
      return { kind: "activity", text: "Closing the task…" };
    case "done":
    case "trouble":
    case "merged":
    case "pr_closed":
    case "closed":
      // Done and trouble come after a pass, so the review has a conversation; a
      // pull request can be merged or closed before the first one.
      return hasReviewConversation || status === "done" || status === "trouble"
        ? { kind: "closedReview", endLine: mergedLineOf(pr) }
        : endedBeforeReview(pr);
    default:
      return { kind: "conversation" };
  }
}

/**
 * hasComposer reports whether the place has the field to talk to its conversation: only a
 * conversation with a session, which the review of a pull request behind it is not.
 */
export function hasComposer(view: PlaceView): boolean {
  return view.kind === "conversation";
}

/** hasReviewConversation reports whether the review of the pull request has a conversation: the index of the conversations of the task lists it once the first pass started. */
export function hasReviewConversation(task: TaskSummary): boolean {
  return (task.conversations ?? []).some((conversation) => conversation.stage === "pr_review");
}

/** FixedCard is the card the screen draws at the end of a conversation, outside its transcript. */
export type FixedCard = "files" | "draft" | "checks";

// FILES_STEP are the states of a step whose changed files are the user's to read: in review, and
// committing (a commit that failed included); review_failed is the worktree that couldn't be read.
const FILES_STEP: readonly string[] = [
  "awaiting_review",
  "in_review",
  "ready_to_approve",
  "review_failed",
  "committing",
];

// FILES_PR are the states of the pull request whose applied changes are the user's to read.
const FILES_PR: readonly PRStatus[] = ["in_review", "ready_to_approve", "committing"];

/** stepFixedCardOf is the fixed card of the conversation of a step, on both tabs: its changed files, or none. */
export function stepFixedCardOf(step: Step): FixedCard | null {
  return FILES_STEP.includes(asStepStatus(step.status)) ? "files" : null;
}

/**
 * prFixedCardOf is the fixed card of the conversation of the pull request: the changed files of a
 * round, the draft while it is the user's to send, the live checks while a later pass waits for
 * them; none otherwise.
 */
export function prFixedCardOf(pr: PullRequest): FixedCard | null {
  const status = asPRStatus(pr.status);
  if (FILES_PR.includes(status)) {
    return "files";
  }
  if (draftAtHand(pr)) {
    return "draft";
  }
  return status === "waiting_checks" ? "checks" : null;
}
