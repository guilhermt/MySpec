import type { RepoPR, RepoStatus, TaskSummary } from "@/lib/wails";
import { asRepoStatus } from "@/lib/wails";

const NO_REPOS: readonly RepoPR[] = [];

// The states a repository reaches once its review is behind it: from there on
// the only thing left is the closing.
const REVIEWED_STATES: readonly RepoStatus[] = [
  "done",
  "merged",
  "pr_closed",
  "closing",
  "closed",
  "skipped",
];

/** reposOf is every repository of a task in the PR stage, empty outside it. */
export function reposOf(task: TaskSummary | null): readonly RepoPR[] {
  return task?.repos ?? NO_REPOS;
}

/**
 * repoAwaitsUser reports whether a repository can go no further until the user
 * looks at it.
 */
export function repoAwaitsUser(repo: RepoPR): boolean {
  switch (asRepoStatus(repo.status)) {
    case "blocked":
    case "draft_ready":
    case "awaiting_reply":
    case "awaiting_decision":
    case "in_review":
    case "ready_to_approve":
    // A merged pull request waits for nothing but the closing.
    case "merged":
      return true;
    // A review that closed clean waits for the merge, unless the app could not
    // read the pull request and left the closing to the user.
    case "done":
      return repo.canClose;
    case "preparing":
    case "drafting":
    case "opening":
    case "reviewing":
    case "committing":
    case "pr_closed":
    case "closing":
    case "closed":
    case "skipped":
      return false;
  }
}

/**
 * defaultRepoPath is the tab a task opens on: the first repository waiting for
 * the user, or the first of the list.
 */
export function defaultRepoPath(repos: readonly RepoPR[]): string {
  const waiting = repos.find(repoAwaitsUser);
  return waiting?.repoPath ?? repos[0]?.repoPath ?? "";
}

/**
 * everyRepoHasPR reports whether the pull requests are all open, so the task
 * has left the writing of the drafts behind. A skipped repository has nothing
 * to open and does not hold the task back.
 */
export function everyRepoHasPR(repos: readonly RepoPR[]): boolean {
  const opening = repos.filter((repo) => asRepoStatus(repo.status) !== "skipped");
  return opening.length > 0 && opening.every((repo) => repo.prNumber > 0);
}

/**
 * everyRepoReviewed reports whether every repository is through with its
 * review, so that the task has nothing left but the closing.
 */
export function everyRepoReviewed(repos: readonly RepoPR[]): boolean {
  return (
    repos.length > 0 && repos.every((repo) => REVIEWED_STATES.includes(asRepoStatus(repo.status)))
  );
}

/** closedCount is how many repositories of the task the user has closed. */
export function closedCount(repos: readonly RepoPR[]): number {
  return repos.filter((repo) => asRepoStatus(repo.status) === "closed").length;
}
