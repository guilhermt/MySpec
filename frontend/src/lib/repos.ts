import type { RepoPR, TaskSummary } from "@/lib/wails";
import { asRepoStatus } from "@/lib/wails";

const NO_REPOS: readonly RepoPR[] = [];

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
    case "awaiting_decision":
    case "in_review":
    case "ready_to_approve":
      return true;
    case "preparing":
    case "drafting":
    case "opening":
    case "reviewing":
    case "committing":
    case "done":
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
