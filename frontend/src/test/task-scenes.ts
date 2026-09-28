/**
 * The scenes of the task screen (design/screens/task.md §11): the reference task, Rate limit per API
 * key, at nine moments, with the conversations on screen already read. The scene tests and the width
 * tests draw TaskView from them.
 */

import { afterEach, beforeEach, vi } from "vitest";
import type {
  Entry,
  ModelStage,
  PullRequest,
  Situation,
  State,
  Step,
  TaskConversation,
  TaskSummary,
} from "@/lib/wails";
import { sessionKey } from "@/lib/wails";
import { stepTabKey } from "@/store/app-store";
import { fromTranscript, type TranscriptState } from "@/store/transcript";
import {
  makeBoard,
  makeBoardCard,
  makeEntry,
  makePRCheck,
  makePullRequest,
  makeRepository,
  makeSituation,
  makeState,
  makeStep,
  makeStepReviewer,
  makeTask,
  makeTaskCard,
  makeTaskConversation,
  makeTaskModels,
  makeTranscript,
} from "@/test/wails-mock";

/** SCENES are the nine moments of the reference task. */
export const SCENES = [
  "plan",
  "run",
  "ask",
  "error",
  "manual",
  "blocked",
  "checks",
  "findings",
  "close",
] as const;

/** SceneName is one moment of the reference task. */
export type SceneName = (typeof SCENES)[number];

/** Scene is what the store holds to draw a scene: the state and the conversations on screen. */
export interface Scene {
  state: State;
  transcripts: Record<string, TranscriptState>;
  /** openStepTab is the tab the scene has chosen, by stepTabKey. */
  openStepTab: Record<string, "implementer" | "reviewer">;
}

/** REFERENCE_NAME is the name of the reference task. */
export const REFERENCE_NAME = "Rate limit per API key";

/** LONGEST_NAME is a task name as long as a name can be, the longest title a task place has. */
export const LONGEST_NAME = "rotate-the-api-keys-of-every-service-without-downtime-for-client";

/** TASK_ID is the id of the reference task. */
export const TASK_ID = "task-1";

const TITLES = [
  "Add the limits table",
  "Read the limits of a key",
  "Count the requests in a token bucket",
  "Answer 429 with Retry-After",
  "Expose the limits in the admin API",
  "Document the limits",
  "Load test the limiter",
];

/**
 * SCENE_NOW is the moment every scene is drawn at: the tests fix the clock on it, so the ages, the
 * durations and the times the scenes show are the ones of the mock, on any day they run.
 */
export const SCENE_NOW = "2026-09-27T17:40:00Z";

// at is a moment minutes before SCENE_NOW.
const at = (minutes: number) => new Date(Date.parse(SCENE_NOW) - minutes * 60_000).toISOString();

const CHECKED_AT = at(3);

/** WORKTREE is the worktree of the reference task, where its steps and its pull request work. */
const WORKTREE = "/home/dev/.local/share/myspec/worktrees/acme/api/rate-limit";

const CARD = {
  key: "acme/api#412",
  repository: "acme/api",
  number: 412,
  title: "Rate limit per API key",
  url: "https://github.com/acme/api/issues/412",
  status: "In progress",
};

// steps is the plan of the reference task with the current step at n, the ones before it
// committed; n past the last is every step committed. Step 4 has its own mode, Manual.
function steps(n: number, current: Partial<Step> = {}): Step[] {
  return TITLES.map((title, index) => {
    const number = index + 1;
    const manual = number === 4;
    const base = makeStep({
      number,
      title,
      file: `${number}-${title.toLowerCase().replaceAll(" ", "-")}.md`,
      reviewMode: manual ? "manual" : "agent",
      reviewModeAdjusted: manual,
    });
    if (number < n) {
      return { ...base, status: "done", commitSha: `c19f0${number}e`, reviewModeEditable: false };
    }
    return number === n ? { ...base, ...current } : base;
  });
}

// situation is a situation of the reference task, started a while before the scene.
function situation(
  kind: string,
  group: string,
  place: Situation["place"],
  rest: Partial<Situation> = {},
) {
  return makeSituation({
    id: `${kind}-1`,
    taskId: TASK_ID,
    kind,
    group,
    place,
    startedAt: at(4),
    ...rest,
  });
}

const stepPlace = (step: number) => ({ kind: "step", stage: "", step });
const reviewerPlace = (step: number) => ({ kind: "step_review", stage: "", step });
const prPlace = { kind: "pr", stage: "", step: 0 };

// reference is the reference task at a moment.
function reference(overrides: Partial<TaskSummary>, longName: boolean): TaskSummary {
  return makeTask({
    id: TASK_ID,
    name: longName ? LONGEST_NAME : REFERENCE_NAME,
    repository: "acme/api",
    card: makeTaskCard(CARD),
    reviewMode: "agent",
    hasPrd: true,
    hasTechSpec: true,
    ...overrides,
  });
}

// models are the models of the stages as the backend reads them at a moment of the reference task:
// the stages behind it closed, the one of the conversation on screen live, the ones ahead editable.
function models(live: ModelStage[], editable: ModelStage[]): ReturnType<typeof makeTaskModels> {
  const stages: ModelStage[] = [
    "prd",
    "tech_spec",
    "plan",
    "implementation",
    "step_review",
    "pr",
    "pr_review",
  ];
  return makeTaskModels(
    Object.fromEntries(
      stages.map((stage) => [
        stage,
        { live: live.includes(stage), editable: editable.includes(stage) },
      ]),
    ),
  );
}

// conversations are the conversations the reference task has had up to a moment, the oldest first,
// each one started an hour after the one before it: the planning, the steps up to the current one,
// with a reviewer on the steps reviewed by the agent, and those of the pull request.
function conversations(stages: string[]): TaskConversation[] {
  return stages.map((stage, index) =>
    makeTaskConversation({ stage, startedAt: at((stages.length - index) * 60) }),
  );
}

// stepConversations are the conversations of the steps up to n, the reviewer of n only when it ran.
function stepConversations(n: number, reviewerOfN: boolean): string[] {
  return TITLES.slice(0, n).flatMap((_, index) => {
    const number = index + 1;
    const reviewed = number !== 4 && (number < n || reviewerOfN);
    return reviewed ? [`step:${number}`, `step_review:${number}`] : [`step:${number}`];
  });
}

const PLANNING = ["prd", "tech_spec", "plan"];

/** OPUS is the model the steps and the pull request of the reference task run on. */
const OPUS = "claude-opus-5-5[1m]";

function inStep(
  n: number,
  step: Partial<Step>,
  task: Partial<TaskSummary>,
  longName: boolean,
): TaskSummary {
  const reviewerOfN = step.reviewer !== undefined && step.reviewer !== null;
  const working = step.status !== "blocked";
  return reference(
    {
      stage: "implementation",
      currentStep: n,
      sessionModel: OPUS,
      steps: steps(n, { worktreePath: WORKTREE, ...step }),
      branch: "rate-limit",
      baseBranch: "dev",
      worktreePath: WORKTREE,
      models: models(
        [
          ...(working ? (["implementation"] as const) : []),
          ...(reviewerOfN ? (["step_review"] as const) : []),
        ],
        ["implementation", "step_review"],
      ),
      conversations: conversations([
        ...PLANNING,
        ...stepConversations(working ? n : n - 1, reviewerOfN),
      ]),
      ...task,
    },
    longName,
  );
}

function inPR(
  pr: Partial<PullRequest>,
  task: Partial<TaskSummary>,
  longName: boolean,
): TaskSummary {
  return reference(
    {
      stage: "pr",
      currentStep: 0,
      sessionModel: OPUS,
      steps: steps(TITLES.length + 1),
      pr: makePullRequest({
        prNumber: 1284,
        prUrl: "https://github.com/acme/api/pull/1284",
        worktreePath: WORKTREE,
        branch: "rate-limit",
        baseBranch: "origin/dev",
        checkedAt: CHECKED_AT,
        ...pr,
      }),
      branch: "rate-limit",
      baseBranch: "dev",
      worktreePath: WORKTREE,
      models: models(
        pr.sessionStage === "pr_review" ? ["pr_review"] : [],
        pr.sessionStage === "" ? ["pr_review"] : [],
      ),
      conversations: conversations([
        ...PLANNING,
        ...stepConversations(TITLES.length, true),
        "pr",
        ...(pr.sessionStage === "pr_review" ? ["pr_review"] : []),
      ]),
      ...task,
    },
    longName,
  );
}

const reviewer = (overrides: Parameters<typeof makeStepReviewer>[0]) =>
  makeStepReviewer({ sessionStage: "step_review:3", ...overrides });

// talk is a short conversation: what the product asked and what the agent answered.
function talk(ask: string, answer: string, ...rest: Entry[]): Entry[] {
  return [
    makeEntry("user", { user: { text: ask, pending: false, prompt: true, app: false } }),
    makeEntry("assistant", {
      assistant: {
        messageId: "msg_1",
        blockIndex: 0,
        text: answer,
        complete: true,
        interrupted: false,
        parentToolUseId: "",
      },
    }),
    ...rest,
  ];
}

// the task of each scene, as the snapshot gives it.
function taskOf(name: SceneName, longName: boolean): TaskSummary {
  switch (name) {
    case "plan":
      return reference(
        {
          stage: "prd",
          hasPrd: false,
          hasTechSpec: false,
          contextPercent: 12,
          conversations: conversations(["prd"]),
          situations: [situation("reply", "waiting", { kind: "stage", stage: "prd", step: 0 })],
        },
        longName,
      );
    case "run":
      return inStep(
        3,
        { status: "addressing_review", reviewRound: 1, reviewPass: 1, reviewer: reviewer({}) },
        { sessionStatus: "working", turnRunning: true, processRunning: true, contextPercent: 38 },
        longName,
      );
    case "ask":
      return inStep(
        3,
        {
          status: "agent_review",
          reviewPass: 2,
          reviewer: reviewer({ sessionStatus: "needs_answer", contextPercent: 44 }),
        },
        {
          sessionStatus: "needs_permission",
          contextPercent: 31,
          situations: [
            situation("question", "waiting", reviewerPlace(3)),
            situation("permission", "waiting", stepPlace(3), { id: "permission-2" }),
          ],
        },
        longName,
      );
    case "error":
      return inStep(
        3,
        {
          status: "agent_review",
          reviewPass: 2,
          reviewer: reviewer({
            sessionStatus: "error",
            contextPercent: 41,
            lastError: "Claude Code stopped unexpectedly · exit status 1",
          }),
        },
        {
          contextPercent: 31,
          situations: [situation("session_error", "error", reviewerPlace(3))],
        },
        longName,
      );
    case "manual":
      return inStep(
        4,
        {
          status: "in_review",
          review: { files: [], staged: 5, total: 7, percent: 71, error: "" },
        },
        {
          contextPercent: 29,
          situations: [situation("step_review", "waiting", stepPlace(4), { percent: 71 })],
        },
        longName,
      );
    case "blocked":
      return inStep(
        5,
        {
          status: "blocked",
          block: { reason: "dirty_worktree", detail: " M go.mod\n M go.sum\n?? tmp/", files: 3 },
        },
        { situations: [situation("step_blocked", "error", stepPlace(5))] },
        longName,
      );
    case "checks":
      return inPR(
        {
          status: "waiting_checks",
          sessionStage: "",
          checks: [
            makePRCheck({ name: "build", startedAt: at(12), completedAt: at(10) }),
            makePRCheck({ name: "lint", startedAt: at(12), completedAt: at(11) }),
            makePRCheck({ name: "unit", startedAt: at(12), completedAt: at(8) }),
            makePRCheck({
              name: "e2e / rate-limit-burst",
              state: "running",
              conclusion: "",
              startedAt: at(6),
              completedAt: "",
            }),
            makePRCheck({
              name: "e2e / admin",
              state: "queued",
              conclusion: "",
              startedAt: "",
              completedAt: "",
            }),
          ],
        },
        { contextPercent: 18 },
        longName,
      );
    case "findings":
      return inPR(
        {
          status: "awaiting_decision",
          sessionStage: "pr_review",
          contextPercent: 33,
          reports: [{ pass: 1, file: "1.md", clean: false }],
        },
        { situations: [situation("findings", "waiting", prPlace)] },
        longName,
      );
    case "close":
      return inPR(
        {
          status: "merged",
          sessionStage: "pr_review",
          canClose: true,
          contextPercent: 36,
          reports: [{ pass: 1, file: "1.md", clean: true }],
        },
        { situations: [situation("merge", "closing", prPlace, { form: "close" })] },
        longName,
      );
  }
}

// the conversations each scene has on screen, by stage.
function conversationsOf(name: SceneName): Record<string, Entry[]> {
  switch (name) {
    case "plan":
      return {
        prd: talk(
          "Write the PRD for the card acme/api#412.",
          "Should the limits live in the plans table, cached for 60 s, or in the config, with a release? a) plans table b) config",
        ),
      };
    case "run":
      return {
        "step:3": talk(
          "Review 1 · 2 findings · round 1 of 3",
          "Moving the refill into the bucket and running the tests.",
          makeEntry("action"),
        ),
        "step_review:3": talk("Review step 3.", "Review 1 written · changes · 2 findings."),
      };
    case "ask":
      return {
        "step:3": talk("Implement step 3.", "Running the race tests.", makeEntry("permission")),
        "step_review:3": talk(
          "Review step 3, pass 2.",
          "One question first.",
          makeEntry("question"),
        ),
      };
    case "error":
      return {
        "step:3": talk("Implement step 3.", "Done; the tests pass."),
        "step_review:3": talk("Review step 3, pass 2.", "Reading the diff.", makeEntry("error")),
      };
    case "manual":
      return { "step:4": talk("Implement step 4.", "The 429 answers carry Retry-After now.") };
    case "blocked":
    case "checks":
      return {};
    case "findings":
      return {
        pr_review: talk("Review the pull request #1284.", "Report 1 written · 4 findings."),
      };
    case "close":
      return { pr_review: talk("Review the pull request #1284.", "Clean: nothing to change.") };
  }
}

/** sceneTask is a scene of the reference task; longName gives it the longest name a task can have. */
export function sceneTask(name: SceneName, { longName = false } = {}): Scene {
  const task = taskOf(name, longName);
  const transcripts = Object.fromEntries(
    Object.entries(conversationsOf(name)).map(([stage, entries]) => [
      sessionKey(TASK_ID, stage),
      fromTranscript(makeTranscript({ taskId: TASK_ID, stage, entries })),
    ]),
  );
  // The reviewer is on screen where it asks or failed; the implementer everywhere else.
  const tab = name === "ask" || name === "error" ? "reviewer" : "implementer";
  return {
    state: makeState({
      repositories: [
        makeRepository({ owner: "acme", name: "api", fullName: "acme/api", boardId: "board-1" }),
      ],
      boards: [
        makeBoard({
          title: "Platform Roadmap",
          readAt: at(2),
          cards: [
            makeBoardCard({
              ...CARD,
              body: "Each API key gets its own limit, read from its plan.",
              statusId: "in-progress",
            }),
          ],
        }),
      ],
      tasks: [task],
    }),
    transcripts,
    openStepTab: task.currentStep > 0 ? { [stepTabKey(TASK_ID, task.currentStep)]: tab } : {},
  };
}

/**
 * fixSceneClock stops the clock of the page at SCENE_NOW for the test that runs next, and gives it
 * back after; only Date is faked, so the timers of the page still run.
 */
export function fixSceneClock(): void {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(SCENE_NOW));
  });
  afterEach(() => {
    vi.useRealTimers();
  });
}

/** taskInLoop is the task with a step in the loop of the implementer and the reviewer: the run scene. */
export function taskInLoop(options: { longName?: boolean } = {}): Scene {
  return sceneTask("run", options);
}

/** taskInPRReview is the task whose pull request waits for its checks: the checks scene. */
export function taskInPRReview(options: { longName?: boolean } = {}): Scene {
  return sceneTask("checks", options);
}
