import type { CheckGlyph } from "@/components/system/ChecksList";
import type { CheckState, PRStatus, PRTrouble, PullRequest, TaskSummary } from "@/lib/wails";
import { asCheckState, asPRStatus } from "@/lib/wails";
import { duration } from "@/lib/when";

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

/** baseName strips a remote's "origin/" prefix off a branch name, when it has one. */
export function baseName(branch: string): string {
  return branch.replace(/^origin\//, "");
}

/** prBaseName is the branch the pull request merges into: what GitHub says, or else the base of the worktree. */
export function prBaseName(pr: PullRequest): string {
  return pr.prBase !== "" ? pr.prBase : baseName(pr.baseBranch);
}

/** checksSummary is the checks of the last reading in one line: "3 of 5 passed · 2 not finished · 1 failed · merges clean". */
export function checksSummary(pr: PullRequest): string {
  if (pr.checkedAt === "") {
    return "Not read yet";
  }
  const checks = pr.checks ?? [];
  if (checks.length === 0) {
    return "No checks";
  }
  const { passed, total } = checkCounts(pr);
  const states = checks.map((check) => asCheckState(check.state));
  const unfinished = states.filter((state) => state === "running" || state === "queued").length;
  const failed = states.filter((state) => state === "failed").length;
  const parts = [`${passed} of ${total} passed`];
  if (unfinished > 0) {
    parts.push(`${unfinished} not finished`);
  }
  if (failed > 0) {
    parts.push(`${failed} failed`);
  }
  if (pr.mergeable === "mergeable") {
    parts.push("merges clean");
  } else if (pr.mergeable === "conflicting") {
    parts.push(`conflict with ${prBaseName(pr)}`);
  }
  return parts.join(" · ");
}

/** CheckRow is one check of the last reading, with its times, before the duration is told. */
export interface CheckRow {
  name: string;
  state: CheckState;
  /** word is the state: passed, skipped, neutral, failed, running, queued. */
  word: string;
  glyph: CheckGlyph;
  /** tooltip is the conclusion of GitHub on a failed check. */
  tooltip: string | null;
  startedAt: string;
  completedAt: string;
  url: string;
}

const CHECK_GLYPHS: Record<CheckState, CheckGlyph> = {
  passed: "done",
  skipped: "doneFaint",
  neutral: "doneFaint",
  failed: "error",
  running: "work",
  queued: "todo",
};

/** checkRows is the checks of the last reading, by name, in the order GitHub gives them. */
export function checkRows(pr: PullRequest): CheckRow[] {
  return (pr.checks ?? []).map((check) => {
    const state = asCheckState(check.state);
    return {
      name: check.name,
      state,
      word: state,
      glyph: CHECK_GLYPHS[state],
      tooltip: state === "failed" ? check.conclusion : null,
      startedAt: check.startedAt,
      completedAt: check.completedAt,
      url: check.url,
    };
  });
}

/** checkDuration is how long a check took, "1m 52s"; a running one, since its start; queued or without times, "—". */
export function checkDuration(row: CheckRow, now: number): string {
  const start = Date.parse(row.startedAt);
  if (row.state === "queued" || Number.isNaN(start)) {
    return "—";
  }
  const end = row.state === "running" ? now : Date.parse(row.completedAt);
  return Number.isNaN(end) ? "—" : duration(end - start);
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
