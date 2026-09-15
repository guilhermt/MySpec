import { describe, expect, it } from "vitest";
import {
  hasArtifacts,
  taskStageLabel,
  taskStatusLabel,
  taskStatusTone,
} from "@/features/task/status";
import type { RepoPR } from "@/lib/wails";
import { makeRepoPR, makeReview, makeSituation, makeStep, makeTask } from "@/test/wails-mock";

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
  ])("reads the agent review of the current step into the tree (%s)", (status, label) => {
    const task = makeTask({
      stage: "implementation",
      sessionStatus: "waiting",
      currentStep: 1,
      steps: [makeStep({ status }), makeStep({ number: 2, file: "2-wire-the-api.md" })],
    });

    expect(taskStatusLabel(task)).toBe(label);
    expect(taskStatusTone(task)).toBe("working");
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

// A repository with a pull request already open puts the task in the review
// half of the stage.
function prTask(...repos: RepoPR[]) {
  return makeTask({ stage: "pr", repos });
}

const API = { repository: "api", repoPath: "/home/dev/projects/api", slug: "api" };

describe("task status in the PR stage", () => {
  it.each([
    ["preparing", "PR · checking GitHub", "working"],
    ["blocked", "PR · blocked", "idle"],
    ["drafting", "PR · writing the draft", "working"],
    ["draft_ready", "PR · draft to approve", "idle"],
    ["awaiting_reply", "PR · waiting for your reply", "idle"],
    ["opening", "PR · opening the pull request", "working"],
  ] as const)("reads a single repository before the PR exists: %s", (status, label, tone) => {
    const task = prTask(makeRepoPR({ status }));

    expect(taskStatusLabel(task)).toBe(label);
    expect(taskStatusTone(task)).toBe(tone);
  });

  it.each([
    ["reviewing", "PR review · reviewing", "working"],
    ["awaiting_decision", "PR review · decision needed", "idle"],
    ["awaiting_reply", "PR review · waiting for your reply", "idle"],
    ["ready_to_approve", "PR review · ready to approve", "idle"],
    ["committing", "PR review · committing", "working"],
  ] as const)("reads a single repository once the PR is open: %s", (status, label, tone) => {
    const task = prTask(makeRepoPR({ status, prNumber: 12 }));

    expect(taskStatusLabel(task)).toBe(label);
    expect(taskStatusTone(task)).toBe(tone);
  });

  it.each([
    ["done", "Closing · waiting for the merge", "idle"],
    ["merged", "Closing · merged, ready to close", "idle"],
    ["pr_closed", "Closing · PR closed without merge", "idle"],
    ["closing", "Closing · closing", "working"],
    ["closed", "Closing · closed", "done"],
  ] as const)("reads a single repository once its review is over: %s", (status, label, tone) => {
    const task = prTask(makeRepoPR({ status, prNumber: 12 }));

    expect(taskStatusLabel(task)).toBe(label);
    expect(taskStatusTone(task)).toBe(tone);
  });

  it("says so when the merge could not be confirmed", () => {
    const task = prTask(
      makeRepoPR({ status: "done", prNumber: 12, canClose: true, checkError: "gh: not found" }),
    );

    expect(taskStatusLabel(task)).toBe("Closing · merge unconfirmed");
    expect(taskStatusTone(task)).toBe("idle");
  });

  it("carries how much of a review is staged", () => {
    const task = prTask(
      makeRepoPR({ status: "in_review", prNumber: 12, review: makeReview({ percent: 60 }) }),
    );

    expect(taskStatusLabel(task)).toBe("PR review · 60% staged");
    expect(taskStatusTone(task)).toBe("idle");
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
    expect(taskStatusTone(task)).toBe("idle");
  });

  it("puts a block above everything else", () => {
    const task = prTask(
      makeRepoPR({ status: "ready_to_approve", prNumber: 12 }),
      makeRepoPR({ ...API, status: "blocked" }),
    );

    expect(taskStatusLabel(task)).toBe("PR · blocked (1 of 2)");
    expect(taskStatusTone(task)).toBe("idle");
  });

  it("puts an agent waiting for a reply between the findings and the approval", () => {
    const replying = prTask(
      makeRepoPR({ status: "ready_to_approve", prNumber: 12 }),
      makeRepoPR({ ...API, status: "awaiting_reply", prNumber: 13 }),
    );
    const deciding = prTask(
      makeRepoPR({ status: "awaiting_reply", prNumber: 12 }),
      makeRepoPR({ ...API, status: "awaiting_decision", prNumber: 13 }),
    );

    expect(taskStatusLabel(replying)).toBe("PR review · waiting for your reply (1 of 2)");
    expect(taskStatusLabel(deciding)).toBe("PR review · decision needed (1 of 2)");
  });

  it("counts how much of the task has already left the workspace", () => {
    const task = prTask(
      makeRepoPR({ status: "merged", prNumber: 12 }),
      makeRepoPR({ ...API, status: "closed", prNumber: 13 }),
    );

    expect(taskStatusLabel(task)).toBe("Closing · merged, ready to close (1 of 2 closed)");
    expect(taskStatusTone(task)).toBe("idle");
  });

  it("waits for the merge with nothing closed yet", () => {
    const task = prTask(
      makeRepoPR({ status: "done", prNumber: 12 }),
      makeRepoPR({ ...API, status: "skipped" }),
    );

    expect(taskStatusLabel(task)).toBe("Closing · waiting for the merge (0 of 2 closed)");
    expect(taskStatusTone(task)).toBe("idle");
  });

  it("names the stage alone before the repositories are known", () => {
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
    const place = { kind: "repo", stage: "", step: 0 };
    const task = {
      ...prTask(makeRepoPR({ status: "draft_ready" }), makeRepoPR({ ...API, status: "done" })),
      situations: [
        makeSituation({
          kind: "draft",
          place: { ...place, repoPath: "/home/dev/projects/web", repository: "web" },
        }),
        makeSituation({
          id: "situation-2",
          kind: "merge",
          group: "closing",
          form: "merge",
          place: { ...place, repoPath: API.repoPath, repository: API.repository },
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
          place: { kind: "step", stage: "", step: 2, repoPath: "", repository: "" },
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
