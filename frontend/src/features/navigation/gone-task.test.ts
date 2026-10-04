import { describe, expect, it } from "vitest";
import {
  closedTaskText,
  deletedTaskText,
  forceWarning,
  leftoverCommands,
  leftoverHeading,
  leftoverLines,
} from "@/features/navigation/gone-task";
import { makeArchivedTask, makeCloseResult, makeLeftover } from "@/test/wails-mock";

const NOW = new Date(2026, 8, 24, 15, 10).getTime();
const at = (day: number, hour: number, minute: number) =>
  new Date(2026, 8, day, hour, minute).toISOString();

const MERGED = {
  number: 1279,
  url: "",
  state: "merged",
  base: "dev",
  mergedBy: "",
  mergedAt: at(24, 14, 51),
};

describe("closedTaskText", () => {
  const closed = { close: makeCloseResult({ closedAt: at(24, 15, 2) }) };

  it.each([
    [
      "a merge confirmed with its time",
      { pr: MERGED },
      "PR #1279 was merged into dev at 14:51. MySpec closed the task at 15:02; its documents, steps and reports are in History.",
    ],
    [
      "a merge confirmed on another day",
      { pr: { ...MERGED, mergedAt: at(23, 14, 51) } },
      "PR #1279 was merged into dev on Sep 23 at 14:51. MySpec closed the task at 15:02; its documents, steps and reports are in History.",
    ],
    [
      "a merge confirmed without its time",
      { pr: { ...MERGED, mergedAt: "" } },
      "PR #1279 was merged into dev. MySpec closed the task at 15:02; its documents, steps and reports are in History.",
    ],
    [
      "a merge git doesn't confirm",
      { pr: { ...MERGED, state: "open", mergedAt: "" } },
      "MySpec couldn't confirm the merge of PR #1279 and closed the task at 15:02; its documents, steps and reports are in History.",
    ],
    [
      "a One-Shot task",
      { mode: "one_shot", pr: MERGED },
      "PR #1279 was merged into dev at 14:51. MySpec closed the task at 15:02; its document and reports are in History.",
    ],
    [
      "no pull request",
      { pr: null },
      "MySpec closed the task at 15:02; its documents, steps and reports are in History.",
    ],
  ])("tells %s", (_name, overrides, text) => {
    expect(closedTaskText(makeArchivedTask({ ...closed, ...overrides }), NOW)).toBe(text);
  });

  it("takes the time of the archiving for a task with no result of its closing", () => {
    const task = makeArchivedTask({ close: null, pr: null, archivedAt: at(23, 9, 5) });

    expect(closedTaskText(task, NOW)).toBe(
      "MySpec closed the task on Sep 23 at 09:05; its documents, steps and reports are in History.",
    );
  });
});

describe("deletedTaskText", () => {
  it.each([
    [undefined, "The documents, the steps and every record of the task are gone."],
    [null, "The documents, the steps and every record of the task are gone."],
    [
      { number: 1284, state: "open" as const },
      "The documents, the steps and every record of the task are gone. PR #1284 stays open on GitHub.",
    ],
    [
      { number: 1284, state: "merged" as const },
      "The documents, the steps and every record of the task are gone. PR #1284 stays on GitHub, merged.",
    ],
    [
      { number: 1284, state: "closed" as const },
      "The documents, the steps and every record of the task are gone. PR #1284 stays on GitHub, closed.",
    ],
  ])("says what stays of %j", (pr, text) => {
    expect(deletedTaskText(pr)).toBe(text);
  });
});

describe("what stayed on disk", () => {
  const worktree = {
    path: "/home/dev/.local/share/myspec/worktrees/acme/api/rate-limit",
    kept: true,
    error: "fatal: '/home/dev/x' contains modified files",
    registered: true,
  };
  const both = makeLeftover({
    worktree,
    branch: { name: "rate-limit", kept: true, error: "checked out" },
  });

  it("lines each part, the error of what stayed under it", () => {
    expect(leftoverLines(both)).toEqual([
      {
        outcome: "failed",
        text: "The worktree stayed at",
        mono: "~/.local/share/myspec/worktrees/acme/api/rate-limit",
        detail: "fatal: '~/x' contains modified files",
      },
      { outcome: "failed", text: "The branch rate-limit stayed", detail: "checked out" },
    ]);
  });

  it("checks what git did remove", () => {
    const leftover = makeLeftover({
      worktree: { ...worktree, kept: false, error: "" },
      branch: { name: "rate-limit", kept: false, error: "" },
    });

    expect(leftoverLines(leftover)).toEqual([
      { outcome: "done", text: "Worktree removed" },
      { outcome: "done", text: "Branch rate-limit deleted" },
    ]);
  });

  it("leaves out the part git was not asked about and the detail it didn't give", () => {
    const leftover = makeLeftover({ worktree: null, branch: { name: "b", kept: true, error: "" } });

    expect(leftoverLines(leftover)).toEqual([{ outcome: "failed", text: "The branch b stayed" }]);
  });

  it("removes a folder git forgot as a folder", () => {
    const forgotten = makeLeftover({ ...both, worktree: { ...worktree, registered: false } });

    expect(leftoverCommands(forgotten)).toBe(
      "rm -rf ~/.local/share/myspec/worktrees/acme/api/rate-limit\ngit branch -D rate-limit",
    );
  });

  it("gives the commands of the parts that stayed, one per line", () => {
    expect(leftoverCommands(both)).toBe(
      "git worktree remove --force ~/.local/share/myspec/worktrees/acme/api/rate-limit\ngit branch -D rate-limit",
    );
    const onlyBranch = makeLeftover({
      worktree: { ...worktree, kept: false },
      branch: { name: "rate-limit", kept: true, error: "" },
    });
    expect(leftoverCommands(onlyBranch)).toBe("git branch -D rate-limit");
  });

  it("names the clone the commands run in", () => {
    expect(leftoverHeading(both)).toBe("To remove it yourself, in ~/code/api");
    expect(leftoverHeading(makeLeftover({ repoPath: "" }))).toBe("To remove it yourself");
  });

  it("warns of the command that deletes the worktree that stayed, and only then", () => {
    expect(forceWarning(both)).toBe("--force deletes the modified and untracked files in it too.");
    expect(forceWarning(makeLeftover({ worktree: { ...worktree, registered: false } }))).toBe(
      "rm -rf deletes the modified and untracked files in it too.",
    );
    expect(forceWarning(makeLeftover({ worktree: null, branch: both.branch }))).toBeNull();
    expect(forceWarning(makeLeftover({ worktree: { ...worktree, kept: false } }))).toBeNull();
  });
});
