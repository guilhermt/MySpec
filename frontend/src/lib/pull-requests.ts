import type { PRStatus, PullRequest, TaskSummary } from "@/lib/wails";
import { asPRStatus } from "@/lib/wails";

// The states the pull request reaches once its review is behind it: from there
// on the only thing left is the closing.
const REVIEWED_STATES: readonly PRStatus[] = ["done", "merged", "pr_closed", "closing", "closed"];

/** prOf is the pull request of a task, null outside the PR stage. */
export function prOf(task: TaskSummary | null): PullRequest | null {
  return task?.pr ?? null;
}

/** isReviewed reports whether the review of a pull request is behind it: only the closing is left. */
export function isReviewed(pr: PullRequest): boolean {
  return REVIEWED_STATES.includes(asPRStatus(pr.status));
}

/** isOpen reports whether the pull request exists on GitHub. */
export function isOpen(pr: PullRequest): boolean {
  return pr.prNumber > 0;
}
