import { describe, expect, it } from "vitest";
import {
  blockRequestOf,
  findingsRequestOf,
  type OtherConversationModel,
  otherConversationOf,
  type PendingRequest,
  pausedRequestOf,
  planRequestOf,
  retryLabelOf,
  sessionRequestOf,
  type TaskRequestModel,
  taskRequestOf,
} from "@/features/task/request";
import { cloneMissingText } from "@/lib/repositories";
import type { PullRequest, Situation, Step, StepReviewer, TaskSummary } from "@/lib/wails";
import type { PrDraft, StepTab } from "@/store/app-store";
import {
  makePullRequest,
  makeRepository,
  makeReview,
  makeSituation,
  makeStep,
  makeStepReviewer,
  makeTask,
} from "@/test/wails-mock";

const NOW = Date.parse("2026-09-27T15:00:00Z");
const NINE_MINUTES_AGO = new Date(NOW - 9 * 60_000).toISOString();
const REPOSITORY = makeRepository();

const STEP_PLACE = { kind: "step", stage: "", step: 4 };
const PR_PLACE = { kind: "pr", stage: "", step: 0 };

function situation(kind: string, group: string, form: string, place = PR_PLACE): Situation {
  return makeSituation({ id: `s-${kind}`, kind, group, form, place, startedAt: NINE_MINUTES_AGO });
}

/** Scene is a state of the task twice: waiting on its situation, and paused with the same state. */
interface Scene {
  waiting: TaskSummary;
  paused: TaskSummary;
}

function inStep(step: Partial<Step>, found: Situation): Scene {
  const task = (sessionStatus: string, situations: Situation[]) =>
    makeTask({
      stage: "implementation",
      currentStep: 4,
      sessionStatus,
      steps: [makeStep({ number: 4, reviewMode: "manual", status: "in_review", ...step })],
      situations,
    });
  return { waiting: task("waiting", [found]), paused: task("paused", []) };
}

function inPR(pr: Partial<PullRequest>, found: Situation): Scene {
  const task = (sessionStatus: string, situations: Situation[]) =>
    makeTask({
      stage: "pr",
      pr: makePullRequest({ prNumber: 1284, sessionStage: "pr_review", sessionStatus, ...pr }),
      situations,
    });
  return { waiting: task("waiting", [found]), paused: task("paused", []) };
}

const WAIT = { short: "9m", long: "9 minutes", tone: "wait" } as const;
const ERROR = { short: "9m", long: "9 minutes", tone: "error" } as const;
const CLOSE = { short: "9m", long: "9 minutes", tone: "close" } as const;

const OPEN_IN_EDITOR = {
  action: "openInEditor",
  label: "Open in VS Code",
  variant: "secondary",
  shortcut: "Ctrl+E",
  loadingLabel: "",
} as const;
const OPEN_PR = {
  action: "openPR",
  label: "Open PR",
  variant: "secondary",
  loadingLabel: "",
} as const;
const approve = (action: "approveStep" | "approvePR", disabledReason?: string) => ({
  action,
  label: "Approve",
  variant: "primary" as const,
  loadingLabel: "Approving…",
  ...(disabledReason === undefined ? {} : { disabledReason }),
});
const REVIEW_AGAIN = {
  action: "reviewAgain",
  label: "Review again",
  variant: "primary",
  loadingLabel: "Asking…",
  tooltip: "Review again reads GitHub and turns this into findings of a new pass.",
} as const;
const closeTask = (variant: "primary" | "secondary", disabledReason?: string) => ({
  action: "closeTask" as const,
  label: "Close task",
  variant,
  loadingLabel: "Closing…",
  ...(disabledReason === undefined ? {} : { disabledReason }),
});

const staged = (staged: number, total: number, error = "") =>
  makeReview({ staged, total, percent: Math.round((staged / total) * 100), error });

const DRAFT = { title: "Rate limit per API key", body: "Adds a limiter.", file: "pr.md" };

// Each situation of §4.2 and the paused state that would give it, on the same row: the two sources
// draw the same bar, the paused one quiet, without a chip.
describe("taskRequestOf and pausedRequestOf", () => {
  it.each<[string, Scene, TaskRequestModel]>([
    [
      "step_review, reviewing",
      inStep({ review: staged(5, 7) }, situation("step_review", "waiting", "review", STEP_PLACE)),
      {
        form: "tinted",
        glyph: "wait",
        label: "Review step 4",
        time: WAIT,
        progress: "5 of 7 files staged · 71%",
        status: "Review step 4",
        actions: [OPEN_IN_EDITOR, approve("approveStep", "Stage 2 more files")],
        situationId: "s-step_review",
        focus: "primary",
      },
    ],
    [
      "step_review, one file left",
      inStep({ review: staged(6, 7) }, situation("step_review", "waiting", "staged", STEP_PLACE)),
      {
        form: "tinted",
        glyph: "wait",
        label: "Review step 4",
        time: WAIT,
        progress: "6 of 7 files staged · 86%",
        status: "Review step 4",
        actions: [OPEN_IN_EDITOR, approve("approveStep", "Stage 1 more file")],
        situationId: "s-step_review",
        focus: "primary",
      },
    ],
    [
      "step_review, to approve",
      inStep(
        { status: "ready_to_approve", review: staged(7, 7) },
        situation("step_review", "waiting", "approve", STEP_PLACE),
      ),
      {
        form: "tinted",
        glyph: "wait",
        label: "Approve step 4",
        time: WAIT,
        progress: "7 of 7 files staged · 100%",
        status: "Approve step 4",
        actions: [OPEN_IN_EDITOR, approve("approveStep")],
        situationId: "s-step_review",
        focus: "primary",
      },
    ],
    [
      "step_review, after a failed commit and three rounds",
      inStep(
        { review: staged(5, 7), commitFailed: true, reviewFallback: "rounds_exhausted" },
        situation("step_review", "waiting", "review", STEP_PLACE),
      ),
      {
        form: "tinted",
        glyph: "wait",
        label: "Review step 4",
        time: WAIT,
        progress:
          "5 of 7 files staged · 71% · the last approval didn't produce a commit · the agent review didn't come clean after three rounds",
        status: "Review step 4",
        actions: [OPEN_IN_EDITOR, approve("approveStep", "Stage 2 more files")],
        situationId: "s-step_review",
        focus: "primary",
      },
    ],
    [
      "step_review, the worktree unreadable",
      inStep(
        { review: staged(0, 0, "git status failed") },
        situation("step_review", "waiting", "review", STEP_PLACE),
      ),
      {
        form: "tinted",
        glyph: "wait",
        label: "Review step 4",
        time: WAIT,
        status: "Review step 4",
        actions: [OPEN_IN_EDITOR, approve("approveStep", "The worktree couldn't be read")],
        situationId: "s-step_review",
        focus: "primary",
      },
    ],
    [
      "step_empty",
      inStep({ status: "nothing_to_commit" }, situation("step_empty", "waiting", "", STEP_PLACE)),
      {
        form: "tinted",
        glyph: "wait",
        label: "Step 4 has no changes",
        time: WAIT,
        status: "Step 4 has no changes",
        actions: [
          {
            action: "discardStep",
            label: "Discard step 4…",
            variant: "secondary",
            loadingLabel: "",
          },
        ],
        situationId: "s-step_empty",
        focus: "primary",
      },
    ],
    [
      "draft",
      inPR(
        { status: "draft_ready", prNumber: 0, sessionStage: "pr", draft: DRAFT },
        situation("draft", "waiting", ""),
      ),
      {
        form: "tinted",
        glyph: "wait",
        label: "Draft to approve",
        time: WAIT,
        status: "Draft to approve",
        actions: [
          {
            action: "approveDraft",
            label: "Approve draft",
            variant: "primary",
            loadingLabel: "Approving…",
          },
          {
            action: "discardDraft",
            label: "Discard draft",
            variant: "secondary",
            loadingLabel: "",
          },
        ],
        situationId: "s-draft",
        focus: "primary",
      },
    ],
    [
      "draft, without a title",
      inPR(
        { status: "draft_ready", prNumber: 0, sessionStage: "pr", draft: { ...DRAFT, title: " " } },
        situation("draft", "waiting", ""),
      ),
      {
        form: "tinted",
        glyph: "wait",
        label: "Draft to approve",
        time: WAIT,
        status: "Draft to approve",
        actions: [
          {
            action: "approveDraft",
            label: "Approve draft",
            variant: "primary",
            loadingLabel: "Approving…",
            disabledReason: "Write a title and a description",
          },
          {
            action: "discardDraft",
            label: "Discard draft",
            variant: "secondary",
            loadingLabel: "",
          },
        ],
        situationId: "s-draft",
        focus: "primary",
      },
    ],
    [
      "changes_review",
      inPR(
        { status: "in_review", review: staged(3, 5) },
        situation("changes_review", "waiting", "review"),
      ),
      {
        form: "tinted",
        glyph: "wait",
        label: "Review changes",
        time: WAIT,
        progress: "3 of 5 files staged · 60%",
        status: "Review changes",
        actions: [OPEN_IN_EDITOR, approve("approvePR", "Stage 2 more files")],
        situationId: "s-changes_review",
        focus: "primary",
      },
    ],
    [
      "changes_review, to approve after a failed commit",
      inPR(
        { status: "ready_to_approve", review: staged(5, 5), commitFailed: true },
        situation("changes_review", "waiting", "approve"),
      ),
      {
        form: "tinted",
        glyph: "wait",
        label: "Approve changes",
        time: WAIT,
        progress: "5 of 5 files staged · 100% · the last approval didn't produce a commit",
        status: "Approve changes",
        actions: [OPEN_IN_EDITOR, approve("approvePR")],
        situationId: "s-changes_review",
        focus: "primary",
      },
    ],
    [
      "merge, waiting for the merge",
      inPR({ status: "done" }, situation("merge", "waiting", "merge")),
      {
        form: "tinted",
        glyph: "wait",
        label: "Ready to merge",
        place: "#1284",
        time: WAIT,
        status: "Ready to merge · #1284",
        actions: [OPEN_PR],
        situationId: "s-merge",
        focus: "primary",
      },
    ],
    [
      "merge, waiting for the merge without the clone",
      inPR({ status: "done", cloneMissing: true }, situation("merge", "waiting", "merge")),
      {
        form: "tinted",
        glyph: "wait",
        label: "Ready to merge",
        place: "#1284",
        time: WAIT,
        progress: cloneMissingText(REPOSITORY),
        status: "Ready to merge · #1284",
        actions: [OPEN_PR],
        situationId: "s-merge",
        focus: "primary",
      },
    ],
    [
      "merge, the closing offered without a confirmed merge",
      inPR({ status: "done", canClose: true }, situation("merge", "closing", "close")),
      {
        form: "closing",
        glyph: "close",
        label: "Ready to close",
        place: "#1284",
        time: CLOSE,
        progress:
          "Couldn't confirm the merge · Removes the worktree and the branch, then updates dev",
        status: "Ready to close · #1284",
        actions: [OPEN_PR, closeTask("primary")],
        situationId: "s-merge",
        focus: "primary",
      },
    ],
    [
      "merge, the closing offered after the merge couldn't be read",
      inPR(
        { status: "done", canClose: true, checkError: "gh: HTTP 502" },
        situation("merge", "closing", "close"),
      ),
      {
        form: "closing",
        glyph: "close",
        label: "Ready to close",
        place: "#1284",
        time: CLOSE,
        progress:
          "Couldn't confirm the merge · Removes the worktree and the branch, then updates dev",
        progressTooltip: "gh: HTTP 502",
        status: "Ready to close · #1284",
        actions: [OPEN_PR, closeTask("primary")],
        situationId: "s-merge",
        focus: "primary",
      },
    ],
    [
      "merge, merged",
      inPR({ status: "merged", canClose: true }, situation("merge", "closing", "close")),
      {
        form: "closing",
        glyph: "close",
        label: "Ready to close",
        place: "#1284 merged",
        time: CLOSE,
        progress: "Removes the worktree and the branch, then updates dev",
        status: "Ready to close · #1284 merged",
        actions: [closeTask("primary")],
        situationId: "s-merge",
        focus: "primary",
      },
    ],
    [
      "merge, merged without the clone",
      inPR({ status: "merged", cloneMissing: true }, situation("merge", "closing", "close")),
      {
        form: "closing",
        glyph: "close",
        label: "Ready to close",
        place: "#1284 merged",
        time: CLOSE,
        progress: "Removes the worktree and the branch, then updates dev",
        status: "Ready to close · #1284 merged",
        actions: [closeTask("primary", cloneMissingText(REPOSITORY))],
        situationId: "s-merge",
        focus: "bar",
      },
    ],
    [
      "pr_trouble, checks and a conflict",
      inPR(
        { status: "trouble", trouble: { failedChecks: ["lint", "test"], conflict: true } },
        situation("pr_trouble", "error", "checks_conflict"),
      ),
      {
        form: "error",
        glyph: "error",
        label: "Checks failed · conflict",
        time: ERROR,
        progress: "Failed: lint, test · Conflict with dev",
        status: "Checks failed · conflict",
        actions: [REVIEW_AGAIN],
        situationId: "s-pr_trouble",
        focus: "primary",
      },
    ],
    [
      "pr_trouble, the closing offered",
      inPR(
        { status: "trouble", canClose: true, trouble: { failedChecks: ["lint"], conflict: false } },
        situation("pr_trouble", "error", "checks"),
      ),
      {
        form: "error",
        glyph: "error",
        label: "Checks failed",
        time: ERROR,
        progress: "Failed: lint · Couldn't confirm the merge",
        status: "Checks failed",
        actions: [REVIEW_AGAIN, closeTask("secondary")],
        situationId: "s-pr_trouble",
        focus: "primary",
      },
    ],
    [
      "pr_trouble, the closing offered after the merge couldn't be read",
      inPR(
        {
          status: "trouble",
          canClose: true,
          checkError: "gh: HTTP 502",
          trouble: { failedChecks: [], conflict: true },
        },
        situation("pr_trouble", "error", "conflict"),
      ),
      {
        form: "error",
        glyph: "error",
        label: "Conflict with base",
        time: ERROR,
        progress: "Conflict with dev · Couldn't confirm the merge",
        progressTooltip: "gh: HTTP 502",
        status: "Conflict with base",
        actions: [REVIEW_AGAIN, closeTask("secondary")],
        situationId: "s-pr_trouble",
        focus: "primary",
      },
    ],
    [
      "pr_closed",
      inPR({ status: "pr_closed" }, situation("pr_closed", "error", "")),
      {
        form: "error",
        glyph: "error",
        label: "PR closed unmerged",
        place: "#1284",
        time: ERROR,
        status: "PR closed unmerged · #1284",
        actions: [
          { action: "deleteTask", label: "Delete task…", variant: "secondary", loadingLabel: "" },
        ],
        situationId: "s-pr_closed",
        focus: "primary",
      },
    ],
  ])("draws %s the same from both sources", (_name, scene, bar) => {
    expect(taskRequestOf(scene.waiting, "implementer", NOW, REPOSITORY)).toEqual(bar);
    expect(pausedRequestOf(scene.paused, REPOSITORY)).toEqual({
      ...bar,
      form: "quiet",
      glyph: "paused",
      time: undefined,
      situationId: null,
    });
    expect(taskRequestOf(scene.paused, "reviewer", NOW, REPOSITORY)).toEqual(
      pausedRequestOf(scene.paused, REPOSITORY),
    );
  });

  it("draws no bar for a paused step whose worktree became unreadable", () => {
    // review_failed carries the situation worktree_unreadable, which task 3 doesn't show; a paused
    // task in this state waits on nothing the bar can draw.
    const { paused } = inStep(
      { status: "review_failed", review: staged(0, 0, "git status failed") },
      situation("step_review", "waiting", "review", STEP_PLACE),
    );

    expect(pausedRequestOf(paused, REPOSITORY)).toBeNull();
    expect(taskRequestOf(paused, "implementer", NOW, REPOSITORY)).toBeNull();
  });

  it("draws ready_to_continue from its situation, and nothing once paused", () => {
    const task = (sessionStatus: string, situations: Situation[]) =>
      makeTask({
        stage: "tech_spec",
        revisiting: true,
        canContinue: true,
        sessionStatus,
        situations,
      });
    const found = situation("ready_to_continue", "waiting", "", {
      kind: "stage",
      stage: "tech_spec",
      step: 0,
    });

    expect(taskRequestOf(task("waiting", [found]), "implementer", NOW)).toEqual({
      form: "tinted",
      glyph: "wait",
      label: "Ready to continue",
      place: "Tech spec",
      time: WAIT,
      status: "Ready to continue · Tech spec",
      actions: [
        { action: "continue", label: "Continue", variant: "primary", loadingLabel: "Continuing…" },
      ],
      situationId: "s-ready_to_continue",
      focus: "primary",
    });
    expect(pausedRequestOf(task("paused", []))).toBeNull();
    expect(taskRequestOf(task("paused", []), "implementer", NOW)).toBeNull();
  });

  it.each([
    [
      "a question",
      situation("question", "waiting", "", { kind: "step_review", stage: "", step: 4 }),
    ],
    ["a session error", situation("session_error", "error", "", STEP_PLACE)],
    ["findings", situation("findings", "waiting", "")],
  ])("leaves %s to the conversation", (_, found) => {
    const task = makeTask({
      stage: "implementation",
      currentStep: 4,
      steps: [makeStep({ number: 4, status: "agent_review" })],
      situations: [found],
    });

    expect(taskRequestOf(task, "implementer", NOW)).toBeNull();
  });

  it("draws the One-Shot step_empty with the discard of the implementation", () => {
    const task = makeTask({
      mode: "one_shot",
      stage: "implementation",
      currentStep: 1,
      steps: [makeStep({ number: 1, status: "nothing_to_commit" })],
      situations: [situation("step_empty", "waiting", "", { kind: "step", stage: "", step: 1 })],
    });

    expect(taskRequestOf(task, "implementer", NOW)?.actions).toEqual([
      {
        action: "discardStep",
        label: "Discard the implementation…",
        variant: "secondary",
        loadingLabel: "",
      },
    ]);
  });

  it("asks to wait for the agent before the draft is approved", () => {
    const task = makeTask({
      stage: "pr",
      pr: makePullRequest({
        status: "draft_ready",
        sessionStage: "pr",
        turnRunning: true,
        draft: DRAFT,
      }),
      situations: [situation("draft", "waiting", "")],
    });

    expect(taskRequestOf(task, "implementer", NOW)?.actions[0]?.disabledReason).toBe(
      "Wait for the agent to finish",
    );
  });

  it("disables approving the draft once the edited title is blank, even with a full draft on disk", () => {
    const task = makeTask({
      stage: "pr",
      pr: makePullRequest({ status: "draft_ready", sessionStage: "pr", draft: DRAFT }),
      situations: [situation("draft", "waiting", "")],
    });

    expect(
      taskRequestOf(task, "implementer", NOW, null, { title: " ", body: "still here" })?.actions[0]
        ?.disabledReason,
    ).toBe("Write a title and a description");
  });

  it("enables approving the draft once the user fills what the agent left blank", () => {
    const task = makeTask({
      stage: "pr",
      pr: makePullRequest({ status: "draft_ready", sessionStage: "pr", draft: null }),
      situations: [situation("draft", "waiting", "")],
    });

    expect(
      taskRequestOf(task, "implementer", NOW, null, {
        title: "Add the login form",
        body: "Closes #12",
      })?.actions[0]?.disabledReason,
    ).toBeUndefined();
  });
});

const STEP_4 = { kind: "step", stage: "", step: 4 };
const REVIEWER_4 = { kind: "step_review", stage: "", step: 4 };
const stagePlace = (stage: string) => ({ kind: "stage", stage, step: 0 });

const reviewer = (overrides: Partial<StepReviewer> = {}) =>
  makeStepReviewer({ sessionStage: "step_review:4", ...overrides });

// stepTask is a task in step 4, under a pass of the agent review: it has both tabs.
function stepTask(
  task: Partial<TaskSummary> = {},
  step: Partial<Step> = {},
  situations: Situation[] = [],
): TaskSummary {
  return makeTask({
    stage: "implementation",
    currentStep: 4,
    steps: [makeStep({ number: 4, status: "agent_review", reviewer: reviewer(), ...step })],
    situations,
    ...task,
  });
}

function prTask(pr: Partial<PullRequest> = {}): TaskSummary {
  return makeTask({ stage: "pr", pr: makePullRequest({ prNumber: 1284, ...pr }) });
}

const SHOW = { action: "show", label: "Show", variant: "secondary", loadingLabel: "" } as const;

const retry = (label: string, stage: string) => ({
  action: "retrySession" as const,
  label,
  variant: "primary" as const,
  loadingLabel: "Retrying…",
  stage,
});

const TRY_AGAIN_STEP = {
  action: "retryStep",
  label: "Try again",
  variant: "primary",
  loadingLabel: "Checking…",
} as const;

// The nine situations of task 4 come each from the function of its kinds, without the wait, which
// taskRequestOf adds.
describe("sessionRequestOf", () => {
  it.each<
    [
      string,
      Situation,
      TaskSummary,
      PendingRequest | null,
      boolean,
      PrDraft | null,
      TaskRequestModel,
    ]
  >([
    [
      "a question of the reviewer",
      situation("question", "waiting", "", REVIEWER_4),
      stepTask(),
      { kind: "question", questions: 1 },
      false,
      null,
      {
        form: "quiet",
        glyph: "wait",
        label: "Question",
        place: "Reviewer",
        status: "Question · Reviewer",
        actions: [SHOW],
        situationId: "s-question",
        focus: "question",
      },
    ],
    [
      "two questions of the PRD agent",
      situation("question", "waiting", "", stagePlace("prd")),
      makeTask({ stage: "prd" }),
      { kind: "question", questions: 2 },
      false,
      null,
      {
        form: "quiet",
        glyph: "wait",
        label: "Question",
        place: "PRD",
        progress: "2 questions",
        status: "Question · PRD",
        actions: [SHOW],
        situationId: "s-question",
        focus: "question",
      },
    ],
    [
      "a question before the transcript is read",
      situation("question", "waiting", "", STEP_4),
      stepTask(),
      null,
      false,
      null,
      {
        form: "quiet",
        glyph: "wait",
        label: "Question",
        place: "Implementer",
        status: "Question · Implementer",
        actions: [SHOW],
        situationId: "s-question",
        focus: "question",
      },
    ],
    [
      "a permission that defaults to no",
      situation("permission", "waiting", "", STEP_4),
      stepTask(),
      { kind: "permission", defaultToNo: true },
      false,
      null,
      {
        form: "quiet",
        glyph: "wait",
        label: "Permission",
        place: "Implementer",
        status: "Permission · Implementer",
        actions: [SHOW],
        situationId: "s-permission",
        focus: "permission",
      },
    ],
    [
      "a permission of the PR agent",
      situation("permission", "waiting", "", PR_PLACE),
      prTask({ sessionStage: "pr" }),
      { kind: "permission", defaultToNo: false },
      false,
      null,
      {
        form: "quiet",
        glyph: "wait",
        label: "Permission",
        place: "PR",
        status: "Permission · PR",
        actions: [SHOW],
        situationId: "s-permission",
        focus: "permission",
      },
    ],
    [
      "a reply in the tech spec",
      situation("reply", "waiting", "", stagePlace("tech_spec")),
      makeTask({ stage: "tech_spec" }),
      null,
      false,
      null,
      {
        form: "tinted",
        glyph: "wait",
        label: "Waiting for reply",
        place: "Tech spec",
        status: "Waiting for reply · Tech spec",
        actions: [],
        situationId: "s-reply",
        focus: "composer",
      },
    ],
    [
      "a reply in One-Shot planning",
      situation("reply", "waiting", "", stagePlace("one_shot")),
      makeTask({ mode: "one_shot", stage: "one_shot" }),
      null,
      false,
      null,
      {
        form: "tinted",
        glyph: "wait",
        label: "Waiting for reply",
        place: "Planning",
        status: "Waiting for reply · Planning",
        actions: [],
        situationId: "s-reply",
        focus: "composer",
      },
    ],
    [
      "a reply in the PR review",
      situation("reply", "waiting", "", PR_PLACE),
      prTask({ status: "awaiting_reply", sessionStage: "pr_review" }),
      null,
      false,
      null,
      {
        form: "tinted",
        glyph: "wait",
        label: "Waiting for reply",
        place: "PR review",
        status: "Waiting for reply · PR review",
        actions: [],
        situationId: "s-reply",
        focus: "composer",
      },
    ],
    [
      "a reply with the draft at hand",
      situation("reply", "waiting", "", PR_PLACE),
      prTask({ status: "awaiting_reply", prNumber: 0, sessionStage: "pr", draft: DRAFT }),
      null,
      true,
      null,
      {
        form: "tinted",
        glyph: "wait",
        label: "Waiting for reply",
        place: "PR",
        status: "Waiting for reply · PR",
        actions: [
          {
            action: "approveDraft",
            label: "Approve draft",
            variant: "primary",
            loadingLabel: "Approving…",
          },
        ],
        situationId: "s-reply",
        focus: "primary",
      },
    ],
    [
      "a reply with the draft at hand, its title emptied",
      situation("reply", "waiting", "", PR_PLACE),
      prTask({ status: "awaiting_reply", prNumber: 0, sessionStage: "pr", draft: DRAFT }),
      null,
      true,
      { title: " ", body: "Adds a limiter." },
      {
        form: "tinted",
        glyph: "wait",
        label: "Waiting for reply",
        place: "PR",
        status: "Waiting for reply · PR",
        actions: [
          {
            action: "approveDraft",
            label: "Approve draft",
            variant: "primary",
            loadingLabel: "Approving…",
            disabledReason: "Write a title and a description",
          },
        ],
        situationId: "s-reply",
        focus: "primary",
      },
    ],
    [
      "a session of the implementer that stopped",
      situation("session_error", "error", "", STEP_4),
      stepTask({ lastError: "claude exited with status 1" }),
      null,
      false,
      null,
      {
        form: "error",
        glyph: "error",
        label: "Session error",
        place: "Implementer",
        status: "Session error · Implementer",
        actions: [retry("Retry implementer", "step:4")],
        situationId: "s-session_error",
        focus: "primary",
      },
    ],
    [
      "a session of the reviewer that stopped",
      situation("session_error", "error", "", REVIEWER_4),
      stepTask({}, { reviewer: reviewer({ lastError: "claude not found" }) }),
      null,
      false,
      null,
      {
        form: "error",
        glyph: "error",
        label: "Session error",
        place: "Reviewer",
        status: "Session error · Reviewer",
        actions: [retry("Retry reviewer", "step_review:4")],
        situationId: "s-session_error",
        focus: "primary",
      },
    ],
    [
      "a turn of the reviewer that failed",
      situation("session_error", "error", "", REVIEWER_4),
      stepTask(
        { lastError: "the implementer's error" },
        { reviewer: reviewer({ turnFailed: true }) },
      ),
      null,
      false,
      null,
      {
        form: "error",
        glyph: "error",
        label: "Session error",
        place: "Reviewer",
        status: "Session error · Reviewer",
        actions: [],
        situationId: "s-session_error",
        focus: "composer",
      },
    ],
    [
      "a session of the PRD agent that stopped",
      situation("session_error", "error", "", stagePlace("prd")),
      makeTask({ stage: "prd", lastError: "not logged in" }),
      null,
      false,
      null,
      {
        form: "error",
        glyph: "error",
        label: "Session error",
        place: "PRD",
        status: "Session error · PRD",
        actions: [retry("Retry PRD agent", "prd")],
        situationId: "s-session_error",
        focus: "primary",
      },
    ],
    [
      "a session of the PR review that stopped",
      situation("session_error", "error", "", PR_PLACE),
      prTask({ sessionStage: "pr_review", lastError: "claude exited" }),
      null,
      false,
      null,
      {
        form: "error",
        glyph: "error",
        label: "Session error",
        place: "PR review",
        status: "Session error · PR review",
        actions: [retry("Retry PR agent", "pr_review")],
        situationId: "s-session_error",
        focus: "primary",
      },
    ],
    [
      "a session error of an old state, without its error or a failed turn",
      situation("session_error", "error", "", stagePlace("plan")),
      makeTask({ stage: "plan" }),
      null,
      false,
      null,
      {
        form: "error",
        glyph: "error",
        label: "Session error",
        place: "Plan",
        status: "Session error · Plan",
        actions: [],
        situationId: "s-session_error",
        focus: "composer",
      },
    ],
  ])("draws %s", (_name, found, task, pending, draftAtHand, edited, bar) => {
    expect(sessionRequestOf(found, task, pending, draftAtHand, edited)).toEqual(bar);
  });
});

describe("blockRequestOf", () => {
  const STEP_5 = { kind: "step", stage: "", step: 5 };
  const blocked = (reason: string, task: Partial<TaskSummary> = {}) =>
    stepTask(
      { currentStep: 5, ...task },
      { number: 5, status: "blocked", reviewer: null, block: { reason, detail: "", files: 0 } },
    );

  it.each<[string, string, TaskRequestModel["actions"]]>([
    [
      "dirty_worktree",
      "worktree not clean",
      [
        {
          action: "cleanAndStart",
          label: "Clean and start…",
          variant: "secondary",
          loadingLabel: "",
        },
        TRY_AGAIN_STEP,
      ],
    ],
    ["fetch_failed", "fetch failed", [TRY_AGAIN_STEP]],
    ["no_base_branch", "no base branch", [TRY_AGAIN_STEP]],
    ["path_exists", "path exists", [TRY_AGAIN_STEP]],
    ["branch_exists", "branch exists", [TRY_AGAIN_STEP]],
    ["git_failed", "git failed", [TRY_AGAIN_STEP]],
    [
      "clone_missing",
      "clone missing",
      [
        { action: "changePath", label: "Change path…", variant: "secondary", loadingLabel: "" },
        TRY_AGAIN_STEP,
      ],
    ],
  ])("draws a step blocked by %s", (reason, place, actions) => {
    expect(blockRequestOf(situation("step_blocked", "error", "", STEP_5), blocked(reason))).toEqual(
      {
        form: "error",
        glyph: "error",
        label: "Step 5 blocked",
        place,
        status: `Step 5 blocked · ${place}`,
        actions,
        situationId: "s-step_blocked",
        focus: "primary",
      },
    );
  });

  it("names the block of One-Shot after the implementation", () => {
    const task = blocked("fetch_failed", { mode: "one_shot" });

    expect(blockRequestOf(situation("step_blocked", "error", "", STEP_5), task)).toMatchObject({
      label: "Implementation blocked",
      status: "Implementation blocked · fetch failed",
    });
  });

  it("reads a block without its reason as git failing", () => {
    const task = stepTask({ currentStep: 5 }, { number: 5, status: "blocked", reviewer: null });

    expect(blockRequestOf(situation("step_blocked", "error", "", STEP_5), task)).toMatchObject({
      place: "git failed",
      actions: [TRY_AGAIN_STEP],
    });
  });

  it("draws the worktree that can't be read without an action, the focus on the bar", () => {
    expect(
      blockRequestOf(
        situation("worktree_unreadable", "error", "", STEP_4),
        stepTask({}, { status: "review_failed" }),
      ),
    ).toEqual({
      form: "error",
      glyph: "error",
      label: "Can't read worktree",
      status: "Can't read worktree",
      actions: [],
      situationId: "s-worktree_unreadable",
      focus: "bar",
    });
  });

  it.each([
    ["gh_missing", "gh not installed"],
    ["gh_unauthenticated", "gh not signed in"],
    ["gh_failed", "gh failed"],
    ["git_failed", "git failed"],
    ["no_worktree", "no worktree"],
  ])("draws a pull request blocked by %s", (reason, place) => {
    const task = prTask({ status: "blocked", block: { reason, detail: "" } });

    expect(blockRequestOf(situation("pr_blocked", "error", ""), task)).toEqual({
      form: "error",
      glyph: "error",
      label: "PR blocked",
      place,
      status: `PR blocked · ${place}`,
      actions: [
        { action: "retryPR", label: "Try again", variant: "primary", loadingLabel: "Trying…" },
      ],
      situationId: "s-pr_blocked",
      focus: "primary",
    });
  });
});

describe("planRequestOf", () => {
  const SHOW_PROBLEMS = {
    action: "showProblems",
    label: "Show problems",
    variant: "secondary",
    loadingLabel: "",
  } as const;
  const problem = (file: string) => ({ file, message: "no title" });

  it.each([
    [
      "three problems",
      [problem("steps/01.md"), problem("steps/02.md"), problem("steps/03.md")],
      "3 problems",
    ],
    ["one problem", [problem("steps/01.md")], "1 problem"],
    ["no problems read", null, undefined],
  ])("draws a plan still invalid with %s", (_name, planProblems, progress) => {
    const task = makeTask({ stage: "plan", planProblems });

    expect(planRequestOf(situation("plan_invalid", "error", "", stagePlace("plan")), task)).toEqual(
      {
        form: "tinted",
        glyph: "error",
        label: "Plan still invalid",
        ...(progress === undefined ? {} : { progress }),
        status: "Plan still invalid",
        actions: [SHOW_PROBLEMS],
        situationId: "s-plan_invalid",
        focus: "composer",
      },
    );
  });
});

describe("findingsRequestOf", () => {
  it("draws the findings to decide in the PR review, answered through the composer", () => {
    const task = prTask({ status: "awaiting_decision", sessionStage: "pr_review" });

    expect(findingsRequestOf(situation("findings", "waiting", ""), task)).toEqual({
      form: "tinted",
      glyph: "wait",
      label: "Decide findings",
      place: "PR review",
      status: "Decide findings · PR review",
      actions: [],
      situationId: "s-findings",
      focus: "composer",
    });
  });
});

describe("retryLabelOf", () => {
  it.each([
    ["prd", "Retry PRD agent"],
    ["tech_spec", "Retry tech spec agent"],
    ["plan", "Retry plan agent"],
    ["one_shot", "Retry planning agent"],
    ["step:4", "Retry implementer"],
    ["step_review:4", "Retry reviewer"],
    ["pr", "Retry PR agent"],
    ["pr_review", "Retry PR agent"],
    ["", "Retry"],
  ])("names the retry of %s", (stage, label) => {
    expect(retryLabelOf(stage)).toBe(label);
  });
});

describe("otherConversationOf", () => {
  const onStep = (kind: string, group = "waiting") => ({
    ...situation(kind, group, "", STEP_4),
    id: `step-${kind}`,
  });
  const onReviewer = (kind: string, group = "waiting") => ({
    ...situation(kind, group, "", REVIEWER_4),
    id: `reviewer-${kind}`,
  });
  const TIME = { short: "9m", long: "9 minutes" };

  it.each<[string, StepTab, Situation, OtherConversationModel]>([
    [
      "the reviewer's question",
      "implementer",
      onReviewer("question"),
      {
        failed: false,
        label: "The reviewer waits · Question",
        goLabel: "Go to reviewer",
        goTab: "reviewer",
        status: "The reviewer waits · Question",
        situationId: "reviewer-question",
        time: TIME,
      },
    ],
    [
      "the reviewer's permission",
      "implementer",
      onReviewer("permission"),
      {
        failed: false,
        label: "The reviewer waits · Permission",
        goLabel: "Go to reviewer",
        goTab: "reviewer",
        status: "The reviewer waits · Permission",
        situationId: "reviewer-permission",
        time: TIME,
      },
    ],
    [
      "the reviewer waiting for a reply",
      "implementer",
      onReviewer("reply"),
      {
        failed: false,
        label: "The reviewer waits · Reply",
        goLabel: "Go to reviewer",
        goTab: "reviewer",
        status: "The reviewer waits · Reply",
        situationId: "reviewer-reply",
        time: TIME,
      },
    ],
    [
      "the reviewer's session error",
      "implementer",
      onReviewer("session_error", "error"),
      {
        failed: true,
        label: "Session error · Reviewer",
        goLabel: "Go to reviewer",
        goTab: "reviewer",
        status: "Session error · Reviewer",
        situationId: "reviewer-session_error",
        time: TIME,
      },
    ],
    [
      "the implementer's question",
      "reviewer",
      onStep("question"),
      {
        failed: false,
        label: "The implementer waits · Question",
        goLabel: "Go to implementer",
        goTab: "implementer",
        status: "The implementer waits · Question",
        situationId: "step-question",
        time: TIME,
      },
    ],
    [
      "the implementer's session error",
      "reviewer",
      onStep("session_error", "error"),
      {
        failed: true,
        label: "Session error · Implementer",
        goLabel: "Go to implementer",
        goTab: "implementer",
        status: "Session error · Implementer",
        situationId: "step-session_error",
        time: TIME,
      },
    ],
  ])("points to %s", (_name, tab, found, bar) => {
    expect(otherConversationOf(stepTask({}, {}, [found]), tab, NOW)).toEqual(bar);
  });

  it.each<[string, StepTab, TaskSummary]>([
    [
      "both conversations ask",
      "implementer",
      stepTask({}, {}, [onStep("permission"), onReviewer("question")]),
    ],
    ["the conversation on screen asks", "reviewer", stepTask({}, {}, [onReviewer("question")])],
    ["nothing asks", "implementer", stepTask()],
    [
      "the step asks for its review, on both tabs",
      "reviewer",
      stepTask({}, { status: "in_review" }, [onStep("step_review")]),
    ],
    [
      "the step asks for something no conversation asks",
      "reviewer",
      stepTask({}, { status: "review_failed" }, [onStep("worktree_unreadable", "error")]),
    ],
    [
      "the step has one tab",
      "implementer",
      stepTask({}, { status: "implementing", reviewer: null }, [onReviewer("question")]),
    ],
    [
      "the step has no conversation yet",
      "implementer",
      stepTask({}, { status: "preparing" }, [onReviewer("question")]),
    ],
    [
      "the task is in its pull request",
      "implementer",
      stepTask({ stage: "pr" }, {}, [onReviewer("question")]),
    ],
  ])("draws nothing when %s", (_name, tab, task) => {
    expect(otherConversationOf(task, tab, NOW)).toBeNull();
  });
});
