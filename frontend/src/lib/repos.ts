import type { RepoPR, RepoStatus, State, TaskSummary } from "@/lib/wails";
import { asPlaceKind, asRepoStatus } from "@/lib/wails";

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

/**
 * repoName is how a repository reads in the interface. The plan names the
 * repository of the workspace itself ".", which is no name at all.
 */
export function repoName(app: State | null, repo: Pick<RepoPR, "repository">): string {
  if (repo.repository !== "." && repo.repository !== "") {
    return repo.repository;
  }
  return app?.workspace?.name ?? "Root";
}

/** reposOf is every repository of a task in the PR stage, empty outside it. */
export function reposOf(task: TaskSummary | null): readonly RepoPR[] {
  return task?.repos ?? NO_REPOS;
}

/**
 * defaultRepoPath is the tab a task opens on: the repository of its most
 * urgent situation, or the first of the list.
 */
export function defaultRepoPath(task: TaskSummary | null): string {
  const repos = reposOf(task);
  // The situations come most urgent first; one about a repository the task no
  // longer lists has no tab to open.
  const waiting = (task?.situations ?? []).find(
    (situation) =>
      asPlaceKind(situation.place.kind) === "repo" &&
      repos.some((repo) => repo.repoPath === situation.place.repoPath),
  );
  return waiting?.place.repoPath ?? repos[0]?.repoPath ?? "";
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
