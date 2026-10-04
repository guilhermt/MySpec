import type { CloseResultLine } from "@/components/system/CloseResult";
import { displayPath, displayPaths } from "@/lib/paths";
import { counted } from "@/lib/situations";
import {
  asCloseOutcome,
  asCloseSkipReason,
  type CloseResult,
  type CloseSkipReason,
  type CloseStep,
} from "@/lib/wails";
import { clockOrDateAt } from "@/lib/when";

// BASE_SKIPPED is why the base was not updated, after "dev not updated: ", and what to do about it
// in the clone ("" when there is nothing to do).
const BASE_SKIPPED: Partial<
  Record<CloseSkipReason, { why: string; after: (base: string, where: string) => string }>
> = {
  not_checked_out: {
    why: "another branch is checked out",
    after: (base, where) => `Pull ${base} in ${where} when you check it out again.`,
  },
  missing: { why: "the branch doesn't exist locally", after: () => "" },
  dirty: {
    why: "the repository has uncommitted changes",
    after: (base, where) => `Pull ${base} in ${where} once its changes are committed or stashed.`,
  },
  no_upstream: {
    why: "it tracks no remote branch",
    after: (_base, where) => `Set its upstream in ${where}, then pull.`,
  },
  diverged: {
    why: "it has commits the remote doesn't",
    after: (base, where) => `Reconcile ${base} with origin/${base} in ${where}.`,
  },
};

// detailOf is what git said, with the home written as a tilde; undefined when it said nothing.
function detailOf(step: CloseStep): Pick<CloseResultLine, "detail"> {
  return step.detail === "" ? {} : { detail: displayPaths(step.detail) };
}

function worktreeLine(step: CloseStep): CloseResultLine {
  switch (asCloseOutcome(step.outcome)) {
    case "done":
      return { outcome: "done", text: "Worktree removed" };
    case "skipped":
      return { outcome: "skipped", text: "Worktree was already gone" };
    case "failed":
      return { outcome: "failed", text: "Worktree couldn't be removed", ...detailOf(step) };
  }
}

function branchLine(close: CloseResult, where: string): CloseResultLine {
  const { branch } = close;
  const name = close.branchName;
  switch (asCloseOutcome(branch.outcome)) {
    case "done":
      return { outcome: "done", text: `Branch ${name} deleted` };
    case "skipped":
      return asCloseSkipReason(branch.reason) === "not_merged"
        ? {
            outcome: "skipped",
            text: `Branch ${name} kept: git doesn't see it merged into ${close.baseBranch}`,
            after: `Delete it in ${where} with git branch -D ${name} once you don't need it.`,
          }
        : { outcome: "skipped", text: `Branch ${name} was already gone` };
    case "failed":
      return {
        outcome: "failed",
        text: `Branch ${name} couldn't be deleted`,
        ...detailOf(branch),
      };
  }
}

function baseLine(close: CloseResult, where: string): CloseResultLine {
  const { base } = close;
  const name = close.baseBranch;
  switch (asCloseOutcome(base.outcome)) {
    case "done":
      return {
        outcome: "done",
        text: `${name} updated by ${counted(close.baseCommits, "commit")}`,
      };
    case "skipped": {
      const reason = asCloseSkipReason(base.reason);
      if (reason === "up_to_date") {
        return { outcome: "skipped", text: `${name} was already up to date` };
      }
      const skipped = BASE_SKIPPED[reason];
      if (skipped === undefined) {
        return { outcome: "skipped", text: `${name} not updated` };
      }
      const next = skipped.after(name, where);
      return {
        outcome: "skipped",
        text: `${name} not updated: ${skipped.why}`,
        ...(next === "" ? {} : { after: next }),
      };
    }
    case "failed":
      return { outcome: "failed", text: `${name} not updated`, ...detailOf(base) };
  }
}

/**
 * closeResultLines is what the closing of a task did, one line per part in the order worktree,
 * branch, base. The clone is where the user fixes what was left: its path with the home as a tilde,
 * or "the clone" once the repository left MySpec.
 */
export function closeResultLines(close: CloseResult, clonePath: string | null): CloseResultLine[] {
  const where = clonePath === null ? "the clone" : displayPath(clonePath);
  return [worktreeLine(close.worktree), branchLine(close, where), baseLine(close, where)];
}

/** closeLegendTime is when the task was closed: 15:02 today, Sep 24 at 15:02 on another day. */
export function closeLegendTime(close: CloseResult, now: number): string {
  return clockOrDateAt(close.closedAt, now);
}

// baseLeftBehind says whether the base was left behind: skipped for any reason but being up to date,
// or failed.
function baseLeftBehind(close: CloseResult): boolean {
  const outcome = asCloseOutcome(close.base.outcome);
  return (
    outcome === "failed" ||
    (outcome === "skipped" && asCloseSkipReason(close.base.reason) !== "up_to_date")
  );
}

/** baseNotUpdated is "dev not updated" when the closing left the base behind, "" otherwise. */
export function baseNotUpdated(close: CloseResult): string {
  return baseLeftBehind(close) ? `${close.baseBranch} not updated` : "";
}

/**
 * closeAttention is the line of the part of the closing that asks for the user's attention, the
 * first of worktree, branch and base: a part that failed, a branch git doesn't see merged, a base
 * left behind. Null when the closing asks for nothing.
 */
export function closeAttention(close: CloseResult): string | null {
  const [worktree, branch, base] = closeResultLines(close, null);
  if (close.worktree.outcome === "failed") {
    return worktree?.text ?? null;
  }
  if (
    close.branch.outcome === "failed" ||
    (close.branch.outcome === "skipped" && close.branch.reason === "not_merged")
  ) {
    return branch?.text ?? null;
  }
  return baseLeftBehind(close) ? (base?.text ?? null) : null;
}
