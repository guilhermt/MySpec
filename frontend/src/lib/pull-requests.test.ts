import { describe, expect, it } from "vitest";
import { isOpen, isReviewed, prOf } from "@/lib/pull-requests";
import { makePullRequest, makeTask } from "@/test/wails-mock";

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

  it.each(["preparing", "drafting", "draft_ready", "in_review", "ready_to_approve"])(
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
