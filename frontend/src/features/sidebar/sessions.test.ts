import { describe, expect, it } from "vitest";
import {
  discussionSessions,
  type ItemSession,
  reviewSessions,
  taskSessions,
  workingSession,
} from "@/features/sidebar/sessions";
import type { TaskSummary } from "@/lib/wails";
import {
  makeDiscussion,
  makePRImplementer,
  makePullRequest,
  makeReviewSummary,
  makeRunningTask,
  makeStep,
  makeStepReviewer,
  makeTask,
} from "@/test/wails-mock";

/** roles is who speaks in each conversation, with the stage it runs under. */
function roles(sessions: ItemSession[]): string[] {
  return sessions.map((session) => `${session.role} ${session.stage}`);
}

function implementing(overrides: Partial<TaskSummary> = {}): TaskSummary {
  return makeTask({ stage: "implementation", currentStep: 1, ...overrides });
}

describe("taskSessions", () => {
  it.each([
    ["prd", "PRD agent prd"],
    ["tech_spec", "Tech spec agent tech_spec"],
    ["plan", "Plan agent plan"],
    ["one_shot", "Planning agent one_shot"],
  ])("names the agent of the %s stage", (stage, want) => {
    expect(roles(taskSessions(makeTask({ stage })))).toEqual([want]);
  });

  it("is the implementer of the step that runs", () => {
    const task = implementing({ steps: [makeStep({ number: 1, status: "implementing" })] });
    expect(roles(taskSessions(task))).toEqual(["Implementer step:1"]);
  });

  it("adds the reviewer of the step when it has one", () => {
    const step = makeStep({ number: 1, status: "agent_review", reviewer: makeStepReviewer() });
    expect(roles(taskSessions(implementing({ steps: [step] })))).toEqual([
      "Implementer step:1",
      "Reviewer step_review:1",
    ]);
  });

  it("has none before the step starts", () => {
    const task = implementing({ steps: [makeStep({ number: 1, status: "not_started" })] });
    expect(taskSessions(task)).toEqual([]);
  });

  it("is the PR agent once the pull request has a conversation", () => {
    expect(roles(taskSessions(makeTask({ stage: "pr", pr: makePullRequest() })))).toEqual([
      "PR agent pr",
    ]);
    const quiet = makeTask({ stage: "pr", pr: makePullRequest({ sessionStage: "" }) });
    expect(taskSessions(quiet)).toEqual([]);
  });

  it("is the reviewer, not the PR agent, once the session is the review's", () => {
    const task = makeTask({
      stage: "pr",
      pr: makePullRequest({ sessionStage: "pr_review", prNumber: 12 }),
    });

    expect(roles(taskSessions(task))).toEqual(["Reviewer pr_review"]);
  });

  it("adds the implementer of the review while it has a session", () => {
    const task = makeTask({
      stage: "pr",
      pr: makePullRequest({
        sessionStage: "pr_review",
        prNumber: 12,
        implementer: makePRImplementer({ sessionStatus: "working", contextPercent: 30 }),
      }),
    });

    expect(roles(taskSessions(task))).toEqual(["Reviewer pr_review", "Implementer pr_fix"]);
    expect(taskSessions(task)[1]).toMatchObject({ working: true, contextPercent: 30 });
  });

  it("carries the state and the action of the session", () => {
    const [session] = taskSessions(
      makeTask({
        sessionStatus: "working",
        turnRunning: true,
        turnStartedAt: "2026-09-26T14:05:00Z",
        actionLabel: "Reading",
        actionTarget: "internal/app/state.go",
      }),
    );
    expect(session).toMatchObject({
      status: "working",
      working: true,
      turnRunning: true,
      turnStartedAt: "2026-09-26T14:05:00Z",
      actionLabel: "Reading",
      actionTarget: "internal/app/state.go",
    });
  });
});

describe("reviewSessions and discussionSessions", () => {
  it("are the reviewer and the discussion agent once they opened", () => {
    expect(roles(reviewSessions(makeReviewSummary()))).toEqual(["Reviewer review"]);
    expect(roles(discussionSessions(makeDiscussion()))).toEqual(["Discussion agent discussion"]);
    expect(reviewSessions(makeReviewSummary({ sessionStage: "" }))).toEqual([]);
    expect(discussionSessions(makeDiscussion({ sessionStage: "" }))).toEqual([]);
  });
});

describe("workingSession", () => {
  const NOW = Date.parse("2026-09-26T14:20:00Z");

  const session = (role: string, working: boolean, turnStartedAt: string): ItemSession => ({
    role,
    stage: "prd",
    status: working ? "working" : "waiting",
    working,
    turnRunning: working,
    processRunning: true,
    retryAttempt: 0,
    contextPercent: null,
    turnStartedAt,
    actionLabel: "",
    actionTarget: "",
    background: 0,
  });

  it("is the working session whose turn started first", () => {
    const sessions = [
      session("Implementer", true, "2026-09-26T14:10:00Z"),
      session("Reviewer", true, "2026-09-26T14:05:00Z"),
      session("PR agent", false, "2026-09-26T14:00:00Z"),
    ];
    expect(workingSession(sessions, NOW)?.role).toBe("Reviewer");
  });

  it("puts a turn without a start last and keeps the first of a tie", () => {
    expect(
      workingSession(
        [session("Implementer", true, ""), session("Reviewer", true, "2026-09-26T14:05:00Z")],
        NOW,
      )?.role,
    ).toBe("Reviewer");
    expect(
      workingSession(
        [
          session("Implementer", true, "2026-09-26T14:05:00Z"),
          session("Reviewer", true, "2026-09-26T14:05:00Z"),
        ],
        NOW,
      )?.role,
    ).toBe("Implementer");
  });

  it("is null when none works", () => {
    expect(workingSession([session("Implementer", false, "")], NOW)).toBeNull();
  });
});

describe("the background count of a session", () => {
  it("counts the background tasks of the stage of each conversation", () => {
    const task = implementing({
      steps: [
        makeStep({
          number: 1,
          status: "agent_review",
          reviewer: makeStepReviewer({ sessionStage: "step_review:1" }),
        }),
      ],
      running: [
        {
          stage: "step:1",
          tasks: [makeRunningTask(), makeRunningTask({ taskId: "b" })],
        },
        { stage: "step_review:1", tasks: [makeRunningTask({ background: false })] },
      ],
    });

    expect(taskSessions(task).map((session) => session.background)).toEqual([2, 0]);
  });
});
