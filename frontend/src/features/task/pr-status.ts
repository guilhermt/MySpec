import type { StatusTone } from "@/features/task/status";
import { prBaseName, troubleText } from "@/lib/pull-requests";
import { cloneMissingText } from "@/lib/repositories";
import type { PRBlockReason, PullRequest, Repository } from "@/lib/wails";
import { asPRStatus } from "@/lib/wails";

/** prStatusLabel is where the pull request of a task stands, in the words of the product. */
export function prStatusLabel(pr: PullRequest): string {
  switch (asPRStatus(pr.status)) {
    case "preparing":
      return "Checking GitHub";
    case "blocked":
      return "Blocked";
    case "drafting":
      return "Preparing the draft";
    case "draft_ready":
      return "Draft waiting for your OK";
    case "awaiting_reply":
      return "Waiting for your reply";
    case "opening":
      return "Opening the pull request";
    case "reviewing":
      return "Reviewing the pull request";
    case "waiting_checks":
      return "Waiting for checks";
    case "awaiting_decision":
      return "Waiting for your decision";
    case "in_review":
      return "In review";
    case "ready_to_approve":
      return "Ready to approve";
    case "committing":
      return "Committing";
    case "done":
      return "Waiting for the merge";
    case "trouble":
      return troubleText(pr.trouble, prBaseName(pr));
    case "merged":
      return "Merged · ready to close";
    case "pr_closed":
      return "Closed without merge";
    case "closing":
      return "Closing";
    case "closed":
      return "Closed";
  }
}

/**
 * prStatusTone maps the state of the pull request to the colour that carries
 * it. It never calls for the user: that colour comes from the situation of the
 * task alone.
 */
export function prStatusTone(pr: PullRequest): StatusTone {
  switch (asPRStatus(pr.status)) {
    case "preparing":
    case "drafting":
    case "opening":
    case "reviewing":
    case "waiting_checks":
    case "committing":
    case "closing":
      return "working";
    case "closed":
      return "done";
    case "blocked":
    case "draft_ready":
    case "awaiting_reply":
    case "awaiting_decision":
    case "in_review":
    case "ready_to_approve":
    case "done":
    case "trouble":
    case "merged":
    case "pr_closed":
      return "idle";
  }
}

/**
 * draftAtHand reports whether the draft is the user's to send: a ready draft,
 * or the one an opening that failed left while the agent waits for a reply, so
 * that trying again needs no message to the agent first. Once the pull request
 * exists the draft is only a record, even when the agent waits for a reply
 * during the review.
 */
export function draftAtHand(pr: PullRequest): boolean {
  const status = asPRStatus(pr.status);
  return (
    status === "draft_ready" ||
    (status === "awaiting_reply" && pr.draft !== null && pr.prNumber === 0)
  );
}

/**
 * canOpenPR reports whether the draft can be sent right now: it is at hand and
 * the agent is not in a turn. The text itself still has to say something,
 * which the card checks.
 */
export function canOpenPR(pr: PullRequest): boolean {
  return draftAtHand(pr) && !pr.turnRunning;
}

/** canDiscardDraft reports whether the draft can still be thrown away. */
export function canDiscardDraft(pr: PullRequest): boolean {
  switch (asPRStatus(pr.status)) {
    // Once the pull request exists the draft is a record, not a proposal.
    case "drafting":
    case "draft_ready":
      return true;
    // The agent waits for a reply both before the pull request and during its
    // review; only the first still has a draft to throw away.
    case "awaiting_reply":
      return pr.prNumber === 0;
    default:
      return false;
  }
}

/** canReviewAgain reports whether another review pass can be asked for. */
export function canReviewAgain(pr: PullRequest): boolean {
  switch (asPRStatus(pr.status)) {
    case "reviewing":
    case "awaiting_decision":
    case "in_review":
    case "ready_to_approve":
    case "done":
    case "trouble":
    case "merged":
      return true;
    // A pass that ended without its report can be asked for again, once there
    // is a pull request to review.
    case "awaiting_reply":
      return pr.prNumber > 0;
    default:
      return false;
  }
}

/** reviewAgainRefusal is why another review pass can't be asked for right now; null when it can. */
export function reviewAgainRefusal(pr: PullRequest): string | null {
  if (canReviewAgain(pr)) {
    return null;
  }
  switch (asPRStatus(pr.status)) {
    case "waiting_checks":
      return "a pass waits for the checks";
    case "committing":
      return "the changes are being committed";
    case "pr_closed":
      return "the pull request was closed";
    case "blocked":
      return "the pull request stage is blocked";
    case "closing":
      return "the task is closing";
    default:
      return null;
  }
}

/** canCloseTask reports whether the closing is the user's to ask for right now. */
export function canCloseTask(pr: PullRequest): boolean {
  return pr.canClose && asPRStatus(pr.status) !== "closing";
}

/** closeHint says why the task can't be closed yet. */
export function closeHint(pr: PullRequest, repository: Repository | null): string {
  if (pr.cloneMissing && repository !== null) {
    return cloneMissingText(repository);
  }
  switch (asPRStatus(pr.status)) {
    case "done":
    case "trouble":
      return "The pull request hasn't been merged yet";
    case "pr_closed":
      return "The pull request was closed without a merge";
    default:
      return "";
  }
}

/** prBlockHint tells the user what to do about a block. */
export function prBlockHint(reason: PRBlockReason): string {
  switch (reason) {
    case "gh_missing":
      return "Install the GitHub CLI and make sure gh is on the PATH, then try again.";
    case "gh_unauthenticated":
      return "Run gh auth login in a terminal, then try again.";
    case "gh_failed":
      return "Fix what gh reports, then try again.";
    case "git_failed":
      return "Fix what git reports, then try again.";
    case "no_worktree":
      return "The app no longer knows the worktree of this task. Discard the plan to start the implementation over.";
  }
}
