import { describe, expect, it } from "vitest";
import {
  baseName,
  type CheckRow,
  checkCounts,
  checkDuration,
  checkRows,
  checksSummary,
  isOpen,
  isReviewed,
  liveChecksHeader,
  prBaseName,
  prChecks,
  prOf,
  troubleLabel,
  troubleText,
} from "@/lib/pull-requests";
import type { CheckState } from "@/lib/wails";
import { makePRCheck, makePullRequest, makeTask } from "@/test/wails-mock";

describe("prOf", () => {
  it("is the pull request of a task in the PR stage", () => {
    const pr = makePullRequest();

    expect(prOf(makeTask({ stage: "pr", pr }))).toBe(pr);
  });

  it("is null outside the PR stage, and without a task", () => {
    expect(prOf(makeTask())).toBeNull();
    expect(prOf(null)).toBeNull();
  });
});

describe("isReviewed", () => {
  it.each(["done", "merged", "pr_closed", "closing", "closed"])(
    "has the review of a %s pull request behind it",
    (status) => {
      expect(isReviewed(makePullRequest({ status }))).toBe(true);
    },
  );

  it.each(["preparing", "drafting", "draft_ready", "in_review", "ready_to_approve", "trouble"])(
    "still has the review of a %s pull request ahead",
    (status) => {
      expect(isReviewed(makePullRequest({ status }))).toBe(false);
    },
  );
});

describe("isOpen", () => {
  it("is open once GitHub gave it a number", () => {
    expect(isOpen(makePullRequest({ prNumber: 12 }))).toBe(true);
    expect(isOpen(makePullRequest())).toBe(false);
  });
});

describe("troubleLabel", () => {
  it("names what went wrong in a few words", () => {
    expect(troubleLabel({ failedChecks: ["ci", "lint"], conflict: true })).toBe(
      "Checks failed · conflict",
    );
    expect(troubleLabel({ failedChecks: [], conflict: true })).toBe("Conflict with base");
    expect(troubleLabel({ failedChecks: ["ci"], conflict: false })).toBe("Checks failed");
  });
});

describe("troubleText", () => {
  it("names the checks that failed and the base the pull request conflicts with", () => {
    expect(troubleText({ failedChecks: ["ci", "lint"], conflict: true }, "main")).toBe(
      "Checks failed: ci, lint · conflict with main",
    );
    expect(troubleText({ failedChecks: ["ci"], conflict: false }, "main")).toBe(
      "Checks failed: ci",
    );
    expect(troubleText({ failedChecks: [], conflict: true }, "main")).toBe("Conflict with main");
  });

  it("calls the base the base when its name is unknown", () => {
    expect(troubleText({ failedChecks: null, conflict: true }, "")).toBe("Conflict with the base");
  });
});

describe("checkCounts", () => {
  it.each([
    ["no checks", [], { passed: 0, total: 0 }],
    [
      "every state, skipped and neutral counted as passed",
      [
        makePRCheck({ state: "passed" }),
        makePRCheck({ state: "skipped" }),
        makePRCheck({ state: "neutral" }),
        makePRCheck({ state: "failed" }),
        makePRCheck({ state: "running" }),
        makePRCheck({ state: "queued" }),
      ],
      { passed: 3, total: 6 },
    ],
  ])("counts %s", (_name, checks, want) => {
    expect(checkCounts(prChecks(makePullRequest({ checks })))).toEqual(want);
  });
});

describe("liveChecksHeader", () => {
  it.each([
    ["no checks", [], "No checks"],
    ["checks never read", null, "No checks"],
    [
      "the checks that passed, skipped and neutral included",
      [
        makePRCheck({ state: "passed" }),
        makePRCheck({ state: "skipped" }),
        makePRCheck({ state: "running" }),
        makePRCheck({ state: "failed" }),
      ],
      "Waiting for checks · 2 of 4 passed",
    ],
  ])("reads %s", (_name, checks, want) => {
    expect(liveChecksHeader(checks)).toBe(want);
  });
});

describe("baseName", () => {
  it("strips the origin/ prefix off a branch", () => {
    expect(baseName("origin/dev")).toBe("dev");
  });

  it("leaves a branch with no remote prefix as it is", () => {
    expect(baseName("dev")).toBe("dev");
  });
});

describe("prBaseName", () => {
  it("is the base GitHub says, or else the base of the worktree", () => {
    expect(prBaseName(makePullRequest({ prBase: "main", baseBranch: "origin/dev" }))).toBe("main");
    expect(prBaseName(makePullRequest({ prBase: "", baseBranch: "origin/dev" }))).toBe("dev");
  });
});

describe("checksSummary", () => {
  const read = "2026-09-27T23:59:00Z";
  const check = (state: string) => makePRCheck({ state });

  it.each([
    ["no reading", { checkedAt: "" }, "Not read yet"],
    ["a reading without checks", { checkedAt: read, checks: [] }, "No checks"],
    [
      "checks still running and queued",
      {
        checkedAt: read,
        checks: [
          check("passed"),
          check("skipped"),
          check("neutral"),
          check("running"),
          check("queued"),
        ],
      },
      "3 of 5 passed · 2 not finished",
    ],
    [
      "a failure, merging clean",
      { checkedAt: read, checks: [check("passed"), check("failed")], mergeable: "mergeable" },
      "1 of 2 passed · 1 failed · merges clean",
    ],
    [
      "a conflict with the base",
      {
        checkedAt: read,
        checks: [check("passed")],
        mergeable: "conflicting",
        prBase: "",
        baseBranch: "origin/dev",
      },
      "1 of 1 passed · conflict with dev",
    ],
    [
      "a merge GitHub didn't tell",
      { checkedAt: read, checks: [check("passed")], mergeable: "unknown" },
      "1 of 1 passed",
    ],
  ])("sums up %s", (_, pr, text) => {
    expect(checksSummary(prChecks(makePullRequest(pr)))).toBe(text);
  });
});

describe("checkRows", () => {
  it.each([
    ["passed", "done", null],
    ["skipped", "doneFaint", null],
    ["neutral", "doneFaint", null],
    ["failed", "error", "timed_out"],
    ["running", "work", null],
    ["queued", "todo", null],
  ])("draws a %s check with %s", (state, glyph, tooltip) => {
    const check = makePRCheck({ name: "lint", state, conclusion: "timed_out" });

    expect(checkRows(prChecks(makePullRequest({ checks: [check] })))).toEqual([
      {
        name: "lint",
        state,
        word: state,
        glyph,
        tooltip,
        startedAt: check.startedAt,
        completedAt: check.completedAt,
        url: check.url,
      },
    ]);
  });
});

describe("checkDuration", () => {
  const start = "2026-09-27T23:56:08Z";
  const now = Date.parse("2026-09-27T23:57:50Z");
  const row = (state: CheckState, startedAt: string, completedAt: string): CheckRow => ({
    name: "test",
    state,
    word: state,
    glyph: "done",
    tooltip: null,
    startedAt,
    completedAt,
    url: "",
  });

  it.each([
    ["a finished check", row("passed", start, "2026-09-27T23:58:00Z"), "1m 52s"],
    ["a running check, since its start", row("running", start, ""), "1m 42s"],
    ["a queued check", row("queued", start, ""), "—"],
    ["a check without times", row("passed", "", ""), "—"],
  ])("tells %s", (_, check, text) => {
    expect(checkDuration(check, now)).toBe(text);
  });
});
