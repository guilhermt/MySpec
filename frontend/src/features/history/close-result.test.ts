import { describe, expect, it } from "vitest";
import {
  baseNotUpdated,
  closeAttention,
  closeLegendTime,
  closeResultLines,
} from "@/features/history/close-result";
import { makeCloseResult } from "@/test/wails-mock";

const done = { outcome: "done", reason: "", detail: "" };
const skipped = (reason: string) => ({ outcome: "skipped", reason, detail: "" });
const failed = (detail: string) => ({ outcome: "failed", reason: "", detail });

const CLOSE = makeCloseResult({
  branchName: "idempotency-keys",
  baseBranch: "dev",
  baseCommits: 3,
});

describe("closeResultLines", () => {
  it("says every part done", () => {
    expect(closeResultLines(CLOSE, "/home/dev/code/api")).toEqual([
      { outcome: "done", text: "Worktree removed" },
      { outcome: "done", text: "Branch idempotency-keys deleted" },
      { outcome: "done", text: "dev updated by 3 commits" },
    ]);
  });

  it("writes one commit in the singular", () => {
    const [, , base] = closeResultLines({ ...CLOSE, baseCommits: 1 }, null);

    expect(base?.text).toBe("dev updated by 1 commit");
  });

  it.each([
    ["worktree already gone", { worktree: skipped("missing") }, 0, "Worktree was already gone"],
    [
      "worktree failed",
      { worktree: failed("fatal: /home/dev/wt is dirty") },
      0,
      "Worktree couldn't be removed",
    ],
    [
      "branch already gone",
      { branch: skipped("missing") },
      1,
      "Branch idempotency-keys was already gone",
    ],
    [
      "branch failed",
      { branch: failed("error: cannot lock ref") },
      1,
      "Branch idempotency-keys couldn't be deleted",
    ],
    ["base up to date", { base: skipped("up_to_date") }, 2, "dev was already up to date"],
    [
      "base checked out elsewhere",
      { base: skipped("not_checked_out") },
      2,
      "dev not updated: another branch is checked out",
    ],
    [
      "base missing",
      { base: skipped("missing") },
      2,
      "dev not updated: the branch doesn't exist locally",
    ],
    [
      "base dirty",
      { base: skipped("dirty") },
      2,
      "dev not updated: the repository has uncommitted changes",
    ],
    [
      "base without upstream",
      { base: skipped("no_upstream") },
      2,
      "dev not updated: it tracks no remote branch",
    ],
    [
      "base diverged",
      { base: skipped("diverged") },
      2,
      "dev not updated: it has commits the remote doesn't",
    ],
    ["base failed", { base: failed("fatal: unable to access") }, 2, "dev not updated"],
  ])("says %s", (_, overrides, at, text) => {
    const line = closeResultLines({ ...CLOSE, ...overrides }, null)[at];

    expect(line?.text).toBe(text);
  });

  it("keeps a branch git doesn't see merged, with what to do in the clone", () => {
    const [, branch] = closeResultLines(
      { ...CLOSE, branch: skipped("not_merged") },
      "/home/dev/code/api",
    );

    expect(branch).toEqual({
      outcome: "skipped",
      text: "Branch idempotency-keys kept: git doesn't see it merged into dev",
      after: "Delete it in ~/code/api with git branch -D idempotency-keys once you don't need it.",
    });
  });

  it.each([
    ["not_checked_out", "Pull dev in ~/code/api when you check it out again."],
    ["dirty", "Pull dev in ~/code/api once its changes are committed or stashed."],
    ["no_upstream", "Set its upstream in ~/code/api, then pull."],
    ["diverged", "Reconcile dev with origin/dev in ~/code/api."],
  ])("says what to do about a base skipped as %s", (reason, after) => {
    const [, , base] = closeResultLines({ ...CLOSE, base: skipped(reason) }, "/home/dev/code/api");

    expect(base?.after).toBe(after);
  });

  it("says nothing to do about a base that doesn't exist locally", () => {
    const [, , base] = closeResultLines({ ...CLOSE, base: skipped("missing") }, null);

    expect(base).not.toHaveProperty("after");
  });

  it("names the clone when the repository left MySpec", () => {
    const [, branch] = closeResultLines({ ...CLOSE, branch: skipped("not_merged") }, null);

    expect(branch?.after).toBe(
      "Delete it in the clone with git branch -D idempotency-keys once you don't need it.",
    );
  });

  it("carries what git said with the home as a tilde, and nothing when it said nothing", () => {
    const [worktree, branch] = closeResultLines(
      {
        ...CLOSE,
        worktree: failed("fatal: '/home/dev/.local/share/wt' contains modified files"),
        branch: { outcome: "failed", reason: "", detail: "" },
      },
      null,
    );

    expect(worktree?.detail).toBe("fatal: '~/.local/share/wt' contains modified files");
    expect(branch).not.toHaveProperty("detail");
  });

  it("carries what git said under the branch and the base that failed", () => {
    const [, branch, base] = closeResultLines(
      {
        ...CLOSE,
        branch: failed("error: cannot lock ref 'refs/heads/idempotency-keys'"),
        base: failed("fatal: unable to access '/home/dev/code/api/.git'"),
      },
      null,
    );

    expect(branch).toEqual({
      outcome: "failed",
      text: "Branch idempotency-keys couldn't be deleted",
      detail: "error: cannot lock ref 'refs/heads/idempotency-keys'",
    });
    expect(base).toEqual({
      outcome: "failed",
      text: "dev not updated",
      detail: "fatal: unable to access '~/code/api/.git'",
    });
  });
});

describe("closeLegendTime", () => {
  const now = new Date(2026, 8, 27, 18, 0).getTime();

  it.each([
    ["today", new Date(2026, 8, 27, 15, 2).toISOString(), "15:02"],
    ["another day", new Date(2026, 8, 24, 15, 2).toISOString(), "Sep 24 at 15:02"],
  ])("writes the closing of %s", (_, closedAt, text) => {
    expect(closeLegendTime({ ...CLOSE, closedAt }, now)).toBe(text);
  });
});

describe("closeAttention and baseNotUpdated", () => {
  it.each([
    ["everything done", {}, null, ""],
    ["a base up to date", { base: skipped("up_to_date") }, null, ""],
    ["a worktree already gone", { worktree: skipped("missing") }, null, ""],
    ["a branch already gone", { branch: skipped("missing") }, null, ""],
    [
      "a base left behind",
      { base: skipped("not_checked_out") },
      "dev not updated: another branch is checked out",
      "dev not updated",
    ],
    ["a base that failed", { base: failed("x") }, "dev not updated", "dev not updated"],
    [
      "a branch that failed and a base left behind",
      { branch: failed("x"), base: skipped("dirty") },
      "Branch idempotency-keys couldn't be deleted",
      "dev not updated",
    ],
    [
      "a branch git doesn't see merged",
      { branch: skipped("not_merged") },
      "Branch idempotency-keys kept: git doesn't see it merged into dev",
      "",
    ],
    [
      "a worktree that failed and a base left behind",
      { worktree: failed("x"), base: skipped("dirty") },
      "Worktree couldn't be removed",
      "dev not updated",
    ],
  ])("reads %s", (_, overrides, attention, notUpdated) => {
    const close = { ...CLOSE, ...overrides };

    expect(closeAttention(close)).toBe(attention);
    expect(baseNotUpdated(close)).toBe(notUpdated);
  });

  it("keeps the done outcome as no attention", () => {
    expect(closeAttention({ ...CLOSE, worktree: done })).toBeNull();
  });
});
