import type { PRStatus, PRTrouble, PullRequest, TaskSummary } from "@/lib/wails";
import { asCheckState, asPRStatus } from "@/lib/wails";

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

/** checkCounts is how many checks of the last reading passed, skipped and neutral included, of how many. */
export function checkCounts(pr: PullRequest): { passed: number; total: number } {
  const checks = pr.checks ?? [];
  const passed = checks.filter((check) =>
    ["passed", "skipped", "neutral"].includes(asCheckState(check.state)),
  ).length;
  return { passed, total: checks.length };
}

/** troubleLabel is what went wrong with a pull request after its review, in the few words a list has room for. */
export function troubleLabel(trouble: PRTrouble): string {
  const checks = (trouble.failedChecks ?? []).length > 0;
  if (checks && trouble.conflict) {
    return "Checks failed · conflict";
  }
  return trouble.conflict ? "Conflict with base" : "Checks failed";
}

/** troubleText is what went wrong with a pull request after its review, as its bar reads it: the checks that failed, by name, and the conflict with its base. */
export function troubleText(trouble: PRTrouble, base: string): string {
  const checks = trouble.failedChecks ?? [];
  const parts: string[] = [];
  if (checks.length > 0) {
    parts.push(`Checks failed: ${checks.join(", ")}`);
  }
  if (trouble.conflict) {
    const name = base !== "" ? base : "the base";
    parts.push(`${parts.length === 0 ? "Conflict" : "conflict"} with ${name}`);
  }
  return parts.join(" · ");
}
