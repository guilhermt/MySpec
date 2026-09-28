import { describe, expect, it } from "vitest";
import { pausedRequestOf, type TaskRequestModel, taskRequestOf } from "@/features/task/request";
import { cloneMissingText } from "@/lib/repositories";
import type { PullRequest, Situation, Step, TaskSummary } from "@/lib/wails";
import {
  makePullRequest,
  makeRepository,
  makeReview,
  makeSituation,
  makeStep,
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
        status: "Review step 4",
        actions: [OPEN_IN_EDITOR, approve("approveStep")],
        situationId: "s-step_review",
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
        status: "Review changes",
        actions: [OPEN_IN_EDITOR, approve("approvePR")],
        situationId: "s-changes_review",
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
        actions: [
          {
            action: "reviewAgain",
            label: "Review again",
            variant: "primary",
            loadingLabel: "Asking…",
          },
        ],
        situationId: "s-pr_trouble",
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
        actions: [
          {
            action: "reviewAgain",
            label: "Review again",
            variant: "primary",
            loadingLabel: "Asking…",
          },
          closeTask("secondary"),
        ],
        situationId: "s-pr_trouble",
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
