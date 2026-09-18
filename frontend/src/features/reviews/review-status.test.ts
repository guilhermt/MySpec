import { describe, expect, it } from "vitest";
import {
  actionHint,
  actionLabel,
  decidedCount,
  findingLocation,
  reportLabel,
  reviewRowLabel,
  reviewStatusLabel,
  reviewStatusTone,
  verdictLabel,
} from "@/features/reviews/review-status";
import type { PullReviewStatus } from "@/lib/wails";
import {
  makePullRequestRow,
  makeRepository,
  makeReviewFinding,
  makeReviewPass,
  makeReviewSummary,
  makeSituation,
  makeState,
} from "@/test/wails-mock";

describe("reviewStatusLabel", () => {
  const cases: [PullReviewStatus, string][] = [
    ["reviewing", "Reviewing"],
    ["awaiting_reply", "Waiting for the report"],
    ["awaiting_decision", "Decide findings"],
    ["ready_to_publish", "Ready to publish"],
    ["publish_failed", "Publish failed"],
    ["published", "Published"],
    ["new_commits", "New commits"],
    ["ready_to_apply", "Ready to apply"],
    ["applying", "Applying"],
    ["in_review", "In review"],
    ["ready_to_approve", "Ready to approve"],
    ["committing", "Committing"],
    ["ready_to_merge", "Ready to merge"],
  ];

  for (const [status, label] of cases) {
    it(`reads ${status} as ${label}`, () => {
      expect(reviewStatusLabel(makeReviewSummary({ status }))).toBe(label);
    });
  }
});

describe("reviewStatusTone", () => {
  it("works while the agent runs", () => {
    expect(reviewStatusTone(makeReviewSummary({ status: "reviewing" }))).toBe("working");
    expect(reviewStatusTone(makeReviewSummary({ status: "committing" }))).toBe("working");
  });

  it("is done once the review is published", () => {
    expect(reviewStatusTone(makeReviewSummary({ status: "published" }))).toBe("done");
  });

  it("stays idle for what waits, which the situations colour", () => {
    expect(reviewStatusTone(makeReviewSummary({ status: "ready_to_publish" }))).toBe("idle");
    expect(reviewStatusTone(makeReviewSummary({ status: "new_commits" }))).toBe("idle");
  });
});

describe("reviewRowLabel", () => {
  it("says what the review waits on the user for", () => {
    const review = makeReviewSummary({
      status: "reviewing",
      situations: [makeSituation({ kind: "review_report", form: "decide" })],
    });

    expect(reviewRowLabel(review)).toBe("Decide findings");
  });

  it("falls back to what the review is doing", () => {
    expect(reviewRowLabel(makeReviewSummary({ status: "applying" }))).toBe("Applying");
  });
});

describe("reportLabel", () => {
  it("names a pass and how it closed", () => {
    expect(reportLabel(makeReviewPass({ pass: 2, clean: false }))).toBe("Review 2 · changes");
    expect(reportLabel(makeReviewPass({ pass: 3, clean: true }))).toBe("Review 3 · clean");
  });

  it("says when the pass was published", () => {
    expect(reportLabel(makeReviewPass({ pass: 1, clean: true, published: true }))).toBe(
      "Review 1 · clean · published",
    );
  });
});

describe("verdictLabel", () => {
  it("names each verdict", () => {
    expect(verdictLabel("approve")).toBe("Approve");
    expect(verdictLabel("request_changes")).toBe("Request changes");
    expect(verdictLabel("comment")).toBe("Comment");
  });
});

describe("decidedCount", () => {
  it("counts the findings the user has decided on", () => {
    const pass = makeReviewPass({
      findings: [
        makeReviewFinding({ number: 1, decision: "approved" }),
        makeReviewFinding({ number: 2, decision: "discarded" }),
        makeReviewFinding({ number: 3, decision: "" }),
      ],
    });

    expect(decidedCount(pass)).toBe(2);
  });
});

describe("findingLocation", () => {
  it("points at the file and the line of an anchored finding", () => {
    expect(findingLocation(makeReviewFinding({ path: "src/login.ts", line: 12 }))).toBe(
      "src/login.ts:12",
    );
  });

  it("calls a finding without a line general", () => {
    expect(findingLocation(makeReviewFinding({ path: "", line: 0 }))).toBe("General");
  });
});

describe("actionLabel", () => {
  it("offers the review, even when the repository still has to be cloned", () => {
    expect(actionLabel(makePullRequestRow({ action: "review" }))).toBe("Review");
    expect(actionLabel(makePullRequestRow({ action: "clone" }))).toBe("Review");
    expect(actionLabel(makePullRequestRow({ action: "fork" }))).toBe("Review");
  });

  it("opens the review or the task the pull request already has", () => {
    expect(actionLabel(makePullRequestRow({ action: "open_review" }))).toBe("Open review");
    expect(actionLabel(makePullRequestRow({ action: "open_task" }))).toBe("Open task");
  });
});

describe("actionHint", () => {
  it("says a fork can't be reviewed", () => {
    expect(actionHint(makePullRequestRow({ action: "fork" }), makeState())).toBe(
      "Pull requests from forks can't be reviewed yet.",
    );
  });

  it("says where the missing clone was", () => {
    const app = makeState({ repositories: [makeRepository({ path: "/home/dev/web" })] });

    expect(actionHint(makePullRequestRow({ action: "clone_missing" }), app)).toBe(
      "The clone at /home/dev/web is missing.",
    );
  });

  it("holds nothing back from a pull request that can be reviewed", () => {
    expect(actionHint(makePullRequestRow({ action: "review" }), makeState())).toBeNull();
  });
});
