import type { StatusTone } from "@/features/task/status";
import { cloneMissingText } from "@/lib/repositories";
import type {
  CloseResult,
  CloseSkipReason,
  CloseStep,
  PRBlockReason,
  PRState,
  PullRequest,
  Repository,
} from "@/lib/wails";
import { asCloseOutcome, asCloseSkipReason, asPRState, asPRStatus } from "@/lib/wails";

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

/** canApprovePR reports whether every changed file is staged and waiting. */
export function canApprovePR(pr: PullRequest): boolean {
  return asPRStatus(pr.status) === "ready_to_approve";
}

/** approvePRHint says what is missing before the pull request can be approved. */
export function approvePRHint(pr: PullRequest): string {
  if (pr.review?.error !== undefined && pr.review.error !== "") {
    return "The worktree couldn't be read";
  }
  return "Stage every changed file in VS Code to approve";
}

/** hasPRSession reports whether the PR stage has a conversation to show. */
export function hasPRSession(pr: PullRequest): boolean {
  return pr.sessionStage !== "";
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
      return "The pull request hasn't been merged yet";
    case "pr_closed":
      return "The pull request was closed without a merge";
    default:
      return "";
  }
}

/** closeStepLabel reads one part of a close result as a sentence. */
export function closeStepLabel(part: "worktree" | "branch" | "base", result: CloseResult): string {
  switch (part) {
    case "worktree":
      return worktreeLabel(result.worktree);
    case "branch":
      return branchLabel(result.branch, result);
    case "base":
      return baseLabel(result.base, result);
  }
}

function worktreeLabel(step: CloseStep): string {
  switch (asCloseOutcome(step.outcome)) {
    case "done":
      return "Worktree removed";
    // The folder is the only thing the worktree part can skip.
    case "skipped":
      return "Worktree was already gone";
    case "failed":
      return `Worktree couldn't be removed: ${step.detail}`;
  }
}

function branchLabel(step: CloseStep, result: CloseResult): string {
  const name = result.branchName;
  switch (asCloseOutcome(step.outcome)) {
    case "done":
      return `Branch ${name} deleted`;
    case "skipped":
      return asCloseSkipReason(step.reason) === "not_merged"
        ? `Branch ${name} kept: git doesn't see it merged into ${result.baseBranch}`
        : `Branch ${name} was already gone`;
    case "failed":
      return `Branch ${name} couldn't be deleted: ${step.detail}`;
  }
}

function baseLabel(step: CloseStep, result: CloseResult): string {
  const base = result.baseBranch;
  switch (asCloseOutcome(step.outcome)) {
    case "done":
      return `${base} updated by ${result.baseCommits} ${
        result.baseCommits === 1 ? "commit" : "commits"
      }`;
    case "skipped":
      return `${base} ${baseSkipPhrase(asCloseSkipReason(step.reason))}`;
    case "failed":
      return `${base} not updated: ${step.detail}`;
  }
}

// What the base branch of a repository was spared for, in the words that
// follow its name.
function baseSkipPhrase(reason: CloseSkipReason): string {
  switch (reason) {
    case "missing":
      return "not updated: the branch doesn't exist locally";
    case "not_checked_out":
      return "not updated: another branch is checked out";
    case "dirty":
      return "not updated: the repository has uncommitted changes";
    case "no_upstream":
      return "not updated: it tracks no remote branch";
    case "diverged":
      return "not updated: it has commits the remote doesn't";
    case "up_to_date":
      return "was already up to date";
    // Only the branch of the task is ever kept for want of a merge.
    case "not_merged":
      return "not updated";
  }
}

/** prStateLabel is what GitHub last said about the pull request. */
export function prStateLabel(state: PRState): string {
  switch (asPRState(state)) {
    case "open":
      return "Open";
    case "merged":
      return "Merged";
    case "closed":
      return "Closed";
    case "":
      return "";
  }
}

/** prBlockTitle names why the PR stage of a task could not go on. */
export function prBlockTitle(reason: PRBlockReason): string {
  switch (reason) {
    case "gh_missing":
      return "GitHub CLI was not found";
    case "gh_unauthenticated":
      return "GitHub CLI isn't authenticated";
    case "gh_failed":
      return "GitHub CLI failed";
    case "git_failed":
      return "Git failed";
    case "no_worktree":
      return "The worktree is gone";
  }
}

/** prBlockHint tells the user what to do about a block. */
export function prBlockHint(reason: PRBlockReason): string {
  switch (reason) {
    case "gh_missing":
      return "Install the GitHub CLI and make sure `gh` is on the PATH, then try again.";
    case "gh_unauthenticated":
      return "Run `gh auth login` in a terminal, then try again.";
    case "gh_failed":
      return "Fix what gh reports, then try again.";
    case "git_failed":
      return "Fix what git reports, then try again.";
    case "no_worktree":
      return "The app no longer knows the worktree of this task. Discard the plan to start the implementation over.";
  }
}

/** prReportLabel names one pass of the review, and how it closed. */
export function prReportLabel(pass: number, clean: boolean): string {
  return `Pass ${pass} · ${clean ? "nothing to change" : "changes requested"}`;
}
