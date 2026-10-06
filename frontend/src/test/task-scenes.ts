/**
 * The scenes of the task screen (design/screens/task.md §11): the reference task, Rate limit per API
 * key, at its moments, with the conversations on screen already read. The scene tests and the width
 * tests draw TaskView from them.
 */

import { afterEach, beforeEach, vi } from "vitest";
import type {
  Entry,
  ModelStage,
  PRReport,
  PullRequest,
  ReviewFinding,
  Situation,
  State,
  Step,
  StepReport,
  TaskConversation,
  TaskSummary,
  Transcript,
} from "@/lib/wails";
import { sessionKey } from "@/lib/wails";
import { stepTabKey } from "@/store/app-store";
import { fromTranscript, type TranscriptState } from "@/store/transcript";
import {
  makeBoard,
  makeBoardCard,
  makeEntry,
  makePRCheck,
  makePRReport,
  makePullRequest,
  makeRepository,
  makeReviewFinding,
  makeSituation,
  makeState,
  makeStep,
  makeStepReviewer,
  makeTask,
  makeTaskCard,
  makeTaskConversation,
  makeTaskModels,
  makeTextPRReport,
  makeTranscript,
} from "@/test/wails-mock";

/** SCENES are the moments of the reference task: the nine of the mock and the ones of the findings. */
export const SCENES = [
  "plan",
  "run",
  "ask",
  "error",
  "manual",
  "blocked",
  "checks",
  "findings",
  "findings-apply",
  "findings-discarded",
  "findings-edit",
  "findings-revised",
  "findings-sent",
  "findings-text",
  "findings-unreadable",
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

// STEP_FILES are the step files of the plan, by the names the mock gives them.
const STEP_FILES = [
  "01-config",
  "02-key-cache",
  "03-token-bucket",
  "04-retry-after",
  "05-per-plan-limits",
  "06-throttle-metrics",
  "07-docs",
];

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

/**
 * STEP_4_FILES are the changed files of step 4, the Manual one, as the mock lists them: five staged,
 * one with a hunk left and one not staged.
 */
const STEP_4_FILES = [
  { path: "internal/http/middleware/ratelimit.go", kind: "modified", staged: true, partial: false },
  {
    path: "internal/http/middleware/ratelimit_test.go",
    kind: "added",
    staged: true,
    partial: false,
  },
  { path: "internal/ratelimit/bucket.go", kind: "modified", staged: true, partial: false },
  { path: "internal/ratelimit/headers.go", kind: "added", staged: true, partial: false },
  { path: "docs/api/errors.md", kind: "modified", staged: true, partial: false },
  { path: "internal/http/middleware/auth.go", kind: "modified", staged: false, partial: true },
  { path: "CHANGELOG.md", kind: "modified", staged: false, partial: false },
];

/** BRANCH is the branch of the reference task, the one its worktree and its pull request are on. */
const BRANCH = "rate-limit-per-api-key";

/** WORKTREE is the worktree of the reference task, where its steps and its pull request work. */
const WORKTREE = `/home/dev/.local/share/myspec/worktrees/acme/api/${BRANCH}`;

// STEP_REPORTS are how many reports the agent review of each step wrote by the time it was done: the
// 9 of the 6 steps it reviewed, as the mock counts them; step 4 is Manual.
const STEP_REPORTS: Record<number, number> = { 1: 1, 2: 1, 3: 2, 5: 2, 6: 1, 7: 2 };

/**
 * stepReports are the reports of the agent review of a step, one per pass: the ones before the last
 * ask for changes, and the last is clean once the step is done. count is the reports the step has.
 */
export function stepReports(number: number, count: number, done: boolean): StepReport[] {
  return Array.from({ length: count }, (_, index) => {
    const clean = done && index === count - 1;
    return {
      pass: index + 1,
      file: `${number}-review-${index + 1}.md`,
      clean,
      findings: clean ? 0 : 2,
    };
  });
}

const CARD = {
  key: "acme/api#412",
  repository: "acme/api",
  number: 412,
  title: "Rate limit per API key",
  url: "https://github.com/acme/api/issues/412",
  status: "In progress",
};

// steps is the plan of the reference task with the current step at n, the ones before it
// committed with the reports of their agent review; n past the last is every step committed. Step 4
// has its own mode, Manual.
function steps(n: number, current: Partial<Step> = {}): Step[] {
  return TITLES.map((title, index) => {
    const number = index + 1;
    const manual = number === 4;
    const base = makeStep({
      number,
      title,
      file: `${STEP_FILES[index]}.md`,
      reviewMode: manual ? "manual" : "agent",
      reviewModeAdjusted: manual,
    });
    if (number < n) {
      return {
        ...base,
        status: "done",
        commitSha: `c19f0${number}e`,
        reviewModeEditable: false,
        reports: stepReports(number, STEP_REPORTS[number] ?? 0, true),
      };
    }
    return number === n ? { ...base, ...current } : base;
  });
}

// situation is a situation of the reference task that has waited some minutes at the moment of the
// scene, as its chip in the mock says.
function situation(
  kind: string,
  group: string,
  place: Situation["place"],
  waited: number,
  rest: Partial<Situation> = {},
) {
  return makeSituation({
    id: `${kind}-1`,
    taskId: TASK_ID,
    kind,
    group,
    place,
    startedAt: at(waited),
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
// each one started an hour after the one before it and the last one an hour before the moment, or
// earlier by `before` minutes: the planning, the steps up to the current one, with a reviewer on the
// steps reviewed by the agent, and those of the pull request.
function conversations(stages: string[], before = 0): TaskConversation[] {
  return stages.map((stage, index) =>
    makeTaskConversation({ stage, startedAt: at((stages.length - index) * 60 + before) }),
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

/**
 * inStep is the reference task in the implementation stage, at step n: the step and the task take
 * the fields given; longName gives it the longest name a task can have.
 */
export function inStep(
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
      branch: BRANCH,
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

/** DRAFT is the pull request draft the agent wrote, which the task keeps once the PR is open. */
const DRAFT = {
  title: "Rate limit per API key",
  body: "Each API key gets its own limit, read from its plan.\n\nCloses acme/api#412.",
  file: "pr.md",
};

// inPR is the reference task at the stage of its pull request, open on GitHub, every step committed.
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
        prState: "open",
        worktreePath: WORKTREE,
        branch: BRANCH,
        baseBranch: "origin/dev",
        checkedAt: CHECKED_AT,
        draft: DRAFT,
        ...pr,
      }),
      branch: BRANCH,
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

// inReview is the task whose review of the pull request waits for the decision of the findings,
// 12 minutes: the report in the pull request given, the situation of its form.
function inReview(
  pr: Partial<PullRequest>,
  kind: string,
  form: string,
  longName: boolean,
): TaskSummary {
  return inPR(
    {
      status: "awaiting_decision",
      sessionStage: "pr_review",
      contextPercent: 33,
      currentPass: 1,
      ...pr,
    },
    { situations: [situation(kind, "waiting", prPlace, 12, { form })] },
    longName,
  );
}

// CHECKS are the checks of the pull request in the checks scene: three passed, one running, one queued.
const CHECKS = [
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
];

// FILES is the address of Files changed of the pull request, where the line of a finding is.
const FILES = "https://github.com/acme/api/pull/1284/files#diff-";

/**
 * SCENE_FINDINGS are the findings of the review of the pull request, none decided: the four of the
 * mock and, the fifth, the one the rewritten report adds. The line of each is the one
 * `internal/bindings` gives it: the sha256 of the path, then R and the line.
 */
export const SCENE_FINDINGS: ReviewFinding[] = [
  makeReviewFinding({
    number: 1,
    title: "A new bucket lets 21 requests through",
    path: "internal/ratelimit/bucket.go",
    line: 31,
    lineUrl: `${FILES}f769211c8b9a825bda7baadb3d9595d21f2f0b2f69c014f04e4e830b5064a809R31`,
    text: "**e2e / rate-limit-burst failed.** A new bucket refills from the zero time on its first read, so a burst of 20 lets 21 requests through. Start `last` at creation.",
  }),
  makeReviewFinding({
    number: 2,
    title: "Retry-After rounds down to 0 s",
    path: "internal/http/middleware/ratelimit.go",
    line: 58,
    lineUrl: `${FILES}588dbf7d67e5ec2ab90b605b7c369de30fd7fb17032683de46598215938b7089R58`,
    text: "`Retry-After` rounds down: a client told to wait 0 s retries at once and gets another 429. Round up to whole seconds.",
  }),
  makeReviewFinding({
    number: 3,
    title: "Enterprise rows fall back to the Free burst",
    path: "",
    line: 0,
    lineUrl: "",
    text: "No migration sets `plans.burst` for the 14 existing Enterprise rows; they fall back to the Free burst of 20.",
  }),
  makeReviewFinding({
    number: 4,
    title: "The docs give Pro 600 requests per minute",
    path: "docs/rate-limits.md",
    line: 12,
    lineUrl: `${FILES}1af327e299bed27b176abac197191cced6025f6c68685a9033776d3723831a8fR12`,
    text: "The table says 600 requests per minute for Pro; `config/plans.yaml` ships 500.",
  }),
  makeReviewFinding({
    number: 5,
    title: "The burst test sleeps a whole second",
    path: "e2e/ratelimit_test.go",
    line: 44,
    lineUrl: `${FILES}a0d0a619700eea6abccb2ad31d7eeb9af04384cecaf706cf0ab68ea52d1dcd7bR44`,
    text: "The test waits `time.Sleep(time.Second)` for the refill. With the clock `bucket.go` already takes, it can move the clock and run in milliseconds.",
  }),
];

/** Decisions are the decisions of the findings of a pass, by number. */
type Decisions = Record<number, "approved" | "discarded">;

// findingsOf are the first n findings of the review with their decisions.
function findingsOf(n: number, decisions: Decisions): ReviewFinding[] {
  return SCENE_FINDINGS.slice(0, n).map((finding) => ({
    ...finding,
    decision: decisions[finding.number] ?? "",
  }));
}

/** ONE_APPROVED is the pass of the findings scene: the first approved, the others to decide. */
const ONE_APPROVED: Decisions = { 1: "approved" };

/** DECIDED is the decision that goes to the agent: 1, 2 and 4 approved, 3 discarded. */
const DECIDED: Decisions = { 1: "approved", 2: "approved", 3: "discarded", 4: "approved" };

// structuredReport is a pass recorded in the format of findings, written minutes before the scene.
function structuredReport(pass: number, overrides: Partial<PRReport>): PRReport {
  return makePRReport({
    pass,
    file: `${pass}.md`,
    clean: false,
    structured: true,
    recorded: true,
    findings: [],
    revision: 1,
    edited: false,
    recordedAt: at(12),
    sentAt: "",
    ...overrides,
  });
}

const reviewer = (overrides: Parameters<typeof makeStepReviewer>[0]) =>
  makeStepReviewer({ sessionStage: "step_review:3", ...overrides });

// talk is a short conversation: what the product asked and what the agent answered.
function talk(ask: string, answer: string, ...rest: Entry[]): Entry[] {
  return [
    makeEntry("user", {
      user: {
        text: ask,
        pending: false,
        prompt: true,
        app: false,
        sent: "",
        appKind: "",
        appPass: 0,
        appRound: 0,
        appRounds: 0,
        appCount: 0,
      },
    }),
    makeEntry("assistant", {
      assistant: {
        messageId: "msg_1",
        blockIndex: 0,
        text: answer,
        complete: true,
        interrupted: false,
        parentToolUseId: "",
        interruptedBy: "",
      },
    }),
    ...rest,
  ];
}

// said is a message of the agent.
function said(text: string): Entry {
  return talk("", text)[1] as Entry;
}

// reviewTalk is the conversation of the review of the pull request: the prompt, the answer and the
// milestones that follow.
function reviewTalk(...rest: Entry[]): Entry[] {
  return talk("Review the pull request #1284.", "Report 1 written.", ...rest);
}

// USER is the user entry of a message: the fields none of them sets.
const USER = {
  text: "",
  pending: false,
  prompt: false,
  app: false,
  sent: "",
  appKind: "",
  appPass: 0,
  appRound: 0,
  appRounds: 0,
  appCount: 0,
};

// milestone is a marker of the conversation, made minutes before the scene.
function milestone(
  type: string,
  minutes: number,
  fields: Partial<NonNullable<Entry["marker"]>> = {},
): Entry {
  const entry = makeEntry("marker", { createdAt: at(minutes) });
  if (entry.marker === null) {
    throw new Error("the marker is not made");
  }
  return { ...entry, marker: { ...entry.marker, type, ...fields } };
}

// productMessage is a message the product sent the agent, made minutes before the scene.
function productMessage(
  appKind: string,
  text: string,
  minutes: number,
  fields: Partial<NonNullable<Entry["user"]>> = {},
): Entry {
  return makeEntry("user", {
    createdAt: at(minutes),
    user: { ...USER, text, app: true, appKind, ...fields },
  });
}

// the milestones of a pass of the review of the pull request, as the mock says them.
const written = (pass: number, findings: number, minutes: number) =>
  milestone("pr_review_written", minutes, { pass, findings });
const decidedOf = (pass: number, minutes: number) =>
  milestone("findings_decided", minutes, { pass, approved: 3, discarded: 1 });
const applied = (minutes: number) =>
  productMessage("apply", "Apply the three approved findings.", minutes, { appCount: 3 });

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
          situations: [situation("reply", "waiting", { kind: "stage", stage: "prd", step: 0 }, 2)],
        },
        longName,
      );
    case "run":
      return inStep(
        3,
        { status: "addressing_review", reviewRound: 1, reviewPass: 1, reviewer: reviewer({}) },
        {
          sessionStatus: "working",
          turnRunning: true,
          processRunning: true,
          // The turn has run for 3m 40s, as the composer of the mock says.
          turnStartedAt: at(220 / 60),
          contextPercent: 38,
        },
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
            situation("question", "waiting", reviewerPlace(3), 18),
            situation("permission", "waiting", stepPlace(3), 4, { id: "permission-2" }),
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
          situations: [situation("session_error", "error", reviewerPlace(3), 5)],
        },
        longName,
      );
    case "manual":
      return inStep(
        4,
        {
          status: "in_review",
          review: { files: STEP_4_FILES, staged: 5, total: 7, percent: 71, error: "" },
        },
        {
          contextPercent: 29,
          situations: [situation("step_review", "waiting", stepPlace(4), 9, { percent: 71 })],
        },
        longName,
      );
    case "blocked":
      return inStep(
        5,
        {
          status: "blocked",
          block: {
            reason: "dirty_worktree",
            detail: " M go.sum\n?? scratch/bench_test.go\n?? scratch/results.txt",
            files: 3,
          },
        },
        { situations: [situation("step_blocked", "error", stepPlace(5), 6)] },
        longName,
      );
    case "checks":
      return inPR(
        {
          status: "waiting_checks",
          sessionStage: "",
          checks: CHECKS,
        },
        { contextPercent: 18 },
        longName,
      );
    case "findings":
    case "findings-edit":
      return inReview(
        { reports: [structuredReport(1, { findings: findingsOf(4, ONE_APPROVED) })] },
        "findings",
        "decide",
        longName,
      );
    case "findings-apply":
      return inReview(
        { reports: [structuredReport(1, { findings: findingsOf(4, DECIDED) })] },
        "findings",
        "apply",
        longName,
      );
    case "findings-discarded":
      return inPR(
        {
          status: "done",
          sessionStage: "pr_review",
          contextPercent: 33,
          currentPass: 1,
          reports: [
            structuredReport(1, {
              findings: findingsOf(4, {
                1: "discarded",
                2: "discarded",
                3: "discarded",
                4: "discarded",
              }),
            }),
          ],
        },
        { situations: [situation("merge", "closing", prPlace, 2, { form: "merge" })] },
        longName,
      );
    case "findings-revised":
      return inReview(
        {
          reports: [
            structuredReport(1, {
              revision: 2,
              recordedAt: at(6),
              findings: findingsOf(5, ONE_APPROVED),
            }),
          ],
        },
        "findings",
        "decide",
        longName,
      );
    case "findings-sent":
      return inPR(
        {
          status: "reviewing",
          sessionStage: "pr_review",
          sessionStatus: "working",
          turnRunning: true,
          processRunning: true,
          turnStartedAt: at(4),
          contextPercent: 33,
          currentPass: 1,
          reports: [structuredReport(1, { findings: findingsOf(4, DECIDED), sentAt: at(4) })],
        },
        {},
        longName,
      );
    case "findings-text":
      return inPR(
        {
          status: "awaiting_decision",
          sessionStage: "pr_review",
          contextPercent: 33,
          currentPass: 0,
          reports: [makeTextPRReport(1, false)],
        },
        { situations: [situation("findings", "waiting", prPlace, 12)] },
        longName,
      );
    case "findings-unreadable":
      return inPR(
        {
          status: "reviewing",
          sessionStage: "pr_review",
          contextPercent: 36,
          currentPass: 2,
          unreadableReport: "The report can't be read: finding 2 does not open with its location.",
          reports: [
            structuredReport(1, {
              recordedAt: at(50),
              sentAt: at(38),
              findings: findingsOf(4, DECIDED),
            }),
            structuredReport(2, { recorded: false, file: "", revision: 0, recordedAt: "" }),
          ],
        },
        { situations: [situation("reply", "waiting", prPlace, 3)] },
        longName,
      );
    case "close":
      // Merged 2 hours ago, the chip of the mock, after the review: the conversation of the review
      // of the pull request started an hour before, and its clean second pass was written last.
      return inPR(
        {
          status: "merged",
          prState: "merged",
          mergedBy: "lnakamura",
          mergedAt: at(120),
          sessionStage: "pr_review",
          canClose: true,
          contextPercent: 36,
          currentPass: 2,
          reports: [
            structuredReport(1, {
              findings: findingsOf(4, DECIDED),
              recordedAt: at(172),
              sentAt: at(164),
            }),
            structuredReport(2, { clean: true, recordedAt: at(125) }),
          ],
        },
        {
          situations: [situation("merge", "closing", prPlace, 120, { form: "close" })],
          conversations: conversations(
            [...PLANNING, ...stepConversations(TITLES.length, true), "pr", "pr_review"],
            120,
          ),
        },
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
          "Should the limits live in the plans table or in the config?\n\na) Plans table, cached 60 s\nb) Config, with a release",
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
        // The reviewer's process stopped: the session error the bar retries, not a failed turn.
        "step_review:3": talk(
          "Review step 3, pass 2.",
          "Reading the diff.",
          makeEntry("error", {
            error: { kind: "process_exit", message: "exit status 1", retryable: true },
          }),
        ),
      };
    case "manual":
      return { "step:4": talk("Implement step 4.", "The 429 answers carry Retry-After now.") };
    case "blocked":
    case "checks":
      return {};
    case "findings":
    case "findings-apply":
    case "findings-edit":
      return { pr_review: reviewTalk(written(1, 4, 12)) };
    case "findings-discarded":
      return { pr_review: reviewTalk(written(1, 4, 12)) };
    case "findings-revised":
      return {
        pr_review: reviewTalk(
          written(1, 4, 12),
          milestone("pr_review_revised", 6, { pass: 1, findings: 5 }),
        ),
      };
    case "findings-sent":
      return {
        pr_review: reviewTalk(written(1, 4, 12), decidedOf(1, 4), applied(4)),
      };
    case "findings-text":
      return { pr_review: reviewTalk(written(1, -1, 12)) };
    case "findings-unreadable":
      return {
        pr_review: reviewTalk(
          written(1, 4, 50),
          decidedOf(1, 38),
          applied(38),
          makeEntry("action", { createdAt: at(30) }),
          milestone("changes_approved", 22, { files: 3 }),
          milestone("committed", 20, {
            sha: "4b7e0aa",
            subject: "Fix the burst off-by-one and round Retry-After up",
            pushed: true,
            number: 1284,
          }),
          milestone("checks_read", 10, { pass: 2, passed: 5, total: 5 }),
          productMessage("pr_pass", "Review the pull request again.", 9, { appPass: 2 }),
          said("Report 2 written."),
        ),
      };
    case "close":
      return {
        pr_review: reviewTalk(
          written(1, 4, 172),
          decidedOf(1, 164),
          applied(164),
          makeEntry("action", { createdAt: at(162) }),
          milestone("changes_approved", 146, { files: 3 }),
          milestone("committed", 144, {
            sha: "4b7e0aa",
            subject: "Fix the burst off-by-one and round Retry-After up",
            pushed: true,
            number: 1284,
          }),
          written(2, 0, 125),
        ),
      };
  }
}

/** sceneTask is a scene of the reference task; longName gives it the longest name a task can have. */
export function sceneTask(name: SceneName, { longName = false } = {}): Scene {
  const transcripts = Object.entries(conversationsOf(name)).map(([stage, entries]) =>
    makeTranscript({ taskId: TASK_ID, stage, entries }),
  );
  // The reviewer is on screen where it asks or failed; the implementer everywhere else.
  const tab = name === "ask" || name === "error" ? "reviewer" : "implementer";
  return sceneOf(taskOf(name, longName), transcripts, tab);
}

/** FixedCardName is a moment of the pull request that ends its conversation in a fixed card. */
export type FixedCardName = "draft" | "checks-after-a-pass";

/**
 * fixedCardScene is the reference task at a moment of its pull request that no scene of the mock
 * draws, whose conversation ends in a fixed card: the draft the agent wrote, or the live checks the
 * second pass of the review waits for.
 */
export function fixedCardScene(name: FixedCardName): Scene {
  const running = CHECKS.map((check, index) =>
    index < 3 ? check : { ...check, state: "running", conclusion: "", completedAt: "" },
  );
  const task =
    name === "draft"
      ? inPR(
          {
            status: "draft_ready",
            prNumber: 0,
            prUrl: "",
            prState: "",
            sessionStage: "pr",
            draft: DRAFT,
          },
          { situations: [situation("draft", "waiting", prPlace, 3)] },
          false,
        )
      : inPR(
          {
            status: "waiting_checks",
            sessionStage: "pr_review",
            reports: [
              makePRReport({
                pass: 1,
                file: "1.md",
                clean: false,
                structured: false,
                recorded: false,
                findings: [],
                revision: 0,
                recordedAt: "",
              }),
            ],
            checks: running,
          },
          {},
          false,
        );
  const stage = name === "draft" ? "pr" : "pr_review";
  const entries =
    name === "draft"
      ? talk("Write the pull request of the task.", "The draft is ready: title and description.")
      : talk("Review the pull request #1284.", "Report 1 written · 4 findings.");
  return sceneOf(task, [makeTranscript({ taskId: TASK_ID, stage, entries })], "implementer");
}

/**
 * sceneOf is what the store holds to draw a moment of the reference task: the task, among the
 * repository and the board it belongs to, the conversations on screen already read, and the tab of
 * its step.
 */
export function sceneOf(
  task: TaskSummary,
  conversations: readonly Transcript[],
  tab: "implementer" | "reviewer",
): Scene {
  const transcripts = Object.fromEntries(
    conversations.map((transcript) => [
      sessionKey(transcript.taskId, transcript.stage),
      fromTranscript(transcript),
    ]),
  );
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
    openStepTab: task.currentStep > 0 ? { [stepTabKey(task.id, task.currentStep)]: tab } : {},
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
