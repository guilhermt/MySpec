import { describe, expect, it } from "vitest";
import {
  contextDetail,
  isPaused,
  pauseRefusal,
  screenSession,
  speaker,
  type TaskSession,
  waitingSession,
} from "@/features/task/task-session";
import type { Step, TaskSummary } from "@/lib/wails";
import { makePullRequest, makeStep, makeStepReviewer, makeTask } from "@/test/wails-mock";

const PAUSED_AT = "2026-09-27T14:52:00Z";

function inStep(step: Partial<Step>, task: Partial<TaskSummary> = {}): TaskSummary {
  return makeTask({
    stage: "implementation",
    currentStep: 3,
    steps: [makeStep({ number: 3, ...step })],
    ...task,
  });
}

const reviewer = makeStepReviewer({
  sessionStage: "step_review:3",
  sessionStatus: "working",
  contextPercent: 30,
  pausedAt: PAUSED_AT,
});

describe("waitingSession", () => {
  it.each([
    ["the PRD", makeTask({ stage: "prd" }), "prd", "PRD agent"],
    ["the tech spec", makeTask({ stage: "tech_spec" }), "tech_spec", "Tech spec agent"],
    ["the plan", makeTask({ stage: "plan" }), "plan", "Plan agent"],
    [
      "One-Shot planning",
      makeTask({ mode: "one_shot", stage: "one_shot" }),
      "one_shot",
      "Planning agent",
    ],
    ["a step implementing", inStep({ status: "implementing" }), "step:3", "Implementer"],
    [
      "a step under a pass",
      inStep({ status: "agent_review", reviewer }),
      "step_review:3",
      "Reviewer",
    ],
    [
      "a step addressing a review",
      inStep({ status: "addressing_review", reviewer }),
      "step:3",
      "Implementer",
    ],
    [
      "a step between the turn and the reviewer",
      inStep({ status: "agent_review" }),
      "step:3",
      "Implementer",
    ],
    [
      "the pull request draft",
      makeTask({ stage: "pr", pr: makePullRequest({ status: "drafting", sessionStage: "pr" }) }),
      "pr",
      "PR agent",
    ],
    [
      "the pull request review",
      makeTask({
        stage: "pr",
        pr: makePullRequest({ status: "reviewing", prNumber: 12, sessionStage: "pr_review" }),
      }),
      "pr_review",
      "PR agent",
    ],
  ])("is the conversation of %s", (_, task, stage, role) => {
    expect(waitingSession(task)).toMatchObject({ stage, role });
  });

  it.each([
    ["a step not started", inStep({ status: "not_started" })],
    ["a step preparing", inStep({ status: "preparing" })],
    ["a step blocked", inStep({ status: "blocked" })],
    [
      "every step committed",
      makeTask({ stage: "implementation", currentStep: 0, steps: [makeStep({ status: "done" })] }),
    ],
    [
      "a pull request waiting for its checks",
      makeTask({
        stage: "pr",
        pr: makePullRequest({ status: "waiting_checks", sessionStage: "" }),
      }),
    ],
  ])("is none in %s", (_, task) => {
    expect(waitingSession(task)).toBeNull();
  });

  it("carries the state of the reviewer, with the time of its pause", () => {
    expect(waitingSession(inStep({ status: "agent_review", reviewer }))).toMatchObject({
      sessionStatus: "working",
      contextPercent: 30,
      pausedAt: PAUSED_AT,
    });
  });
});

describe("screenSession", () => {
  const both = inStep({ status: "addressing_review", reviewer }, { contextPercent: 60 });

  it.each([
    ["the implementer tab", both, "implementer", "step:3", 60],
    ["the reviewer tab", both, "reviewer", "step_review:3", 30],
    ["a step without a reviewer", inStep({ status: "implementing" }), "reviewer", "step:3", 0],
    ["the PRD", makeTask({ stage: "prd", contextPercent: 12 }), "implementer", "prd", 12],
  ] as const)("is the conversation of %s", (_, task, tab, stage, contextPercent) => {
    expect(screenSession(task, tab)).toMatchObject({ stage, contextPercent });
  });

  it.each([
    ["a step blocked", inStep({ status: "blocked" })],
    ["a step preparing", inStep({ status: "preparing" })],
    ["a step not started", inStep({ status: "not_started" })],
    [
      "a pull request waiting for its checks without a conversation",
      makeTask({
        stage: "pr",
        pr: makePullRequest({ status: "waiting_checks", sessionStage: "" }),
      }),
    ],
    [
      "a pull request done",
      makeTask({ stage: "pr", pr: makePullRequest({ status: "done", sessionStage: "pr_review" }) }),
    ],
    [
      "a pull request merged",
      makeTask({
        stage: "pr",
        pr: makePullRequest({ status: "merged", sessionStage: "pr_review" }),
      }),
    ],
  ])("is none in %s", (_, task) => {
    expect(screenSession(task, "implementer")).toBeNull();
  });
});

describe("isPaused", () => {
  it.each([
    ["a paused planning stage", makeTask({ sessionStatus: "paused" }), true],
    ["a working planning stage", makeTask({ sessionStatus: "working" }), false],
    [
      "a pass with the reviewer paused",
      inStep({ status: "agent_review", reviewer: { ...reviewer, sessionStatus: "paused" } }),
      true,
    ],
    [
      "a pass with only the implementer paused",
      inStep({ status: "agent_review", reviewer }, { sessionStatus: "paused" }),
      false,
    ],
    [
      "a paused pull request",
      makeTask({
        stage: "pr",
        pr: makePullRequest({ status: "drafting", sessionStatus: "paused" }),
      }),
      true,
    ],
    ["a step without a session", inStep({ status: "blocked" }, { sessionStatus: "paused" }), false],
  ])("tells %s", (_, task, paused) => {
    expect(isPaused(task)).toBe(paused);
  });
});

/** sessionOf is the session a task waits on, which the task of a test always has. */
function sessionOf(task: TaskSummary): TaskSession {
  const session = waitingSession(task);
  if (session === null) {
    throw new Error("the task waits on no session");
  }
  return session;
}

describe("speaker", () => {
  it.each([
    [makeTask({ stage: "prd" }), "PRD agent"],
    [makeTask({ stage: "tech_spec" }), "tech spec agent"],
    [makeTask({ stage: "plan" }), "plan agent"],
    [makeTask({ mode: "one_shot", stage: "one_shot" }), "planning agent"],
    [inStep({ status: "implementing" }), "implementer"],
    [inStep({ status: "agent_review", reviewer }), "reviewer"],
    [makeTask({ stage: "pr", pr: makePullRequest({ status: "drafting" }) }), "PR agent"],
  ])("names who talks inside a sentence %#", (task, name) => {
    expect(speaker(sessionOf(task))).toBe(name);
  });
});

describe("pauseRefusal", () => {
  it.each([
    [
      "the PRD",
      makeTask({ sessionStatus: "error" }),
      "Nothing is running to pause: the PRD agent's session stopped with an error. Retry it, or discard and restart the PRD.",
    ],
    [
      "the tech spec",
      makeTask({ stage: "tech_spec", sessionStatus: "error" }),
      "Nothing is running to pause: the tech spec agent's session stopped with an error. Retry it, or discard and restart the tech spec.",
    ],
    [
      "One-Shot planning",
      makeTask({ mode: "one_shot", stage: "one_shot", sessionStatus: "error" }),
      "Nothing is running to pause: the planning agent's session stopped with an error. Retry it, or discard and restart planning.",
    ],
    [
      "a step",
      inStep({ status: "implementing" }, { sessionStatus: "error" }),
      "Nothing is running to pause: the implementer's session stopped with an error. Retry it, or discard the step.",
    ],
    [
      "a pass",
      inStep({ status: "agent_review", reviewer: { ...reviewer, sessionStatus: "error" } }),
      "Nothing is running to pause: the reviewer's session stopped with an error. Retry it, or discard the step.",
    ],
    [
      "the pull request",
      makeTask({
        stage: "pr",
        pr: makePullRequest({ status: "drafting", sessionStatus: "error" }),
      }),
      "Nothing is running to pause: the PR agent's session stopped with an error. Retry it.",
    ],
  ])("says nothing runs to pause after an error in %s", (_, task, reason) => {
    expect(pauseRefusal(task, sessionOf(task))).toBe(reason);
  });

  it.each(["working", "waiting", "paused", "needs_permission"])(
    "lets a %s session be paused or resumed",
    (sessionStatus) => {
      const task = makeTask({ sessionStatus });
      expect(pauseRefusal(task, sessionOf(task))).toBeNull();
    },
  );
});

describe("contextDetail", () => {
  it("says who used how much of the context", () => {
    expect(contextDetail(sessionOf(inStep({ status: "agent_review", reviewer })))).toBe(
      "Context used by the reviewer: 30%",
    );
  });

  it("says … before the first reading", () => {
    expect(contextDetail(sessionOf(makeTask({ contextPercent: 0 })))).toBe(
      "Context used by the PRD agent: …",
    );
  });
});
