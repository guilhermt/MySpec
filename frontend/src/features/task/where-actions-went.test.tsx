import { screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TaskView } from "@/features/task/TaskView";
import type { Entry, PullRequest, Situation, Step, TaskSummary } from "@/lib/wails";
import type { TranscriptState } from "@/store/transcript";
import { renderWithStore } from "@/test/render";
import {
  makeEntry,
  makePullRequest,
  makeRepository,
  makeReview,
  makeSituation,
  makeState,
  makeStep,
  makeTask,
} from "@/test/wails-mock";

const WORKTREE = "/w/api/add-login";

// inStep is the task implementing its first step, waiting on its own conversation.
function inStep(step: Partial<Step>, overrides: Partial<TaskSummary> = {}): TaskSummary {
  return makeTask({
    stage: "implementation",
    currentStep: 1,
    worktreePath: WORKTREE,
    steps: [makeStep({ worktreePath: WORKTREE, ...step })],
    ...overrides,
  });
}

function stepSituation(kind: string, form = ""): Situation {
  return makeSituation({ kind, form, place: { kind: "step", stage: "", step: 1 } });
}

// inPR is the task in the PR stage, its pull request in the state given, with the situation it waits on.
function inPR(pr: Partial<PullRequest>, kind = "", form = ""): TaskSummary {
  return makeTask({
    stage: "pr",
    worktreePath: WORKTREE,
    pr: makePullRequest({ worktreePath: WORKTREE, ...pr }),
    situations:
      kind === "" ? [] : [makeSituation({ kind, form, place: { kind: "pr", stage: "", step: 0 } })],
  });
}

const DRAFT = { title: "Add login", body: "The login page.", file: "draft.md" };
const OPENED = { prNumber: 12, prUrl: "https://github.com/o/r/pull/12" };
const PR_SESSION = { sessionStage: "pr_review", sessionStatus: "working" };

const REVIEWING = makeReview({ staged: 2, total: 2, percent: 100 });

/** Row is a control that left its place, in a state it appeared in, and where it is now. */
interface Row {
  origin:
    | "StepBar"
    | "PRBar"
    | "StageTrack"
    | "ErrorCard"
    | "StepBlocked"
    | "PRBlocked"
    | "DraftCard"
    | "PRPane notes"
    | "QuestionCard"
    | "PermissionCard";
  button: string;
  state: string;
  task: TaskSummary;
  where: "menu" | "bar" | "header" | "pane" | "card" | "composer" | "entry" | "tooltip";
  /** name is the accessible name in the new place; in a tooltip, its text. */
  name: RegExp;
  /** trigger is the text in the bar that holds the tooltip. */
  trigger?: RegExp;
  disabled?: boolean;
  /** role is the role of the control in the card, a button when not given. */
  role?: "radio";
  /** transcripts are the conversations the screen reads, with the pending card of a row. */
  transcripts?: Record<string, TranscriptState>;
}

// withCard is the conversation of step 1 holding a card pending.
function withCard(entry: Entry): Record<string, TranscriptState> {
  return {
    "task-1|step:1": { status: "ready", error: "", entries: [entry], pending: [], buffered: [] },
  };
}

const ASKING = withCard(makeEntry("question"));

function permissionEntry(suggestions: string): Entry {
  const entry = makeEntry("permission");
  return entry.permission === null
    ? entry
    : { ...entry, permission: { ...entry.permission, suggestions } };
}

const ROWS: Row[] = [
  {
    origin: "StepBar",
    button: "Open in VS Code",
    state: "implementing",
    task: inStep({ status: "implementing" }),
    where: "menu",
    name: /^Open in VS Code/,
  },
  {
    origin: "StepBar",
    button: "Open in VS Code",
    state: "before the worktree exists",
    task: inStep({ status: "preparing", worktreePath: "" }, { worktreePath: "" }),
    where: "menu",
    name: /^Open in VS Code · the worktree doesn't exist yet/,
    disabled: true,
  },
  {
    origin: "StepBar",
    button: "Open in VS Code",
    state: "awaiting review",
    task: inStep(
      { status: "awaiting_review", review: makeReview() },
      { situations: [stepSituation("step_review", "review")] },
    ),
    where: "bar",
    name: /^Open in VS Code$/,
  },
  {
    origin: "StepBar",
    button: "Approve",
    state: "awaiting review, files left to stage",
    task: inStep(
      { status: "awaiting_review", review: makeReview() },
      { situations: [stepSituation("step_review", "review")] },
    ),
    where: "bar",
    name: /^Approve$/,
    disabled: true,
  },
  {
    origin: "StepBar",
    button: "Approve",
    state: "ready to approve",
    task: inStep(
      { status: "ready_to_approve", review: REVIEWING },
      { situations: [stepSituation("step_review", "approve")] },
    ),
    where: "bar",
    name: /^Approve$/,
  },
  {
    origin: "StepBar",
    button: "Approve",
    state: "the worktree unreadable",
    task: inStep(
      { status: "review_failed", review: makeReview({ error: "git status failed" }) },
      { situations: [stepSituation("step_review", "review")] },
    ),
    where: "bar",
    name: /^Approve$/,
    disabled: true,
  },
  {
    origin: "StepBar",
    button: "Approve",
    state: "ready to approve, the task paused",
    task: inStep({ status: "ready_to_approve", review: REVIEWING }, { sessionStatus: "paused" }),
    where: "bar",
    name: /^Approve$/,
  },
  {
    origin: "StepBar",
    button: "Approve",
    state: "nothing to commit",
    task: inStep({ status: "nothing_to_commit" }, { situations: [stepSituation("step_empty")] }),
    where: "bar",
    name: /^Discard step 1…$/,
  },
  {
    origin: "StepBar",
    button: "Review myself",
    state: "agent review",
    task: inStep({ status: "agent_review", reviewMode: "agent" }),
    where: "menu",
    name: /^Review myself$/,
  },
  {
    origin: "StepBar",
    button: "Discard step",
    state: "implementing",
    task: inStep({ status: "implementing" }),
    where: "menu",
    name: /^Discard step 1…$/,
  },
  {
    origin: "PRBar",
    button: "Open PR",
    state: "a draft to approve",
    task: inPR({ status: "draft_ready", draft: DRAFT }, "draft"),
    where: "bar",
    name: /^Approve draft$/,
  },
  {
    origin: "PRBar",
    button: "Open PR",
    state: "a draft still being written",
    task: inPR({ status: "draft_ready", draft: DRAFT, turnRunning: true }, "draft"),
    where: "bar",
    name: /^Approve draft$/,
    disabled: true,
  },
  {
    origin: "DraftCard",
    button: "Open PR",
    state: "the draft a failed opening left",
    task: inPR({ status: "awaiting_reply", draft: DRAFT, sessionStage: "pr" }, "reply"),
    where: "bar",
    name: /^Approve draft$/,
  },
  {
    origin: "DraftCard",
    button: "Open PR",
    state: "the draft a failed opening left, the agent still working",
    task: inPR(
      { status: "awaiting_reply", draft: DRAFT, sessionStage: "pr", turnRunning: true },
      "reply",
    ),
    where: "bar",
    name: /^Approve draft$/,
    disabled: true,
  },
  {
    origin: "ErrorCard",
    button: "Retry",
    state: "the session of the step stopped",
    task: inStep(
      { status: "implementing" },
      {
        sessionStatus: "error",
        lastError: "claude exited",
        situations: [stepSituation("session_error")],
      },
    ),
    where: "bar",
    name: /^Retry implementer$/,
  },
  {
    origin: "ErrorCard",
    button: "Retry",
    state: "the session of the PRD stopped",
    task: makeTask({
      stage: "prd",
      sessionStatus: "error",
      lastError: "not logged in",
      situations: [
        makeSituation({ kind: "session_error", place: { kind: "stage", stage: "prd", step: 0 } }),
      ],
    }),
    where: "bar",
    name: /^Retry PRD agent$/,
  },
  {
    origin: "StepBlocked",
    button: "Try again",
    state: "the step blocked",
    task: inStep(
      { status: "blocked", block: { reason: "fetch_failed", detail: "", files: 0 } },
      { situations: [stepSituation("step_blocked")] },
    ),
    where: "bar",
    name: /^Try again$/,
  },
  {
    origin: "StepBlocked",
    button: "Clean and start",
    state: "the worktree not clean",
    task: inStep(
      { status: "blocked", block: { reason: "dirty_worktree", detail: " M a.ts", files: 1 } },
      { situations: [stepSituation("step_blocked")] },
    ),
    where: "bar",
    name: /^Clean and start…$/,
  },
  {
    origin: "PRBlocked",
    button: "Try again",
    state: "the pull request blocked",
    task: inPR({ status: "blocked", block: { reason: "gh_failed", detail: "" } }, "pr_blocked"),
    where: "bar",
    name: /^Try again$/,
  },
  {
    origin: "PRPane notes",
    button: "The merge couldn't be confirmed",
    state: "waiting for the merge",
    task: inPR(
      { ...OPENED, status: "done", canClose: true, checkError: "gh: not authenticated" },
      "merge",
      "close",
    ),
    where: "tooltip",
    trigger: /^Couldn't confirm the merge/,
    name: /^gh: not authenticated$/,
  },
  {
    origin: "PRPane notes",
    button: "The merge couldn't be confirmed",
    state: "in trouble",
    task: inPR(
      {
        ...OPENED,
        status: "trouble",
        canClose: true,
        checkError: "gh: not authenticated",
        trouble: { failedChecks: ["build"], conflict: false },
      },
      "pr_trouble",
      "checks",
    ),
    where: "tooltip",
    trigger: /Couldn't confirm the merge$/,
    name: /^gh: not authenticated$/,
  },
  {
    origin: "PRPane notes",
    button: "Review again reads GitHub",
    state: "in trouble",
    task: inPR(
      { ...OPENED, status: "trouble", trouble: { failedChecks: ["build"], conflict: false } },
      "pr_trouble",
      "checks",
    ),
    where: "tooltip",
    trigger: /^Review again$/,
    name: /^Review again reads GitHub and turns this into findings of a new pass\.$/,
  },
  {
    origin: "PRBar",
    button: "Discard draft",
    state: "a draft to approve",
    task: inPR({ status: "draft_ready", draft: DRAFT }, "draft"),
    where: "bar",
    name: /^Discard draft$/,
  },
  {
    origin: "PRBar",
    button: "Discard draft",
    state: "a draft being written",
    task: inPR({ status: "draft_ready", draft: DRAFT, turnRunning: true }, "draft"),
    where: "menu",
    name: /^Discard draft$/,
  },
  {
    origin: "PRBar",
    button: "Approve",
    state: "changes to review, files left to stage",
    task: inPR(
      { ...OPENED, status: "in_review", review: makeReview(), sessionStage: "pr_review" },
      "changes_review",
      "review",
    ),
    where: "bar",
    name: /^Approve$/,
    disabled: true,
  },
  {
    origin: "PRBar",
    button: "Approve",
    state: "changes ready to approve",
    task: inPR(
      { ...OPENED, status: "ready_to_approve", review: REVIEWING, sessionStage: "pr_review" },
      "changes_review",
      "approve",
    ),
    where: "bar",
    name: /^Approve$/,
  },
  {
    origin: "PRBar",
    button: "Open in VS Code",
    state: "changes to review",
    task: inPR(
      { ...OPENED, status: "in_review", review: makeReview(), sessionStage: "pr_review" },
      "changes_review",
      "review",
    ),
    where: "bar",
    name: /^Open in VS Code$/,
  },
  {
    origin: "PRBar",
    button: "Open in VS Code",
    state: "a draft being written",
    task: inPR({ status: "drafting", ...PR_SESSION, sessionStage: "pr" }),
    where: "menu",
    name: /^Open in VS Code/,
  },
  {
    origin: "PRBar",
    button: "Open in VS Code",
    state: "an open pull request",
    task: inPR({ ...OPENED, status: "awaiting_decision", sessionStage: "pr_review" }),
    where: "menu",
    name: /^Open in VS Code/,
  },
  {
    origin: "PRBar",
    button: "#N",
    state: "an open pull request",
    task: inPR({ ...OPENED, status: "awaiting_decision", sessionStage: "pr_review" }),
    where: "menu",
    name: /^Open PR$/,
  },
  {
    origin: "PRBar",
    button: "#N",
    state: "waiting for the merge",
    task: inPR({ ...OPENED, status: "done" }, "merge", "merge"),
    where: "bar",
    name: /^Open PR$/,
  },
  {
    origin: "PRBar",
    button: "Close task",
    state: "merged",
    task: inPR({ ...OPENED, status: "merged", canClose: true }, "merge", "close"),
    where: "bar",
    name: /^Close task$/,
  },
  {
    origin: "PRBar",
    button: "Close task",
    state: "merged, the clone missing",
    task: inPR(
      { ...OPENED, status: "merged", canClose: false, cloneMissing: true },
      "merge",
      "close",
    ),
    where: "bar",
    name: /^Close task$/,
    disabled: true,
  },
  {
    origin: "PRBar",
    button: "Close task",
    state: "the merge unconfirmed",
    task: inPR(
      { ...OPENED, status: "done", canClose: true, checkError: "timeout" },
      "merge",
      "close",
    ),
    where: "bar",
    name: /^Close task$/,
  },
  {
    origin: "PRBar",
    button: "Close task",
    state: "in trouble, the merge unconfirmed",
    task: inPR(
      {
        ...OPENED,
        status: "trouble",
        canClose: true,
        checkError: "timeout",
        trouble: { failedChecks: ["build"], conflict: false },
      },
      "pr_trouble",
      "checks",
    ),
    where: "bar",
    name: /^Close task$/,
  },
  {
    origin: "PRBar",
    button: "Review again",
    state: "in trouble",
    task: inPR(
      { ...OPENED, status: "trouble", trouble: { failedChecks: ["build"], conflict: false } },
      "pr_trouble",
      "checks",
    ),
    where: "bar",
    name: /^Review again$/,
  },
  {
    origin: "PRBar",
    button: "Review again",
    state: "waiting for the merge",
    task: inPR({ ...OPENED, status: "done" }, "merge", "merge"),
    where: "menu",
    name: /^Review again$/,
  },
  {
    origin: "PRBar",
    button: "Refresh PR",
    state: "an open pull request",
    task: inPR({ ...OPENED, status: "done" }, "merge", "merge"),
    where: "menu",
    name: /^Refresh PR$/,
  },
  {
    origin: "PRBar",
    button: "Refresh PR",
    state: "closing",
    task: inPR({ ...OPENED, status: "closing" }),
    where: "menu",
    name: /^Refresh PR · the task is closing$/,
    disabled: true,
  },
  {
    origin: "PRBar",
    button: "Pause",
    state: "the PR session working",
    task: inPR({ status: "drafting", ...PR_SESSION, sessionStage: "pr" }),
    where: "header",
    name: /^Pause$/,
  },
  {
    origin: "PRBar",
    button: "Resume",
    state: "the PR session paused",
    task: inPR({ status: "drafting", sessionStage: "pr", sessionStatus: "paused" }),
    where: "header",
    name: /^Resume$/,
  },
  {
    origin: "StageTrack",
    button: "Discard and restart",
    state: "in the PRD",
    task: makeTask({ stage: "prd" }),
    where: "menu",
    name: /^Discard and restart the PRD…$/,
  },
  {
    origin: "StageTrack",
    button: "Back to PRD",
    state: "in the tech spec",
    task: makeTask({ stage: "tech_spec" }),
    where: "menu",
    name: /^Back to PRD…$/,
  },
  {
    origin: "StageTrack",
    button: "Discard and restart",
    state: "the PRD, in the tech spec",
    task: makeTask({ stage: "tech_spec" }),
    where: "menu",
    name: /^Discard and restart the PRD…$/,
  },
  {
    origin: "StageTrack",
    button: "Back to tech spec",
    state: "in the plan",
    task: makeTask({ stage: "plan" }),
    where: "menu",
    name: /^Back to Tech spec…$/,
  },
  {
    origin: "StageTrack",
    button: "Discard and restart",
    state: "the plan, in the implementation",
    task: inStep({ status: "implementing" }),
    where: "menu",
    name: /^Discard and restart the plan…$/,
  },
  {
    origin: "StageTrack",
    button: "Discard and restart",
    state: "in the One-Shot planning",
    task: makeTask({ mode: "one_shot", stage: "one_shot" }),
    where: "menu",
    name: /^Discard and restart planning…$/,
  },
  {
    origin: "StageTrack",
    button: "Back to planning",
    state: "a One-Shot in the implementation",
    task: inStep({ status: "implementing" }, { mode: "one_shot" }),
    where: "menu",
    name: /^Back to planning…$/,
  },
  {
    origin: "StageTrack",
    button: "Back to planning",
    state: "a One-Shot in the PR",
    task: makeTask({ mode: "one_shot", stage: "pr" }),
    where: "menu",
    name: /^Back to planning…$/,
  },
  {
    origin: "StageTrack",
    button: "Continue to tech spec",
    state: "the PRD revisited",
    task: makeTask({
      stage: "prd",
      revisiting: true,
      canContinue: true,
      situations: [
        makeSituation({
          kind: "ready_to_continue",
          place: { kind: "stage", stage: "prd", step: 0 },
        }),
      ],
    }),
    where: "bar",
    name: /^Continue$/,
  },
  {
    origin: "QuestionCard",
    button: "Answer",
    state: "a question pending, nothing chosen",
    task: inStep({ status: "implementing" }, { situations: [stepSituation("question")] }),
    transcripts: ASKING,
    where: "card",
    name: /^Answer/,
    disabled: true,
  },
  {
    origin: "QuestionCard",
    button: "Other…",
    state: "a question pending",
    task: inStep({ status: "implementing" }, { situations: [stepSituation("question")] }),
    transcripts: ASKING,
    where: "card",
    role: "radio",
    name: /Other…/,
  },
  {
    origin: "PermissionCard",
    button: "Allow",
    state: "a permission pending",
    task: inStep({ status: "implementing" }, { situations: [stepSituation("permission")] }),
    transcripts: withCard(permissionEntry("")),
    where: "card",
    name: /^Allow/,
  },
  {
    origin: "PermissionCard",
    button: "Allow for this session",
    state: "a permission pending with a rule to remember",
    task: inStep({ status: "implementing" }, { situations: [stepSituation("permission")] }),
    transcripts: withCard(permissionEntry('[{"type":"addRules"}]')),
    where: "card",
    name: /^Allow for this session/,
  },
  {
    origin: "PermissionCard",
    button: "Deny",
    state: "a permission pending",
    task: inStep({ status: "implementing" }, { situations: [stepSituation("permission")] }),
    transcripts: withCard(permissionEntry("")),
    where: "card",
    name: /^Deny…/,
  },
];

describe("where the actions of the bars that left went", () => {
  it.each(ROWS)(
    "$origin: $button, $state, is in the $where",
    async ({ task, where, name, trigger, disabled, role, transcripts }) => {
      const { user } = renderWithStore(<TaskView taskId={task.id} />, {
        state: makeState({
          tasks: [task],
          repositories: [makeRepository({ id: task.repositoryId })],
        }),
        ui: { location: { kind: "task", id: task.id }, ...(transcripts ? { transcripts } : {}) },
      });

      let found: HTMLElement;
      if (where === "menu") {
        await user.click(screen.getByRole("button", { name: "More actions" }));
        found = await screen.findByRole("menuitem", { name });
      } else if (where === "bar") {
        found = within(screen.getByRole("region", { name: "Request" })).getByRole("button", {
          name,
        });
      } else if (where === "tooltip") {
        const bar = screen.getByRole("region", { name: "Request" });
        await user.hover(within(bar).getByText(trigger ?? /^$/));
        found = await screen.findByRole("tooltip");
        expect(found).toHaveTextContent(name);
        return;
      } else if (where === "card") {
        const card = await waitFor(() => {
          const pending = document.querySelector<HTMLElement>("[data-pending-card]");
          expect(pending).not.toBeNull();
          return pending as HTMLElement;
        });
        found = within(card).getByRole(role ?? "button", { name });
      } else if (where === "header") {
        found = within(screen.getByRole("banner")).getByRole("button", { name });
      } else {
        found = screen.getByRole("button", { name });
      }

      if (disabled) {
        expect(found).toHaveAttribute("aria-disabled", "true");
      } else {
        expect(found).not.toHaveAttribute("aria-disabled", "true");
      }
    },
  );
});

// The seventeen situations of the bar and the paused one: the screen draws one primary at most.
const SITUATIONS: [string, TaskSummary][] = [
  [
    "step_review",
    inStep(
      { status: "ready_to_approve", review: REVIEWING },
      { situations: [stepSituation("step_review", "approve")] },
    ),
  ],
  [
    "step_empty",
    inStep({ status: "nothing_to_commit" }, { situations: [stepSituation("step_empty")] }),
  ],
  [
    "ready_to_continue",
    makeTask({
      stage: "prd",
      revisiting: true,
      canContinue: true,
      situations: [
        makeSituation({
          kind: "ready_to_continue",
          place: { kind: "stage", stage: "prd", step: 0 },
        }),
      ],
    }),
  ],
  ["draft", inPR({ status: "draft_ready", draft: DRAFT }, "draft")],
  [
    "changes_review",
    inPR(
      { ...OPENED, status: "ready_to_approve", review: REVIEWING, sessionStage: "pr_review" },
      "changes_review",
      "approve",
    ),
  ],
  ["merge", inPR({ ...OPENED, status: "merged", canClose: true }, "merge", "close")],
  [
    "pr_trouble",
    inPR(
      {
        ...OPENED,
        status: "trouble",
        canClose: true,
        trouble: { failedChecks: ["build"], conflict: false },
      },
      "pr_trouble",
      "checks",
    ),
  ],
  ["pr_closed", inPR({ ...OPENED, status: "pr_closed" }, "pr_closed")],
  ["question", inStep({ status: "implementing" }, { situations: [stepSituation("question")] })],
  ["permission", inStep({ status: "implementing" }, { situations: [stepSituation("permission")] })],
  ["reply", inPR({ status: "awaiting_reply", draft: DRAFT, sessionStage: "pr" }, "reply")],
  [
    "session_error",
    inStep(
      { status: "implementing" },
      { lastError: "claude exited", situations: [stepSituation("session_error")] },
    ),
  ],
  [
    "step_blocked",
    inStep(
      { status: "blocked", block: { reason: "dirty_worktree", detail: " M a.ts", files: 1 } },
      { situations: [stepSituation("step_blocked")] },
    ),
  ],
  [
    "worktree_unreadable",
    inStep({ status: "implementing" }, { situations: [stepSituation("worktree_unreadable")] }),
  ],
  [
    "pr_blocked",
    inPR({ status: "blocked", block: { reason: "gh_failed", detail: "" } }, "pr_blocked"),
  ],
  [
    "plan_invalid",
    makeTask({
      stage: "plan",
      planProblems: [{ file: "02.md", message: "no title" }],
      situations: [
        makeSituation({ kind: "plan_invalid", place: { kind: "stage", stage: "plan", step: 0 } }),
      ],
    }),
  ],
  [
    "findings",
    inPR({ ...OPENED, status: "awaiting_decision", sessionStage: "pr_review" }, "findings"),
  ],
  [
    "paused",
    inStep({ status: "ready_to_approve", review: REVIEWING }, { sessionStatus: "paused" }),
  ],
];

describe("the primary of the task screen", () => {
  it.each(SITUATIONS)("is one at most in %s", (_kind, task) => {
    const { container } = renderWithStore(<TaskView taskId={task.id} />, {
      state: makeState({
        tasks: [task],
        repositories: [makeRepository({ id: task.repositoryId })],
      }),
      ui: { location: { kind: "task", id: task.id } },
    });

    expect(container.querySelectorAll("button[data-variant=primary]").length).toBeLessThanOrEqual(
      1,
    );
  });
});
