import { describe, expect, it } from "vitest";
import {
  hasArtifacts,
  isAttention,
  taskStageLabel,
  taskStatusLabel,
  taskStatusTone,
} from "@/features/task/status";
import type { RepoPR } from "@/lib/wails";
import { makeRepoPR, makeReview, makeStep, makeTask } from "@/test/wails-mock";

describe("task status", () => {
  it.each([
    ["working", "Working", "working", false],
    ["waiting", "Waiting", "attention", true],
    ["needs_permission", "Permission", "attention", true],
    ["paused", "Paused", "paused", false],
    ["error", "Error", "error", true],
  ])("reads %s", (sessionStatus, label, tone, attention) => {
    const task = makeTask({ sessionStatus });

    expect(taskStatusLabel(task)).toBe(label);
    expect(taskStatusTone(task)).toBe(tone);
    expect(isAttention(task)).toBe(attention);
  });

  it("treats a status it does not know as waiting", () => {
    const task = makeTask({ sessionStatus: "hibernating" });

    expect(taskStatusLabel(task)).toBe("Waiting");
    expect(taskStatusTone(task)).toBe("attention");
  });

  it("places the current step in the plan once the implementation starts", () => {
    const task = makeTask({
      stage: "implementation",
      sessionStatus: "waiting",
      currentStep: 1,
      steps: [
        makeStep({ status: "awaiting_review" }),
        makeStep({ number: 2, file: "2-wire-the-api.md" }),
      ],
    });

    expect(taskStatusLabel(task)).toBe("Step 1 of 2 · Awaiting review");
    expect(taskStatusTone(task)).toBe("attention");
    expect(isAttention(task)).toBe(true);
  });

  it("reads a working step through its session", () => {
    const task = makeTask({
      stage: "implementation",
      sessionStatus: "working",
      currentStep: 1,
      steps: [
        makeStep({ status: "implementing" }),
        makeStep({ number: 2, file: "2-wire-the-api.md" }),
      ],
    });

    expect(taskStatusLabel(task)).toBe("Step 1 of 2 · Implementing");
    expect(taskStatusTone(task)).toBe("working");
    expect(isAttention(task)).toBe(false);
  });

  it("carries the progress of the review into the tree", () => {
    const task = makeTask({
      stage: "implementation",
      sessionStatus: "waiting",
      currentStep: 2,
      steps: [
        makeStep({ status: "done", commitSha: "abc1234", commitSubject: "Add the login form" }),
        makeStep({
          number: 2,
          file: "2-wire-the-api.md",
          status: "in_review",
          review: makeReview({ staged: 3, total: 5, percent: 60 }),
        }),
      ],
    });

    expect(taskStatusLabel(task)).toBe("Step 2 of 2 · Review 60%");
    expect(taskStatusTone(task)).toBe("attention");
    expect(isAttention(task)).toBe(true);
  });

  it("says the implementation is over once every step is committed", () => {
    const task = makeTask({
      stage: "implementation",
      sessionStatus: "waiting",
      currentStep: 0,
      steps: [
        makeStep({ status: "done" }),
        makeStep({ number: 2, file: "2-wire-the-api.md", status: "done" }),
      ],
    });

    expect(taskStatusLabel(task)).toBe("Implemented");
    expect(taskStatusTone(task)).toBe("done");
    expect(isAttention(task)).toBe(false);
  });

  it("says so when the backend sends no steps", () => {
    const task = makeTask({ stage: "implementation", steps: null });

    expect(taskStatusLabel(task)).toBe("No steps");
    expect(taskStatusTone(task)).toBe("idle");
  });
});

// A repository with a pull request already open puts the task in the review
// half of the stage.
function prTask(...repos: RepoPR[]) {
  return makeTask({ stage: "pr", repos });
}

const API = { repository: "api", repoPath: "/home/dev/projects/api", slug: "api" };

describe("task status in the PR stage", () => {
  it.each([
    ["preparing", "PR · checking GitHub", "working"],
    ["blocked", "PR · blocked", "attention"],
    ["drafting", "PR · writing the draft", "working"],
    ["draft_ready", "PR · draft to approve", "attention"],
    ["opening", "PR · opening the pull request", "working"],
  ] as const)("reads a single repository before the PR exists: %s", (status, label, tone) => {
    const task = prTask(makeRepoPR({ status }));

    expect(taskStatusLabel(task)).toBe(label);
    expect(taskStatusTone(task)).toBe(tone);
  });

  it.each([
    ["reviewing", "PR review · reviewing", "working"],
    ["awaiting_decision", "PR review · decision needed", "attention"],
    ["ready_to_approve", "PR review · ready to approve", "attention"],
    ["committing", "PR review · committing", "working"],
    ["done", "PR review · ready to close", "done"],
  ] as const)("reads a single repository once the PR is open: %s", (status, label, tone) => {
    const task = prTask(makeRepoPR({ status, prNumber: 12 }));

    expect(taskStatusLabel(task)).toBe(label);
    expect(taskStatusTone(task)).toBe(tone);
  });

  it("carries how much of a review is staged", () => {
    const task = prTask(
      makeRepoPR({ status: "in_review", prNumber: 12, review: makeReview({ percent: 60 }) }),
    );

    expect(taskStatusLabel(task)).toBe("PR review · 60% staged");
    expect(taskStatusTone(task)).toBe("attention");
    expect(isAttention(task)).toBe(true);
  });

  it("counts the repositories sharing the state it shows", () => {
    const task = prTask(
      makeRepoPR({ status: "draft_ready" }),
      makeRepoPR({ ...API, status: "draft_ready" }),
    );

    expect(taskStatusLabel(task)).toBe("PR · draft to approve (2 of 2)");
  });

  it("shows the repository that most needs the user", () => {
    const task = prTask(
      makeRepoPR({ status: "drafting" }),
      makeRepoPR({ ...API, status: "draft_ready" }),
    );

    expect(taskStatusLabel(task)).toBe("PR · draft to approve (1 of 2)");
    expect(taskStatusTone(task)).toBe("attention");
  });

  it("puts a block above everything else", () => {
    const task = prTask(
      makeRepoPR({ status: "ready_to_approve", prNumber: 12 }),
      makeRepoPR({ ...API, status: "blocked" }),
    );

    expect(taskStatusLabel(task)).toBe("PR · blocked (1 of 2)");
    expect(taskStatusTone(task)).toBe("attention");
  });

  it("counts the pull requests left to close, skipping the ones without", () => {
    const task = prTask(
      makeRepoPR({ status: "done", prNumber: 12 }),
      makeRepoPR({ ...API, status: "skipped" }),
    );

    expect(taskStatusLabel(task)).toBe("PR review · 1 of 2 ready to close");
    expect(taskStatusTone(task)).toBe("done");
    expect(isAttention(task)).toBe(false);
  });

  it("names the stage alone before the repositories are known", () => {
    const task = prTask();

    expect(taskStatusLabel(task)).toBe("PR");
    expect(taskStatusTone(task)).toBe("idle");
  });
});

describe("taskStageLabel", () => {
  it("names the stage the task is in", () => {
    expect(taskStageLabel(makeTask())).toBe("PRD");
    expect(taskStageLabel(makeTask({ stage: "tech_spec" }))).toBe("Tech spec");
    expect(taskStageLabel(makeTask({ stage: "implementation" }))).toBe("Implementation");
  });

  it("says when a stage was reopened", () => {
    expect(taskStageLabel(makeTask({ stage: "plan", revisiting: true }))).toBe("Plan · revisiting");
  });
});

describe("hasArtifacts", () => {
  it.each([
    [{}, false],
    [{ hasPrd: true }, true],
    [{ hasTechSpec: true }, true],
    [{ steps: [makeStep()] }, true],
  ])("knows whether the task wrote anything %#", (overrides, expected) => {
    expect(hasArtifacts(makeTask(overrides))).toBe(expected);
  });
});
