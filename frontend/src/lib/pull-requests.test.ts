import { describe, expect, it } from "vitest";
import {
  checkCounts,
  isOpen,
  isReviewed,
  prOf,
  troubleLabel,
  troubleText,
} from "@/lib/pull-requests";
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
    expect(checkCounts(makePullRequest({ checks }))).toEqual(want);
  });
});
