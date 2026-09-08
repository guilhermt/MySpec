import type { StatusTone } from "@/features/task/status";
import type { PRBlockReason, PRState, RepoPR, State } from "@/lib/wails";
import { asPRState, asRepoStatus } from "@/lib/wails";

/**
 * repoName is how a repository reads in the interface. The plan names the
 * repository of the workspace itself ".", which is no name at all.
 */
export function repoName(app: State | null, repo: RepoPR): string {
  if (repo.repository !== "." && repo.repository !== "") {
    return repo.repository;
  }
  return app?.workspace?.name ?? "Root";
}

/** repoStatusLabel is where a repository stands, in the words of the product. */
export function repoStatusLabel(repo: RepoPR): string {
  switch (asRepoStatus(repo.status)) {
    case "preparing":
      return "Checking GitHub";
    case "blocked":
      return "Blocked";
    case "drafting":
      return "Preparing the draft";
    case "draft_ready":
      return "Draft waiting for your OK";
    case "opening":
      return "Opening the pull request";
    case "reviewing":
      return "Reviewing the pull request";
    case "awaiting_decision":
      return "Waiting for your decision";
    case "in_review":
      return "In review";
    case "ready_to_approve":
      return "Ready to approve";
    case "committing":
      return "Committing";
    case "done":
      return "Waiting to be closed";
    case "skipped":
      return "No changes";
  }
}

/** repoStatusTone maps the state of a repository to the colour that carries it. */
export function repoStatusTone(repo: RepoPR): StatusTone {
  switch (asRepoStatus(repo.status)) {
    // Every one of these is the app waiting on the user.
    case "blocked":
    case "draft_ready":
    case "awaiting_decision":
    case "in_review":
    case "ready_to_approve":
      return "attention";
    case "preparing":
    case "drafting":
    case "opening":
    case "reviewing":
    case "committing":
      return "working";
    case "done":
    case "skipped":
      return "done";
  }
}

/**
 * canOpenPR reports whether the draft is the user's to send. The text itself
 * still has to say something, which the card checks.
 */
export function canOpenPR(repo: RepoPR): boolean {
  return asRepoStatus(repo.status) === "draft_ready" && !repo.turnRunning;
}

/** canApproveRepo reports whether every changed file is staged and waiting. */
export function canApproveRepo(repo: RepoPR): boolean {
  return asRepoStatus(repo.status) === "ready_to_approve";
}

/** approveRepoHint says what is missing before the pull request can be approved. */
export function approveRepoHint(repo: RepoPR): string {
  if (repo.review?.error !== undefined && repo.review.error !== "") {
    return "The worktree couldn't be read";
  }
  return "Stage every changed file in VS Code to approve";
}

/** hasRepoSession reports whether the repository has a conversation to show. */
export function hasRepoSession(repo: RepoPR): boolean {
  return repo.sessionStage !== "";
}

/** canDiscardDraft reports whether the draft can still be thrown away. */
export function canDiscardDraft(repo: RepoPR): boolean {
  switch (asRepoStatus(repo.status)) {
    // Once the pull request exists the draft is a record, not a proposal.
    case "drafting":
    case "draft_ready":
      return true;
    default:
      return false;
  }
}

/** canReviewAgain reports whether another review pass can be asked for. */
export function canReviewAgain(repo: RepoPR): boolean {
  switch (asRepoStatus(repo.status)) {
    case "reviewing":
    case "awaiting_decision":
    case "in_review":
    case "ready_to_approve":
    case "done":
      return true;
    default:
      return false;
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

/** prBlockTitle names why the PR stage of a repository could not go on. */
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
      return "The app no longer knows the worktree of this repository. Discard the plan to start the implementation over.";
  }
}

/** prReportLabel names one pass of the review, and how it closed. */
export function prReportLabel(pass: number, clean: boolean): string {
  return `Pass ${pass} · ${clean ? "nothing to change" : "changes requested"}`;
}
