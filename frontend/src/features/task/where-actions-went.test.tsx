import { screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TaskView } from "@/features/task/TaskView";
import type { Entry, PullRequest, Situation, Step, TaskSummary } from "@/lib/wails";
import type { TranscriptState } from "@/store/transcript";
import { renderWithStore } from "@/test/render";
import { SCENE_FINDINGS } from "@/test/task-scenes";
import {
  makeEntry,
  makePRReport,
  makePullRequest,
  makeRepository,
  makeReview,
  makeReviewFinding,
  makeSituation,
  makeState,
  makeStep,
  makeTask,
  makeTextPRReport,
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
    | "PermissionCard"
    | "ReviewStrip"
    | "PausedNotice"
    | "PendingMessage"
    | "FindingsCard"
    | "FindingsBar"
    | "FindingsReply"
    | "ReportLink"
    | "ReviewMenu";
  button: string;
  state: string;
  task: TaskSummary;
  where:
    | "menu"
    | "bar"
    | "header"
    | "card"
    | "composer"
    | "placeholder"
    | "details"
    | "entry"
    | "tooltip";
  /** name is the accessible name in the new place; in a tooltip, its text; in the composer, its placeholder. */
  name: RegExp;
  /** trigger is the text in the bar that holds the tooltip. */
  trigger?: RegExp;
  disabled?: boolean;
  /** card names the fixed card that holds the control; the pending card when not given. */
  card?: RegExp;
  /** entry names the entry of the conversation that holds the control. */
  entry?: RegExp;
  /** group names the groups, one inside the other, that hold the control: the card of findings, a finding. */
  group?: RegExp[];
  /** role is the role of the control in the card, a button when not given. */
  role?: "radio" | "link";
  /** editing opens the editor of the finding the row names first, which is where Done is. */
  editing?: boolean;
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

// QUEUED is the conversation of step 1 with a message waiting for the turn to end.
const QUEUED: Record<string, TranscriptState> = {
  "task-1|step:1": {
    status: "ready",
    error: "",
    entries: [],
    pending: [
      makeEntry("user", {
        user: {
          text: "and dark mode",
          pending: true,
          prompt: false,
          app: false,
          sent: "",
          appKind: "",
          appPass: 0,
          appRound: 0,
          appRounds: 0,
          appCount: 0,
        },
      }),
    ],
    buffered: [],
  },
};

function permissionEntry(suggestions: string): Entry {
  const entry = makeEntry("permission");
  return entry.permission === null
    ? entry
    : { ...entry, permission: { ...entry.permission, suggestions } };
}

// DELETED is a review of the step with a file that was deleted.
const DELETED = makeReview({
  files: [{ path: "src/legacy.ts", kind: "deleted", staged: false, partial: false }],
  staged: 0,
  total: 1,
  percent: 0,
});

// The review of the pull request with its findings: the card of pass 1 in the conversation.
const FINDINGS_PASS = {
  ...OPENED,
  sessionStage: "pr_review",
  currentPass: 1,
};

// reviewed is the pull request waiting for the decision of the findings given, each decided as said.
function reviewed(decisions: string[], pr: Partial<PullRequest> = {}): Partial<PullRequest> {
  return {
    ...FINDINGS_PASS,
    status: "awaiting_decision",
    reports: [
      makePRReport({
        findings: SCENE_FINDINGS.slice(0, decisions.length).map((finding, index) =>
          makeReviewFinding({ ...finding, decision: decisions[index] ?? "" }),
        ),
      }),
    ],
    ...pr,
  };
}

const TO_DECIDE = reviewed(["approved", "", "", ""]);
const ALL_DECIDED = reviewed(["approved", "approved", "discarded", "approved"]);
const ALL_DISCARDED = reviewed(["discarded", "discarded", "discarded", "discarded"], {
  status: "done",
});
// REWRITING is the pull request whose report the agent rewrites: no situation, the card stays.
const REWRITING = reviewed(["approved", "", "", ""], {
  status: "reviewing",
  sessionStatus: "working",
});
// IN_TEXT is the pull request whose pass was asked before the format of the findings.
const IN_TEXT: Partial<PullRequest> = {
  ...OPENED,
  status: "awaiting_decision",
  sessionStage: "pr_review",
  currentPass: 1,
  reports: [makeTextPRReport(1, false)],
};
const FIRST_FINDING = [/^Findings of pass 1$/, /^Finding 1 of 4/];

// CARD_STATES are the states the card of findings is decided in, besides the findings to decide.
const CARD_STATES: [string, TaskSummary][] = [
  ["every finding decided", inPR(ALL_DECIDED, "findings", "apply")],
  ["every finding discarded", inPR(ALL_DISCARDED, "merge", "merge")],
  ["the report rewritten", inPR(REWRITING)],
];

// cardRows are the controls of the first finding of the card in a state.
function cardRows(state: string, task: TaskSummary): Row[] {
  const row = { origin: "FindingsCard", state, task, where: "card", group: FIRST_FINDING } as const;
  return [
    { ...row, button: "Approve", name: /^Approve/ },
    { ...row, button: "Discard", name: /^Discard/ },
    { ...row, button: "Edit", name: /^Edit/ },
    { ...row, button: "Done", name: /^Done$/, editing: true },
    { ...row, button: "bucket.go:31", role: "link", name: /bucket\.go:31/ },
    { ...row, button: "Open in VS Code", name: /^Open line 31 of bucket\.go in VS Code$/ },
  ];
}

// ASK_FOR_FINDINGS is what the composer says while a structured pass is decided.
const ASK_FOR_FINDINGS = /^Ask the PR agent to add, change or drop a finding…$/;

// REPORTED is the conversation of the review with the milestone of the report, the one that opens it.
const REPORTED: Record<string, TranscriptState> = {
  "task-1|pr_review": {
    status: "ready",
    error: "",
    entries: [
      makeEntry("marker", {
        marker: {
          ...(makeEntry("marker").marker as NonNullable<Entry["marker"]>),
          type: "pr_review_written",
          pass: 1,
          findings: 4,
        },
      }),
    ],
    pending: [],
    buffered: [],
  },
};

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
    origin: "PRPane notes",
    button: "#N",
    state: "waiting for the merge",
    task: inPR({ ...OPENED, status: "done", prState: "open" }, "merge", "merge"),
    where: "menu",
    name: /^Open PR$/,
  },
  {
    origin: "PRPane notes",
    button: "#N",
    state: "in trouble",
    task: inPR(
      { ...OPENED, status: "trouble", trouble: { failedChecks: ["build"], conflict: false } },
      "pr_trouble",
      "checks",
    ),
    where: "menu",
    name: /^Open PR$/,
  },
  {
    origin: "PRPane notes",
    button: "#N",
    state: "merged",
    task: inPR(
      { ...OPENED, status: "merged", prState: "merged", canClose: true },
      "merge",
      "close",
    ),
    where: "menu",
    name: /^Open PR$/,
  },
  {
    origin: "PRPane notes",
    button: "#N",
    state: "closed without a merge",
    task: inPR({ ...OPENED, status: "pr_closed", prState: "closed" }, "pr_closed"),
    where: "menu",
    name: /^Open PR$/,
  },
  {
    origin: "ReviewStrip",
    button: "a file",
    state: "awaiting review",
    task: inStep(
      { status: "awaiting_review", review: makeReview() },
      { situations: [stepSituation("step_review", "review")] },
    ),
    where: "card",
    card: /^Changed files/,
    name: /src\/api\/login\.ts/,
  },
  {
    origin: "ReviewStrip",
    button: "a file",
    state: "ready to approve",
    task: inStep(
      { status: "ready_to_approve", review: REVIEWING },
      { situations: [stepSituation("step_review", "approve")] },
    ),
    where: "card",
    card: /^Changed files/,
    name: /src\/LoginForm\.tsx/,
  },
  {
    origin: "ReviewStrip",
    button: "a file",
    state: "committing",
    task: inStep({ status: "committing", review: REVIEWING }),
    where: "card",
    card: /^Changed files/,
    name: /src\/LoginForm\.tsx/,
  },
  {
    origin: "ReviewStrip",
    button: "a deleted file",
    state: "awaiting review",
    task: inStep(
      { status: "awaiting_review", review: DELETED },
      { situations: [stepSituation("step_review", "review")] },
    ),
    where: "card",
    card: /^Changed files/,
    name: /src\/legacy\.ts/,
    disabled: true,
  },
  {
    origin: "ReviewStrip",
    button: "a file",
    state: "changes of the pull request to review",
    task: inPR(
      { ...OPENED, status: "in_review", review: makeReview(), sessionStage: "pr_review" },
      "changes_review",
      "review",
    ),
    where: "card",
    card: /^Changed files/,
    name: /src\/api\/login\.ts/,
  },
  {
    origin: "ReviewStrip",
    button: "a file",
    state: "changes of the pull request ready to approve",
    task: inPR(
      { ...OPENED, status: "ready_to_approve", review: REVIEWING, sessionStage: "pr_review" },
      "changes_review",
      "approve",
    ),
    where: "card",
    card: /^Changed files/,
    name: /src\/LoginForm\.tsx/,
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
  {
    origin: "PausedNotice",
    button: "Resume",
    state: "the step session paused",
    task: inStep({ status: "implementing" }, { sessionStatus: "paused" }),
    where: "header",
    name: /^Resume$/,
  },
  {
    origin: "PausedNotice",
    button: "Model",
    state: "the step session paused",
    task: inStep({ status: "implementing" }, { sessionStatus: "paused" }),
    where: "composer",
    name: /^Conversation model:/,
  },
  {
    origin: "FindingsCard",
    button: "Approve",
    state: "findings to decide",
    task: inPR(TO_DECIDE, "findings", "decide"),
    where: "card",
    group: FIRST_FINDING,
    name: /^Approve/,
  },
  {
    origin: "FindingsCard",
    button: "Discard",
    state: "findings to decide",
    task: inPR(TO_DECIDE, "findings", "decide"),
    where: "card",
    group: FIRST_FINDING,
    name: /^Discard/,
  },
  {
    origin: "FindingsCard",
    button: "Edit",
    state: "findings to decide",
    task: inPR(TO_DECIDE, "findings", "decide"),
    where: "card",
    group: FIRST_FINDING,
    name: /^Edit/,
  },
  {
    origin: "FindingsCard",
    button: "bucket.go:31",
    state: "a finding on a line",
    task: inPR(TO_DECIDE, "findings", "decide"),
    where: "card",
    group: FIRST_FINDING,
    role: "link",
    name: /bucket\.go:31/,
  },
  {
    origin: "FindingsCard",
    button: "Open in VS Code",
    state: "a finding on a line",
    task: inPR(TO_DECIDE, "findings", "decide"),
    where: "card",
    group: FIRST_FINDING,
    name: /^Open line 31 of bucket\.go in VS Code$/,
  },
  {
    origin: "FindingsCard",
    button: "Done",
    state: "findings to decide",
    task: inPR(TO_DECIDE, "findings", "decide"),
    where: "card",
    group: FIRST_FINDING,
    name: /^Done$/,
    editing: true,
  },
  ...CARD_STATES.flatMap(([state, task]) => cardRows(state, task)),
  {
    origin: "FindingsReply",
    button: "Ask for a finding",
    state: "findings to decide",
    task: inPR(TO_DECIDE, "findings", "decide"),
    where: "placeholder",
    name: ASK_FOR_FINDINGS,
  },
  {
    origin: "FindingsReply",
    button: "Ask for a finding",
    state: "every finding decided",
    task: inPR(ALL_DECIDED, "findings", "apply"),
    where: "placeholder",
    name: ASK_FOR_FINDINGS,
  },
  {
    origin: "FindingsReply",
    button: "Ask for a finding",
    state: "every finding discarded",
    task: inPR(ALL_DISCARDED, "merge", "merge"),
    where: "placeholder",
    name: ASK_FOR_FINDINGS,
  },
  {
    origin: "FindingsReply",
    button: "Reply with the findings",
    state: "a pass in text",
    task: inPR(IN_TEXT, "findings"),
    where: "placeholder",
    name: /^Tell the PR agent which findings to apply…$/,
  },
  {
    origin: "ReportLink",
    button: "Review 1",
    state: "findings to decide",
    task: inPR(TO_DECIDE, "findings", "decide"),
    where: "details",
    name: /^Review 1 · changes$/,
  },
  {
    origin: "ReportLink",
    button: "Review 1",
    state: "a pass in text",
    task: inPR(IN_TEXT, "findings"),
    where: "details",
    name: /^Review 1 · changes$/,
  },
  {
    origin: "FindingsBar",
    button: "Next to decide",
    state: "findings to decide",
    task: inPR(TO_DECIDE, "findings", "decide"),
    where: "bar",
    name: /^Next to decide/,
  },
  {
    origin: "FindingsBar",
    button: "Approve the rest",
    state: "findings to decide",
    task: inPR(TO_DECIDE, "findings", "decide"),
    where: "bar",
    name: /^Approve the rest/,
  },
  {
    origin: "FindingsBar",
    button: "Apply approved",
    state: "findings to decide",
    task: inPR(TO_DECIDE, "findings", "decide"),
    where: "bar",
    name: /^Apply approved/,
    disabled: true,
  },
  {
    origin: "FindingsBar",
    button: "Apply approved",
    state: "every finding decided",
    task: inPR(ALL_DECIDED, "findings", "apply"),
    where: "bar",
    name: /^Apply approved/,
  },
  {
    origin: "FindingsBar",
    button: "Open PR",
    state: "every finding discarded",
    task: inPR(ALL_DISCARDED, "merge", "merge"),
    where: "bar",
    name: /^Open PR$/,
  },
  {
    origin: "FindingsBar",
    button: "Approve",
    state: "the pass sent, no file changed",
    task: inPR(
      {
        ...FINDINGS_PASS,
        status: "in_review",
        review: makeReview({ files: [], staged: 0, total: 0, percent: 0 }),
        reports: ALL_DECIDED.reports ?? [],
      },
      "changes_review",
      "review",
    ),
    where: "bar",
    name: /^Approve$/,
    disabled: true,
  },
  {
    origin: "ReviewMenu",
    button: "Review again",
    state: "findings to decide",
    task: inPR(TO_DECIDE, "findings", "decide"),
    where: "menu",
    name: /^Review again/,
  },
  {
    origin: "ReviewMenu",
    button: "Refresh PR",
    state: "findings to decide",
    task: inPR(TO_DECIDE, "findings", "decide"),
    where: "menu",
    name: /^Refresh PR/,
  },
  {
    origin: "FindingsCard",
    button: "Review 1 written",
    state: "the report written",
    task: inPR(TO_DECIDE, "findings", "decide"),
    transcripts: REPORTED,
    where: "entry",
    entry: /^Review 1 written/,
    name: /^Review 1 written/,
  },
  {
    origin: "PendingMessage",
    button: "Remove",
    state: "a message queued",
    task: inStep({ status: "implementing" }, { pendingCount: 1 }),
    transcripts: QUEUED,
    where: "entry",
    entry: /^You, queued/,
    name: /^Remove$/,
  },
];

describe("where the actions of the bars that left went", () => {
  it.each(ROWS)(
    "$origin: $button, $state, is in the $where",
    async ({
      task,
      where,
      name,
      trigger,
      disabled,
      card: cardName,
      entry,
      role,
      group,
      editing,
      transcripts,
    }) => {
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
      } else if (where === "card" && group !== undefined) {
        let holder: HTMLElement | null = null;
        for (const groupName of group) {
          holder = await (holder === null
            ? screen.findByRole("group", { name: groupName })
            : within(holder).findByRole("group", { name: groupName }));
        }
        if (holder === null) {
          throw new Error("the row names no group");
        }
        if (editing) {
          await user.click(within(holder).getByRole("button", { name: /^Edit/ }));
        }
        found = await within(holder).findByRole(role ?? "button", { name });
      } else if (where === "card") {
        const card =
          cardName === undefined
            ? await waitFor(() => {
                const pending = document.querySelector<HTMLElement>("[data-pending-card]");
                expect(pending).not.toBeNull();
                return pending as HTMLElement;
              })
            : await screen.findByRole("article", { name: cardName });
        found = within(card).getByRole(role ?? "button", { name });
      } else if (where === "placeholder") {
        const composer = await screen.findByRole("textbox", { name: /^Reply to/ });
        expect(composer.getAttribute("placeholder")).toMatch(name);
        return;
      } else if (where === "details") {
        await user.click(
          within(screen.getByRole("banner")).getByRole("button", { name: "Details" }),
        );
        const details = await screen.findByRole("complementary", { name: "Details" });
        found = within(within(details).getByRole("region", { name: "Pull request" })).getByRole(
          "button",
          { name },
        );
      } else if (where === "header") {
        found = within(screen.getByRole("banner")).getByRole("button", { name });
      } else if (where === "composer") {
        const composer = (await screen.findByRole("textbox", { name: /^Reply to/ })).parentElement;
        expect(composer).not.toBeNull();
        found = within(composer as HTMLElement).getByRole("button", { name });
      } else {
        const held = await screen.findByRole("article", { name: entry ?? /^$/ });
        found = within(held).getByRole("button", { name });
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
  ["findings decide", inPR(TO_DECIDE, "findings", "decide")],
  ["findings apply", inPR(ALL_DECIDED, "findings", "apply")],
  ["the report rewritten", inPR(REWRITING)],
  ["merge, every finding discarded", inPR(ALL_DISCARDED, "merge", "merge")],
  [
    "changes_review, no file changed",
    inPR(
      {
        ...FINDINGS_PASS,
        status: "in_review",
        review: makeReview({ files: [], staged: 0, total: 0, percent: 0 }),
        reports: ALL_DECIDED.reports ?? [],
      },
      "changes_review",
      "review",
    ),
  ],
  [
    "paused",
    inStep({ status: "ready_to_approve", review: REVIEWING }, { sessionStatus: "paused" }),
  ],
];

// PENDING_CARDS are the conversations holding the card of the situations that wait on one.
const PENDING_CARDS: Record<string, Record<string, TranscriptState>> = {
  question: ASKING,
  permission: withCard(permissionEntry('[{"type":"addRules"}]')),
};

// WRITTEN is a message written in the composer of every conversation the situations show, so Send
// could be a primary too.
const WRITTEN = {
  "task-1|step:1": "go on",
  "task-1|pr": "go on",
  "task-1|pr_review": "go on",
  "task-1|prd": "go on",
  "task-1|plan": "go on",
};

describe("the primary of the task screen", () => {
  it.each(SITUATIONS)("is one at most in %s", async (kind, task) => {
    const cards = PENDING_CARDS[kind];
    const { container } = renderWithStore(<TaskView taskId={task.id} />, {
      state: makeState({
        tasks: [task],
        repositories: [makeRepository({ id: task.repositoryId })],
      }),
      ui: {
        location: { kind: "task", id: task.id },
        drafts: WRITTEN,
        ...(cards === undefined ? {} : { transcripts: cards }),
      },
    });

    if (cards !== undefined) {
      await waitFor(() =>
        expect(container.querySelector(`[data-pending-card=${kind}]`)).not.toBeNull(),
      );
    }
    expect(container.querySelectorAll("button[data-variant=primary]").length).toBeLessThanOrEqual(
      1,
    );
  });
});

// SEND_IS_PRIMARY are the situations whose bar has no primary: Send with a message written is the
// primary of the screen (principles 2).
const SEND_IS_PRIMARY: [string, TaskSummary][] = [
  ["reply without a draft", inPR({ status: "awaiting_reply", sessionStage: "pr" }, "reply")],
  ...SITUATIONS.filter(([kind]) =>
    [
      "plan_invalid",
      "findings",
      "worktree_unreadable",
      "step_empty",
      "merge, every finding discarded",
    ].includes(kind),
  ),
  [
    "session_error of a turn that failed",
    inStep(
      { status: "implementing" },
      { lastError: "", turnFailed: true, situations: [stepSituation("session_error")] },
    ),
  ],
];

describe("Send, the primary where the bar has none", () => {
  it.each(SEND_IS_PRIMARY)("is the one primary in %s", async (_, task) => {
    const { container } = renderWithStore(<TaskView taskId={task.id} />, {
      state: makeState({
        tasks: [task],
        repositories: [makeRepository({ id: task.repositoryId })],
      }),
      ui: { location: { kind: "task", id: task.id }, drafts: WRITTEN },
    });

    const send = await screen.findByRole("button", { name: /^Send/ });
    expect(send).toHaveAttribute("data-variant", "primary");
    expect([...container.querySelectorAll("button[data-variant=primary]")]).toEqual([send]);
  });
});
