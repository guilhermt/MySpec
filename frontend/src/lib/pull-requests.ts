import type { CheckGlyph } from "@/components/system/ChecksList";
import type {
  CheckState,
  Mergeable,
  PRCheck,
  PRStatus,
  PRTrouble,
  PullRequest,
  TaskSummary,
} from "@/lib/wails";
import { asCheckState, asMergeable, asPRStatus } from "@/lib/wails";
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

/** ChecksReading is a reading of the checks of a pull request: the checks, the merge, when, and the base. */
export interface ChecksReading {
  checks: readonly PRCheck[] | null;
  /** mergeable is whether the branch merges clean into the base; "" while GitHub has not said. */
  mergeable: Mergeable;
  /** checkedAt is when the reading was made; "" before the first one. */
  checkedAt: string;
  /** base is the branch the pull request merges into, for "conflict with dev". */
  base: string;
}

/** prChecks is the reading of the checks of the pull request of a task. */
export function prChecks(pr: PullRequest): ChecksReading {
  return {
    checks: pr.checks,
    mergeable: asMergeable(pr.mergeable),
    checkedAt: pr.checkedAt,
    base: prBaseName(pr),
  };
}

/** checkCounts is how many checks of a reading passed, skipped and neutral included, of how many. */
export function checkCounts(reading: ChecksReading): { passed: number; total: number } {
  return countChecks(reading.checks ?? []);
}

function countChecks(checks: readonly PRCheck[]): { passed: number; total: number } {
  const passed = checks.filter((check) =>
    ["passed", "skipped", "neutral"].includes(asCheckState(check.state)),
  ).length;
  return { passed, total: checks.length };
}

/** liveChecksHeader is the header of the live checks: "Waiting for checks · 4 of 6 passed", or "No checks". */
export function liveChecksHeader(checks: readonly PRCheck[] | null): string {
  if (checks === null || checks.length === 0) {
    return "No checks";
  }
  const { passed, total } = countChecks(checks);
  return `Waiting for checks · ${passed} of ${total} passed`;
}

/** baseName strips a remote's "origin/" prefix off a branch name, when it has one. */
export function baseName(branch: string): string {
  return branch.replace(/^origin\//, "");
}

/** prBaseName is the branch the pull request merges into: what GitHub says, or else the base of the worktree. */
export function prBaseName(pr: PullRequest): string {
  return pr.prBase !== "" ? pr.prBase : baseName(pr.baseBranch);
}

/**
 * checksSummary is the checks of a reading in one line. The task form tells the
 * passed first: "3 of 5 passed · 2 not finished · 1 failed · merges clean". The
 * panel form, of the list of Reviews, tells the failed first and the base of the
 * merge: "1 failed · 3 of 4 passed · conflict with dev", "All 6 passed · merges
 * clean into dev".
 */
export function checksSummary(reading: ChecksReading, form: "task" | "panel" = "task"): string {
  if (reading.checkedAt === "") {
    return "Not read yet";
  }
  const checks = reading.checks ?? [];
  if (form === "task" && checks.length === 0) {
    return "No checks";
  }
  const { passed, total } = checkCounts(reading);
  const states = checks.map((check) => asCheckState(check.state));
  const unfinished = states.filter(isUnfinished).length;
  const failed = states.filter((state) => state === "failed").length;
  const parts =
    form === "task"
      ? taskParts(passed, total, unfinished, failed)
      : panelParts(passed, total, unfinished, failed);
  if (reading.mergeable === "mergeable") {
    parts.push(form === "task" ? "merges clean" : `merges clean into ${reading.base}`);
  } else if (reading.mergeable === "conflicting") {
    parts.push(`conflict with ${reading.base}`);
  }
  return parts.join(" · ");
}

function isUnfinished(state: CheckState): boolean {
  return state === "running" || state === "queued";
}

function taskParts(passed: number, total: number, unfinished: number, failed: number): string[] {
  const parts = [`${passed} of ${total} passed`];
  if (unfinished > 0) {
    parts.push(`${unfinished} not finished`);
  }
  if (failed > 0) {
    parts.push(`${failed} failed`);
  }
  return parts;
}

function panelParts(passed: number, total: number, unfinished: number, failed: number): string[] {
  if (total === 0) {
    return ["No checks"];
  }
  if (failed === 0 && unfinished === 0) {
    return [`All ${total} passed`];
  }
  const parts = failed > 0 ? [`${failed} failed`] : [];
  parts.push(`${passed} of ${total} passed`);
  if (unfinished > 0) {
    parts.push(`${unfinished} not finished`);
  }
  return parts;
}

/** unfinishedChecks is the names of the checks of a reading still running or queued, in the order GitHub gives them. */
export function unfinishedChecks(reading: ChecksReading): string[] {
  return (reading.checks ?? [])
    .filter((check) => isUnfinished(asCheckState(check.state)))
    .map((check) => check.name);
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

/** checkRows is the checks of a reading, by name, in the order GitHub gives them. */
export function checkRows(reading: ChecksReading): CheckRow[] {
  return (reading.checks ?? []).map((check) => {
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
