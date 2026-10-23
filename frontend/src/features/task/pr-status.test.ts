import { describe, expect, it } from "vitest";
import {
  canCloseTask,
  canDiscardDraft,
  canOpenPR,
  canReviewAgain,
  canReviewPRMyself,
  closeHint,
  draftAtHand,
  prBlockHint,
  prStatusLabel,
  prStatusTone,
  reviewAgainRefusal,
} from "@/features/task/pr-status";
import type { PullRequest, TaskSummary } from "@/lib/wails";
import {
  makeDivergence,
  makePRImplementer,
  makePullRequest,
  makeRepository,
  makeTask,
} from "@/test/wails-mock";

const taskOf = (pr: Partial<PullRequest>, task: Partial<TaskSummary> = {}) =>
  makeTask({ pr: makePullRequest(pr), ...task });

const DRAFT = { title: "Add the login form", body: "Adds the form.", file: "draft.md" };

describe("prStatusLabel and prStatusTone", () => {
  it.each([
    ["preparing", "Checking GitHub", "working"],
    ["blocked", "Blocked", "idle"],
    ["drafting", "Preparing the draft", "working"],
    ["draft_ready", "Draft waiting for your OK", "idle"],
    ["awaiting_reply", "Waiting for your reply", "idle"],
    ["opening", "Opening the pull request", "working"],
    ["reviewing", "Reviewing the pull request", "working"],
    ["addressing_review", "Addressing the review", "working"],
    ["waiting_checks", "Waiting for checks", "working"],
    ["awaiting_decision", "Waiting for your decision", "idle"],
    ["in_review", "In review", "idle"],
    ["ready_to_approve", "Ready to approve", "idle"],
    ["committing", "Committing", "working"],
    ["pushing", "Pushing the commit", "working"],
    ["diverged", "Not as expected", "idle"],
    ["done", "Waiting for the merge", "idle"],
    ["merged", "Merged · ready to close", "idle"],
    ["pr_closed", "Closed without merge", "idle"],
    ["closing", "Closing", "working"],
    ["closed", "Closed", "done"],
  ])("reads %s", (status, label, tone) => {
    const pr = makePullRequest({ status });

    expect(prStatusLabel(pr)).toBe(label);
    expect(prStatusTone(pr)).toBe(tone);
  });

  it("reads what went wrong after the review, with the base of the pull request", () => {
    const pr = makePullRequest({
      status: "trouble",
      prBase: "main",
      trouble: { failedChecks: ["ci", "lint"], conflict: true },
    });

    expect(prStatusLabel(pr)).toBe("Checks failed: ci, lint · conflict with main");
    expect(prStatusTone(pr)).toBe("idle");
  });

  it("leaves a merge it could not confirm to the situation of the task", () => {
    const pr = makePullRequest({ status: "done", canClose: true, checkError: "gh: not found" });

    expect(prStatusTone(pr)).toBe("idle");
  });
});

describe("what the pull request allows", () => {
  it("opens the pull request only from a ready draft the agent is not touching", () => {
    expect(canOpenPR(makePullRequest({ status: "draft_ready" }))).toBe(true);
    expect(canOpenPR(makePullRequest({ status: "draft_ready", turnRunning: true }))).toBe(false);
    expect(canOpenPR(makePullRequest({ status: "drafting" }))).toBe(false);
  });

  it("opens the pull request again from the draft an opening that failed left", () => {
    expect(canOpenPR(makePullRequest({ status: "awaiting_reply", draft: DRAFT }))).toBe(true);
    expect(
      canOpenPR(makePullRequest({ status: "awaiting_reply", draft: DRAFT, turnRunning: true })),
    ).toBe(false);
    expect(canOpenPR(makePullRequest({ status: "awaiting_reply" }))).toBe(false);
  });

  it("has the draft at hand only while it is ready or left by an opening that failed", () => {
    expect(draftAtHand(makePullRequest({ status: "draft_ready" }))).toBe(true);
    // The agent is in a turn: the draft is still at hand, only not sendable yet.
    expect(draftAtHand(makePullRequest({ status: "draft_ready", turnRunning: true }))).toBe(true);
    expect(draftAtHand(makePullRequest({ status: "awaiting_reply", draft: DRAFT }))).toBe(true);
    expect(draftAtHand(makePullRequest({ status: "awaiting_reply" }))).toBe(false);
    expect(draftAtHand(makePullRequest({ status: "drafting", draft: DRAFT }))).toBe(false);
    expect(draftAtHand(makePullRequest({ status: "reviewing", draft: DRAFT, prNumber: 12 }))).toBe(
      false,
    );
  });

  it("has the draft at hand when GitHub has no pull request for the approved one", () => {
    const diverged = makePullRequest({ status: "diverged", draft: DRAFT });
    const notOpened = makeDivergence({ kind: "pr_not_opened" });

    expect(draftAtHand(diverged, notOpened)).toBe(true);
    expect(draftAtHand(diverged, makeDivergence({ kind: "pr_wrong_base" }))).toBe(false);
    expect(draftAtHand(diverged, null)).toBe(false);
    expect(draftAtHand(diverged)).toBe(false);
  });

  it("keeps the draft a record while the agent waits for a reply over an open pull request", () => {
    const repo = makePullRequest({ status: "awaiting_reply", draft: DRAFT, prNumber: 12 });

    expect(draftAtHand(repo)).toBe(false);
    expect(canOpenPR(repo)).toBe(false);
  });

  it("throws the draft away only while it is still a proposal", () => {
    expect(canDiscardDraft(makePullRequest({ status: "drafting" }))).toBe(true);
    expect(canDiscardDraft(makePullRequest({ status: "draft_ready" }))).toBe(true);
    expect(canDiscardDraft(makePullRequest({ status: "reviewing" }))).toBe(false);
    expect(canDiscardDraft(makePullRequest({ status: "waiting_checks" }))).toBe(false);
  });

  it("throws the draft away while the agent waits for a reply before the pull request", () => {
    expect(canDiscardDraft(makePullRequest({ status: "awaiting_reply" }))).toBe(true);
    expect(canDiscardDraft(makePullRequest({ status: "awaiting_reply", prNumber: 12 }))).toBe(
      false,
    );
  });

  it("reviews again from every state the pull request exists in", () => {
    expect(canReviewAgain(taskOf({ status: "awaiting_decision" }))).toBe(true);
    expect(canReviewAgain(taskOf({ status: "done" }))).toBe(true);
    expect(canReviewAgain(taskOf({ status: "trouble" }))).toBe(true);
    expect(canReviewAgain(taskOf({ status: "merged" }))).toBe(true);
    expect(canReviewAgain(taskOf({ status: "draft_ready" }))).toBe(false);
    expect(canReviewAgain(taskOf({ status: "waiting_checks", prNumber: 12 }))).toBe(false);
    expect(canReviewAgain(taskOf({ status: "pr_closed" }))).toBe(false);
    expect(canReviewAgain(taskOf({ status: "closing" }))).toBe(false);
    expect(canReviewAgain(taskOf({ status: "closed" }))).toBe(false);
  });

  it("reviews again while the agent waits for a reply over an open pull request", () => {
    expect(canReviewAgain(taskOf({ status: "awaiting_reply", prNumber: 12 }))).toBe(true);
    expect(canReviewAgain(taskOf({ status: "awaiting_reply" }))).toBe(false);
  });

  it("closes only when the backend says the closing is the user's to ask for", () => {
    expect(canCloseTask(makePullRequest({ status: "merged", canClose: true }))).toBe(true);
    expect(canCloseTask(makePullRequest({ status: "done" }))).toBe(false);
    // The closing is already under way; asking again would do nothing.
    expect(canCloseTask(makePullRequest({ status: "closing", canClose: true }))).toBe(false);
  });
});

describe("closeHint", () => {
  it("says why the task can't be closed yet", () => {
    expect(closeHint(makePullRequest({ status: "done" }), null)).toBe(
      "The pull request hasn't been merged yet",
    );
    expect(closeHint(makePullRequest({ status: "trouble" }), null)).toBe(
      "The pull request hasn't been merged yet",
    );
    expect(closeHint(makePullRequest({ status: "pr_closed" }), null)).toBe(
      "The pull request was closed without a merge",
    );
    expect(closeHint(makePullRequest({ status: "merged" }), null)).toBe("");
  });

  it("names the clone the closing waits for before anything else", () => {
    const repository = makeRepository({ missing: true });
    const pr = makePullRequest({ status: "merged", cloneMissing: true });

    expect(closeHint(pr, repository)).toBe("The clone at ~/projects/web is missing.");
  });
});

describe("prBlockHint", () => {
  it.each([
    ["gh_missing", "PATH"],
    ["gh_unauthenticated", "gh auth login"],
    ["gh_failed", "gh reports"],
    ["git_failed", "git reports"],
    ["no_worktree", "worktree of this task"],
    ["push_failed", "git reports"],
    ["open_failed", "gh reports"],
  ] as const)("tells what to do about %s, in plain text without backticks", (reason, hint) => {
    expect(prBlockHint(reason)).toContain(hint);
    expect(prBlockHint(reason)).not.toContain("`");
  });
});

describe("canReviewPRMyself", () => {
  const agent = (pr: Partial<PullRequest>) =>
    taskOf({ status: "reviewing", prNumber: 12, ...pr }, { prReviewMode: "agent" });

  it("takes the review back while the agent runs it over an open pull request", () => {
    expect(canReviewPRMyself(agent({}))).toBe(true);
    expect(canReviewPRMyself(agent({ status: "addressing_review", prState: "open" }))).toBe(true);
  });

  it.each([
    ["in Manual mode", taskOf({ status: "reviewing", prNumber: 12 })],
    ["without a task pull request", makeTask({ pr: null, prReviewMode: "agent" })],
    ["before the pull request exists", agent({ prNumber: 0 })],
    ["once GitHub says merged", agent({ prState: "merged" })],
    ["once GitHub says closed", agent({ prState: "closed" })],
    ["in merged", agent({ status: "merged" })],
    ["in pr_closed", agent({ status: "pr_closed" })],
    ["in closing", agent({ status: "closing" })],
    ["in closed", agent({ status: "closed" })],
  ])("refuses %s", (_, task) => {
    expect(canReviewPRMyself(task)).toBe(false);
  });
});

describe("reviewAgainRefusal", () => {
  it.each([
    ["waiting_checks", 12, "a pass waits for the checks"],
    ["committing", 12, "the changes are being committed"],
    ["pushing", 12, "the commit is being pushed"],
    ["diverged", 12, "the pull request isn't as expected"],
    ["pr_closed", 12, "the pull request was closed"],
    ["blocked", 12, "the pull request stage is blocked"],
    ["closing", 12, "the task is closing"],
    ["reviewing", 12, null],
    ["done", 12, null],
    ["awaiting_reply", 12, null],
  ])("refuses a pass in %s with %s", (status, prNumber, reason) => {
    expect(reviewAgainRefusal(taskOf({ status, prNumber }))).toBe(reason);
  });

  it.each(["reviewing", "addressing_review", "awaiting_decision", "in_review", "committing"])(
    "tells the user to take over the agent review in %s",
    (status) => {
      const task = taskOf({ status, prNumber: 12 }, { prReviewMode: "agent" });

      expect(reviewAgainRefusal(task)).toBe(
        "The agent is reviewing the pull request. Take it over with Review myself first.",
      );
      expect(canReviewAgain(task)).toBe(false);
    },
  );

  it.each(["done", "trouble", "merged"])(
    "lets an agent review be asked again once it is %s",
    (status) => {
      const task = taskOf({ status, prNumber: 12 }, { prReviewMode: "agent" });

      expect(reviewAgainRefusal(task)).toBeNull();
      expect(canReviewAgain(task)).toBe(true);
    },
  );

  it.each([
    ["pr_closed", "the pull request was closed"],
    ["blocked", "the pull request stage is blocked"],
    ["closing", "the task is closing"],
  ])("gives an agent review in %s the reason of its state", (status, reason) => {
    const task = taskOf({ status, prNumber: 12 }, { prReviewMode: "agent" });

    expect(reviewAgainRefusal(task)).toBe(reason);
    expect(canReviewAgain(task)).toBe(false);
  });

  it("refuses while the implementer works", () => {
    const task = taskOf({
      status: "awaiting_decision",
      prNumber: 12,
      implementer: makePRImplementer({ sessionStatus: "working", turnRunning: true }),
    });

    expect(reviewAgainRefusal(task)).toBe("The implementer is still working.");
    expect(canReviewAgain(task)).toBe(false);
  });

  it("refuses while the implementer works in the background", () => {
    const task = taskOf({
      status: "awaiting_decision",
      prNumber: 12,
      implementer: makePRImplementer({ sessionStatus: "working", turnRunning: false }),
    });

    expect(reviewAgainRefusal(task)).toBe("The implementer is still working.");
    expect(canReviewAgain(task)).toBe(false);
  });
});
