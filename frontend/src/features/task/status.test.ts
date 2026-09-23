import { describe, expect, it } from "vitest";
import {
  hasArtifacts,
  taskStageLabel,
  taskStatusLabel,
  taskStatusTone,
} from "@/features/task/status";
import type { PullRequest } from "@/lib/wails";
import { makePullRequest, makeReview, makeSituation, makeStep, makeTask } from "@/test/wails-mock";

describe("task status", () => {
  it.each([
    ["working", "Working", "working"],
    ["waiting", "Waiting", "idle"],
    ["needs_permission", "Permission", "idle"],
    ["needs_answer", "Question", "idle"],
    ["paused", "Paused", "paused"],
    ["error", "Error", "idle"],
  ])("reads %s", (sessionStatus, label, tone) => {
    const task = makeTask({ sessionStatus });

    expect(taskStatusLabel(task)).toBe(label);
    expect(taskStatusTone(task)).toBe(tone);
  });

  it("treats a status it does not know as waiting", () => {
    const task = makeTask({ sessionStatus: "hibernating" });

    expect(taskStatusLabel(task)).toBe("Waiting");
    expect(taskStatusTone(task)).toBe("idle");
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
    expect(taskStatusTone(task)).toBe("idle");
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
  });

  it.each([
    ["agent_review", "Step 1 of 2 · Agent review"],
    ["addressing_review", "Step 1 of 2 · Addressing review"],
  ])("reads the agent review of the current step into the list (%s)", (status, label) => {
    const task = makeTask({
      stage: "implementation",
      sessionStatus: "waiting",
      currentStep: 1,
      steps: [makeStep({ status }), makeStep({ number: 2, file: "2-wire-the-api.md" })],
    });

    expect(taskStatusLabel(task)).toBe(label);
    expect(taskStatusTone(task)).toBe("working");
  });

  it("carries the progress of the review into the list", () => {
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
    expect(taskStatusTone(task)).toBe("idle");
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
  });

  it("says so when the backend sends no steps", () => {
    const task = makeTask({ stage: "implementation", steps: null });

    expect(taskStatusLabel(task)).toBe("No steps");
    expect(taskStatusTone(task)).toBe("idle");
  });
});

// A pull request already open puts the task in the review half of the stage.
function prTask(pr: PullRequest | null = null) {
  return makeTask({ stage: "pr", pr });
}

describe("task status in the PR stage", () => {
  it.each([
    ["preparing", "PR · checking GitHub", "working"],
    ["blocked", "PR · blocked", "idle"],
    ["drafting", "PR · writing the draft", "working"],
    ["draft_ready", "PR · draft to approve", "idle"],
    ["awaiting_reply", "PR · waiting for your reply", "idle"],
    ["opening", "PR · opening the pull request", "working"],
  ] as const)("reads the pull request before it exists: %s", (status, label, tone) => {
    const task = prTask(makePullRequest({ status }));

    expect(taskStatusLabel(task)).toBe(label);
    expect(taskStatusTone(task)).toBe(tone);
  });

  it.each([
    ["reviewing", "PR review · reviewing", "working"],
    ["waiting_checks", "PR review · waiting for checks", "working"],
    ["awaiting_decision", "PR review · decision needed", "idle"],
    ["awaiting_reply", "PR review · waiting for your reply", "idle"],
    ["ready_to_approve", "PR review · ready to approve", "idle"],
    ["committing", "PR review · committing", "working"],
  ] as const)("reads the pull request once it is open: %s", (status, label, tone) => {
    const task = prTask(makePullRequest({ status, prNumber: 12 }));

    expect(taskStatusLabel(task)).toBe(label);
    expect(taskStatusTone(task)).toBe(tone);
  });

  it.each([
    ["done", "Closing · waiting for the merge", "idle"],
    ["merged", "Closing · merged, ready to close", "idle"],
    ["pr_closed", "Closing · PR closed without merge", "idle"],
    ["closing", "Closing · closing", "working"],
    ["closed", "Closing · closed", "done"],
  ] as const)("reads the pull request once its review is over: %s", (status, label, tone) => {
    const task = prTask(makePullRequest({ status, prNumber: 12 }));

    expect(taskStatusLabel(task)).toBe(label);
    expect(taskStatusTone(task)).toBe(tone);
  });

  it("says so when the merge could not be confirmed", () => {
    const task = prTask(
      makePullRequest({
        status: "done",
        prNumber: 12,
        canClose: true,
        checkError: "gh: not found",
      }),
    );

    expect(taskStatusLabel(task)).toBe("Closing · merge unconfirmed");
    expect(taskStatusTone(task)).toBe("idle");
  });

  it("goes back to the review when the pull request stops being ready after it", () => {
    const task = prTask(
      makePullRequest({
        status: "trouble",
        prNumber: 12,
        trouble: { failedChecks: ["ci"], conflict: false },
      }),
    );

    expect(taskStatusLabel(task)).toBe("PR review · checks failed");
    expect(taskStatusTone(task)).toBe("idle");
  });

  it("carries how much of a review is staged", () => {
    const task = prTask(
      makePullRequest({ status: "in_review", prNumber: 12, review: makeReview({ percent: 60 }) }),
    );

    expect(taskStatusLabel(task)).toBe("PR review · 60% staged");
    expect(taskStatusTone(task)).toBe("idle");
  });

  it("names the stage alone before the pull request is known", () => {
    const task = prTask();

    expect(taskStatusLabel(task)).toBe("PR");
    expect(taskStatusTone(task)).toBe("idle");
  });
});

describe("task status with situations", () => {
  it("reads the most urgent situation over what the task is doing", () => {
    const task = makeTask({
      sessionStatus: "working",
      situations: [makeSituation({ kind: "question" })],
    });

    expect(taskStatusLabel(task)).toBe("Question");
    expect(taskStatusTone(task)).toBe("attention");
  });

  it("counts the other situations after the most urgent one", () => {
    const place = { kind: "pr", stage: "", step: 0 };
    const task = {
      ...prTask(makePullRequest({ status: "draft_ready" })),
      situations: [
        makeSituation({ kind: "draft", place }),
        makeSituation({
          id: "situation-2",
          kind: "merge",
          group: "closing",
          form: "merge",
          place,
        }),
      ],
    };

    expect(taskStatusLabel(task)).toBe("Draft to approve +1");
    expect(taskStatusTone(task)).toBe("attention");
  });

  it("takes the colour of an error from the group of the situation", () => {
    const task = makeTask({
      stage: "implementation",
      currentStep: 2,
      steps: [makeStep({ status: "done" }), makeStep({ number: 2, status: "blocked" })],
      situations: [
        makeSituation({
          kind: "step_blocked",
          group: "error",
          place: { kind: "step", stage: "", step: 2 },
        }),
      ],
    });

    expect(taskStatusLabel(task)).toBe("Step 2 blocked");
    expect(taskStatusTone(task)).toBe("error");
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
    [{ hasOneShot: true }, true],
    [{ steps: [makeStep()] }, true],
  ])("knows whether the task wrote anything %#", (overrides, expected) => {
    expect(hasArtifacts(makeTask(overrides))).toBe(expected);
  });
});
