import { describe, expect, it } from "vitest";
import {
  blockHint,
  blockTitle,
  canApprove,
  canReviewMyself,
  currentStepDisplay,
  currentStepOf,
  hasStepSession,
  loopSession,
  reviewCountLabel,
  stepPhaseLabel,
  stepStatusLabel,
  stepStatusTone,
} from "@/features/task/step-status";
import type { BlockReason, Step, TaskSummary } from "@/lib/wails";
import { makeReview, makeStep, makeStepReviewer, makeTask } from "@/test/wails-mock";

function implementing(step: Partial<Step>, task: Partial<TaskSummary> = {}): TaskSummary {
  return makeTask({
    stage: "implementation",
    currentStep: 1,
    steps: [makeStep(step), makeStep({ number: 2, file: "2-wire-the-api.md" })],
    ...task,
  });
}

describe("currentStepOf", () => {
  it("finds the step the task points at", () => {
    expect(currentStepOf(implementing({}, { currentStep: 2 }))?.number).toBe(2);
  });

  it("has no step before the implementation starts", () => {
    expect(currentStepOf(makeTask())).toBeNull();
    expect(currentStepOf(makeTask({ stage: "implementation", steps: null }))).toBeNull();
  });
});

describe("hasStepSession", () => {
  it.each([
    ["not_started", false],
    ["preparing", false],
    ["blocked", false],
    ["implementing", true],
    ["agent_review", true],
    ["addressing_review", true],
    ["awaiting_review", true],
    ["in_review", true],
    ["ready_to_approve", true],
    ["nothing_to_commit", true],
    ["review_failed", true],
    ["committing", true],
    ["done", false],
  ])("knows whether %s has a conversation", (status, expected) => {
    expect(hasStepSession(makeStep({ status }))).toBe(expected);
  });

  it("has no conversation without a step", () => {
    expect(hasStepSession(null)).toBe(false);
  });
});

describe("step status", () => {
  it.each([
    ["not_started", "Not started", "idle"],
    ["preparing", "Preparing", "working"],
    ["blocked", "Blocked", "idle"],
    ["implementing", "Implementing", "working"],
    ["agent_review", "Agent review", "working"],
    ["addressing_review", "Addressing review", "working"],
    ["awaiting_review", "Awaiting review", "idle"],
    ["in_review", "In review", "idle"],
    ["ready_to_approve", "Ready to approve", "idle"],
    ["nothing_to_commit", "Nothing to approve", "idle"],
    ["review_failed", "Can't read the worktree", "idle"],
    ["committing", "Committing", "working"],
    ["done", "Done", "done"],
  ])("reads %s", (status, label, tone) => {
    const step = makeStep({ status });

    expect(stepStatusLabel(step)).toBe(label);
    expect(stepStatusTone(step)).toBe(tone);
  });

  it("treats a status it does not know as not started", () => {
    expect(stepStatusLabel(makeStep({ status: "rebasing" }))).toBe("Not started");
    expect(stepStatusTone(makeStep({ status: "rebasing" }))).toBe("idle");
  });
});

describe("loopSession", () => {
  const reviewer = makeStepReviewer({ sessionStatus: "needs_answer", contextPercent: 40 });

  it("is the reviewer during a pass", () => {
    const task = implementing({ status: "agent_review", reviewer }, { sessionStatus: "waiting" });

    expect(loopSession(task, currentStepOf(task) as Step)).toMatchObject({
      stage: "step_review:1",
      sessionStatus: "needs_answer",
      contextPercent: 40,
    });
  });

  it("is the implementer while it addresses a report", () => {
    const task = implementing(
      { status: "addressing_review", reviewer },
      { sessionStatus: "working", contextPercent: 12 },
    );

    expect(loopSession(task, currentStepOf(task) as Step)).toEqual({
      stage: "step:1",
      sessionStatus: "working",
      sessionModel: "claude-fable-5-1",
      sessionEffort: "high",
      turnRunning: false,
      processRunning: false,
      retryAttempt: 0,
      retryMax: 0,
      retryAt: "",
      retryReason: "",
      turnStartedAt: "",
      lastError: "",
      turnFailed: false,
      pausedAt: "",
      contextPercent: 12,
    });
  });

  it("is the implementer during a pass whose reviewer the snapshot does not carry", () => {
    const task = implementing({ status: "agent_review" }, { sessionStatus: "paused" });

    expect(loopSession(task, currentStepOf(task) as Step)).toMatchObject({
      stage: "step:1",
      sessionStatus: "paused",
    });
  });
});

describe("canReviewMyself", () => {
  it.each([
    ["not_started", false],
    ["preparing", false],
    ["implementing", true],
    ["agent_review", true],
    ["addressing_review", true],
    ["committing", false],
    ["done", false],
  ])("knows whether a step under the agent review in %s can be taken back", (status, expected) => {
    expect(canReviewMyself(makeStep({ status, reviewMode: "agent" }))).toBe(expected);
  });

  it("has nothing to take back from a step the user reviews", () => {
    expect(canReviewMyself(makeStep({ status: "implementing" }))).toBe(false);
  });

  it("has nothing to take back from a step that went to the user", () => {
    const step = makeStep({
      status: "awaiting_review",
      reviewMode: "manual",
      reviewFallback: "rounds_exhausted",
    });

    expect(canReviewMyself(step)).toBe(false);
  });
});

describe("reviewCountLabel", () => {
  it.each([
    [1, 2, "1 of 2 files staged"],
    [0, 1, "0 of 1 file staged"],
    [1, 1, "1 of 1 file staged"],
  ])("counts %d of %d", (staged, total, expected) => {
    expect(reviewCountLabel(makeReview({ staged, total }))).toBe(expected);
  });
});

describe("canApprove", () => {
  it.each([
    ["awaiting_review", false],
    ["in_review", false],
    ["ready_to_approve", true],
    ["nothing_to_commit", false],
    ["review_failed", false],
    ["committing", false],
  ])("knows whether %s can be approved", (status, expected) => {
    expect(canApprove(makeStep({ status }))).toBe(expected);
  });
});

describe("stepPhaseLabel", () => {
  it.each([
    ["fetching", "Fetching origin…"],
    ["creating", "Creating the worktree…"],
    ["checking", "Checking the worktree…"],
    ["", "Preparing the worktree…"],
  ])("names the %s phase", (phase, expected) => {
    expect(stepPhaseLabel(phase)).toBe(expected);
  });
});

describe("currentStepDisplay", () => {
  it("says so when the task has no step", () => {
    expect(currentStepDisplay(makeTask({ stage: "implementation" }))).toEqual({
      label: "No steps",
      tone: "idle",
    });
  });

  it("says the implementation is over when every step is committed", () => {
    const task = implementing({ status: "done" }, { currentStep: 0 });

    expect(currentStepDisplay(task)).toEqual({ label: "Implemented", tone: "done" });
  });

  it.each([
    ["not_started", "Not started", "idle"],
    ["preparing", "Preparing", "working"],
    ["blocked", "Blocked", "idle"],
    ["awaiting_review", "Awaiting review", "idle"],
    ["nothing_to_commit", "Nothing to approve", "idle"],
    ["review_failed", "Can't read the worktree", "idle"],
    ["committing", "Committing", "working"],
  ])("reads %s from the step alone", (status, label, tone) => {
    const task = implementing({ status }, { sessionStatus: "paused" });

    expect(currentStepDisplay(task)).toEqual({ label, tone });
  });

  it.each([
    ["in_review", 60],
    ["ready_to_approve", 100],
  ])("carries the percentage of a step %s", (status, percent) => {
    const task = implementing({ status, review: makeReview({ percent }) });

    expect(currentStepDisplay(task)).toEqual({ label: `Review ${percent}%`, tone: "idle" });
  });

  it("reads a review the backend did not send as no progress", () => {
    const task = implementing({ status: "in_review" });

    expect(currentStepDisplay(task)).toEqual({ label: "Review 0%", tone: "idle" });
  });

  it.each([
    ["working", "Implementing", "working"],
    ["waiting", "Implementing", "working"],
    ["needs_permission", "Permission", "idle"],
    ["needs_answer", "Question", "idle"],
    ["paused", "Paused", "paused"],
    ["error", "Error", "idle"],
  ])("reads an implementing step through a %s session", (sessionStatus, label, tone) => {
    const task = implementing({ status: "implementing" }, { sessionStatus });

    expect(currentStepDisplay(task)).toEqual({ label, tone });
  });

  it.each([
    ["agent_review", "Agent review"],
    ["addressing_review", "Addressing review"],
  ])("reads a step in %s without the pass or the round", (status, label) => {
    const task = implementing({ status, reviewPass: 2, reviewRound: 1 });

    expect(currentStepDisplay(task)).toEqual({ label, tone: "working" });
  });

  it("reads the session of the reviewer during a pass", () => {
    const task = implementing(
      { status: "agent_review", reviewer: makeStepReviewer({ sessionStatus: "needs_permission" }) },
      { sessionStatus: "working" },
    );

    expect(currentStepDisplay(task)).toEqual({ label: "Permission", tone: "idle" });
  });
});

describe("blockTitle", () => {
  it.each([
    ["dirty_worktree", "The worktree has uncommitted changes"],
    ["fetch_failed", "Couldn't fetch origin"],
    ["no_base_branch", "No base branch"],
    ["path_exists", "The worktree folder already exists"],
    ["branch_exists", "The branch already exists"],
    ["git_failed", "Git failed"],
    ["clone_missing", "The clone of the repository is missing"],
  ] as const)("names %s", (reason: BlockReason, expected) => {
    expect(blockTitle(reason)).toBe(expected);
  });
});

describe("blockHint", () => {
  function blockedStep(reason: string, files = 0): Step {
    return makeStep({ status: "blocked", block: { reason, detail: "", files } });
  }

  it.each([
    ["fetch_failed", "Check the network and the credentials of origin, then try again."],
    [
      "no_base_branch",
      "Neither origin/dev nor origin/main exists. Create one of them, then try again.",
    ],
    ["path_exists", "Move or delete the folder, then try again."],
    ["git_failed", "Fix what git reports, then try again."],
    [
      "clone_missing",
      "Change the path of the repository in Settings › Repositories, then try again.",
    ],
  ])("tells the user what to do about %s", (reason, expected) => {
    expect(blockHint(blockedStep(reason), makeTask())).toBe(expected);
  });

  it("names the branch that is in the way", () => {
    expect(blockHint(blockedStep("branch_exists"), makeTask())).toBe(
      'Delete or rename the branch "add-login", then try again.',
    );
  });

  it.each([
    [1, "1 changed file in the worktree."],
    [3, "3 changed files in the worktree."],
  ])("counts the %d changed files of a dirty worktree", (files, start) => {
    expect(blockHint(blockedStep("dirty_worktree", files), makeTask())).toBe(
      `${start} Clean it yourself and try again, or let the app discard every change and start the step.`,
    );
  });

  it("falls back on a reason it does not know", () => {
    expect(blockHint(blockedStep("rebase_in_progress"), makeTask())).toBe(
      "Fix what git reports, then try again.",
    );
  });
});
