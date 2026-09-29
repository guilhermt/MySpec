import type { RequestForm } from "@/components/system/RequestBar";
import type { GlyphState } from "@/components/system/StateGlyph";
import { canCloseTask, closeHint, draftAtHand } from "@/features/task/pr-status";
import {
  currentStepOf,
  hasStepSession,
  reviewCountLabel,
  stepStage,
} from "@/features/task/step-status";
import { isPaused } from "@/features/task/task-session";
import { prBaseName, troubleLabel } from "@/lib/pull-requests";
import { fallbackReason } from "@/lib/review-modes";
import {
  compactWait,
  lowerFirst,
  prSituation,
  reviewerSituation,
  spokenWait,
  stageSituation,
  stepSituation,
} from "@/lib/situations";
import { asLifecycleStage, stageLabel } from "@/lib/stages";
import type {
  BlockReason,
  Entry,
  PRBlockReason,
  PullRequest,
  Repository,
  Review,
  Situation,
  SituationGroup,
  SituationKind,
  Step,
  TaskSummary,
} from "@/lib/wails";
import {
  asBlockReason,
  asPermissionStatus,
  asPlaceKind,
  asPRBlockReason,
  asPRStatus,
  asReviewFallback,
  asSituationForm,
  asSituationGroup,
  asSituationKind,
  asStepStatus,
  asTaskMode,
  asTaskStage,
} from "@/lib/wails";
import type { PrDraft, StepTab } from "@/store/app-store";

/** TaskRequestAction is what a button of the request bar of a task does. */
export type TaskRequestAction =
  | "openInEditor"
  | "approveStep"
  | "discardStep"
  | "continue"
  | "approveDraft"
  | "discardDraft"
  | "approvePR"
  | "openPR"
  | "closeTask"
  | "reviewAgain"
  | "deleteTask"
  | "show"
  | "retrySession"
  | "cleanAndStart"
  | "changePath"
  | "retryStep"
  | "retryPR"
  | "showProblems";

/** TaskRequestButton is one button of the request bar of a task. */
export interface TaskRequestButton {
  action: TaskRequestAction;
  /** label is "Approve", "Discard step 4…". */
  label: string;
  variant: "primary" | "secondary";
  /** shortcut is the key in the tooltip: "Ctrl+E" on Open in VS Code. */
  shortcut?: string;
  /** disabledReason is why the button can't be pressed: "Stage 2 more files". */
  disabledReason?: string;
  /** loadingLabel is "Approving…", "Continuing…", "Closing…", "Asking…"; "" when the action has none. */
  loadingLabel: string;
  /** tooltip says what the button does, when its label doesn't: Review again of a PR in trouble. */
  tooltip?: string;
  /** stage is the session Retry restarts (step:4, step_review:4, pr, pr_review, prd…); retrySession only. */
  stage?: string;
}

/**
 * RequestFocus is where the focus goes on arriving at the request, and on Show: the pending card
 * (its first option, or Allow), the primary of the bar, the composer, or the bar itself when none
 * of its actions can be pressed.
 */
export type RequestFocus = "question" | "permission" | "primary" | "composer" | "bar";

/** TaskRequestModel is the request bar of the task screen. */
export interface TaskRequestModel {
  /** form is tinted, error or closing, or quiet where a card holds the answer and when paused. */
  form: RequestForm;
  /** glyph is the one of the situation, or paused when paused. */
  glyph: GlyphState;
  label: string;
  place?: string;
  /** time is the wait of the situation; absent when paused. */
  time?: { short: string; long: string; tone: "wait" | "error" | "close" };
  progress?: string;
  /** progressTooltip is the reason behind the progress: why the merge couldn't be confirmed. */
  progressTooltip?: string;
  /** status is the label and the place the situation was born with. */
  status: string;
  actions: TaskRequestButton[];
  /** situationId is null when paused. */
  situationId: string | null;
  /** focus is where the focus goes on arriving at the situation, and on Show. */
  focus: RequestFocus;
}

/** PendingRequest is the card the conversation on screen holds pending, read from its transcript. */
export type PendingRequest =
  | { kind: "question"; questions: number }
  | { kind: "permission"; defaultToNo: boolean };

/** OtherConversationModel is the bar of a step whose other conversation asks, and not the one on screen. */
export interface OtherConversationModel {
  /** failed is the other conversation having stopped on an error; otherwise it waits. */
  failed: boolean;
  /** label is "The reviewer waits · Question", or "Session error · Reviewer". */
  label: string;
  /** goLabel is "Go to reviewer", "Go to implementer". */
  goLabel: string;
  /** goTab is the tab of the other conversation. */
  goTab: StepTab;
  /** status is what the bar's status says. */
  status: string;
  situationId: string;
  time?: { short: string; long: string };
}

/** RequestKind is each situation whose bar the task screen draws. */
export type RequestKind = Extract<
  SituationKind,
  | "step_review"
  | "step_empty"
  | "ready_to_continue"
  | "draft"
  | "changes_review"
  | "merge"
  | "pr_trouble"
  | "pr_closed"
>;

/** Want is what the bar asks for: the kind of the request and its form, from a situation or from the state. */
interface Want {
  kind: RequestKind;
  /** approve is the review with every file staged; close, the merge whose closing is offered. */
  form: "" | "approve" | "close";
}

/**
 * Bar is the part of the bar both sources draw the same; without a focus of its own, the focus is
 * the primary when an action can be pressed, else the bar.
 */
type Bar = Omit<TaskRequestModel, "glyph" | "time" | "situationId" | "focus"> & {
  focus?: RequestFocus;
};

/** Drawn is a bar as the task screen draws it, before the glyph, the wait and the situation. */
type Drawn = Omit<TaskRequestModel, "glyph" | "time" | "situationId">;

const STEP_KINDS: readonly SituationKind[] = ["step_review", "step_empty"];
const PR_KINDS: readonly SituationKind[] = [
  "draft",
  "changes_review",
  "merge",
  "pr_trouble",
  "pr_closed",
];

const TONES: Record<SituationGroup, "wait" | "error" | "close"> = {
  error: "error",
  waiting: "wait",
  closing: "close",
};

function openInEditor(): TaskRequestButton {
  return {
    action: "openInEditor",
    label: "Open in VS Code",
    variant: "secondary",
    shortcut: "Ctrl+E",
    loadingLabel: "",
  };
}

function approve(action: TaskRequestAction, review: Review | null): TaskRequestButton {
  const button: TaskRequestButton = {
    action,
    label: "Approve",
    variant: "primary",
    loadingLabel: "Approving…",
  };
  if (review === null) {
    return button;
  }
  if (review.error !== "") {
    return { ...button, disabledReason: "The worktree couldn't be read" };
  }
  if (review.percent < 100) {
    const left = review.total - review.staged;
    return { ...button, disabledReason: `Stage ${left} more ${left === 1 ? "file" : "files"}` };
  }
  return button;
}

// staged is how far a review got: "5 of 7 files staged · 71%"; "" when the worktree couldn't be read.
function staged(review: Review | null): string[] {
  return review === null || review.error !== ""
    ? []
    : [`${reviewCountLabel(review)} · ${review.percent}%`];
}

function joined(parts: readonly string[]): string {
  return parts.join(" · ");
}

function stepBar(task: TaskSummary, step: Step, want: Want): Bar {
  if (want.kind === "step_empty") {
    const label = `Step ${step.number} has no changes`;
    const discard =
      asTaskMode(task.mode) === "one_shot"
        ? "Discard the implementation…"
        : `Discard step ${step.number}…`;
    return {
      form: "tinted",
      label,
      status: label,
      actions: [{ action: "discardStep", label: discard, variant: "secondary", loadingLabel: "" }],
    };
  }
  const notes = [...staged(step.review)];
  if (step.commitFailed) {
    notes.push("the last approval didn't produce a commit");
  }
  const fallback = asReviewFallback(step.reviewFallback);
  if (fallback === "rounds_exhausted" || fallback === "commit_failed") {
    notes.push(lowerFirst(fallbackReason(fallback)));
  }
  const label =
    want.form === "approve" ? `Approve step ${step.number}` : `Review step ${step.number}`;
  return {
    form: "tinted",
    label,
    progress: joined(notes),
    status: label,
    actions: [openInEditor(), approve("approveStep", step.review)],
  };
}

function continueBar(task: TaskSummary): Bar {
  const stage = asLifecycleStage(task.stage);
  const place = stage === null ? "" : stageLabel(stage);
  return {
    form: "tinted",
    label: "Ready to continue",
    place,
    status: `Ready to continue · ${place}`,
    actions: [
      { action: "continue", label: "Continue", variant: "primary", loadingLabel: "Continuing…" },
    ],
  };
}

// effectiveDraft is the title and the body the user would send: what the user edited, field by
// field, falling back to the agent's draft on disk.
function effectiveDraft(pr: PullRequest, edited: PrDraft | null): PrDraft {
  return {
    title: edited?.title ?? pr.draft?.title ?? "",
    body: edited?.body ?? pr.draft?.body ?? "",
  };
}

function draftRefusal(pr: PullRequest, draft: PrDraft): string | undefined {
  if (pr.turnRunning) {
    return "Wait for the agent to finish";
  }
  if (draft.title.trim() === "" || draft.body.trim() === "") {
    return "Write a title and a description";
  }
  return undefined;
}

// approveDraftButton is Approve draft, disabled with the reason the draft can't be sent yet.
function approveDraftButton(pr: PullRequest, edited: PrDraft | null): TaskRequestButton {
  const refusal = draftRefusal(pr, effectiveDraft(pr, edited));
  return {
    action: "approveDraft",
    label: "Approve draft",
    variant: "primary",
    loadingLabel: "Approving…",
    ...(refusal === undefined ? {} : { disabledReason: refusal }),
  };
}

function closeTaskButton(
  variant: "primary" | "secondary",
  disabledReason?: string,
): TaskRequestButton {
  return {
    action: "closeTask",
    label: "Close task",
    variant,
    loadingLabel: "Closing…",
    ...(disabledReason === undefined || disabledReason === "" ? {} : { disabledReason }),
  };
}

const OPEN_PR: TaskRequestButton = {
  action: "openPR",
  label: "Open PR",
  variant: "secondary",
  loadingLabel: "",
};

function mergeBar(pr: PullRequest, want: Want, repository: Repository | null): Bar {
  const number = `#${pr.prNumber}`;
  const updates = `Removes the worktree and the branch, then updates ${prBaseName(pr)}`;
  if (asPRStatus(pr.status) === "merged") {
    const place = `${number} merged`;
    return {
      form: "closing",
      label: "Ready to close",
      place,
      progress: updates,
      status: `Ready to close · ${place}`,
      actions: [
        closeTaskButton("primary", canCloseTask(pr) ? undefined : closeHint(pr, repository)),
      ],
    };
  }
  if (want.form === "close") {
    return {
      form: "closing",
      label: "Ready to close",
      place: number,
      progress: `Couldn't confirm the merge · ${updates}`,
      progressTooltip: pr.checkError,
      status: `Ready to close · ${number}`,
      actions: [OPEN_PR, closeTaskButton("primary")],
    };
  }
  return {
    form: "tinted",
    label: "Ready to merge",
    place: number,
    progress: pr.cloneMissing ? closeHint(pr, repository) : "",
    status: `Ready to merge · ${number}`,
    actions: [OPEN_PR],
  };
}

/** REVIEW_AGAIN_TOOLTIP is what Review again does to a pull request in trouble. */
const REVIEW_AGAIN_TOOLTIP =
  "Review again reads GitHub and turns this into findings of a new pass.";

function troubleBar(pr: PullRequest): Bar {
  const failed = pr.trouble.failedChecks ?? [];
  const notes: string[] = [];
  if (failed.length > 0) {
    notes.push(`Failed: ${failed.join(", ")}`);
  }
  if (pr.trouble.conflict) {
    notes.push(`Conflict with ${prBaseName(pr)}`);
  }
  if (pr.canClose) {
    notes.push("Couldn't confirm the merge");
  }
  const label = troubleLabel(pr.trouble);
  const actions: TaskRequestButton[] = [
    {
      action: "reviewAgain",
      label: "Review again",
      variant: "primary",
      loadingLabel: "Asking…",
      tooltip: REVIEW_AGAIN_TOOLTIP,
    },
  ];
  if (pr.canClose) {
    actions.push(closeTaskButton("secondary"));
  }
  return {
    form: "error",
    label,
    progress: joined(notes),
    ...(pr.canClose ? { progressTooltip: pr.checkError } : {}),
    status: label,
    actions,
  };
}

function prBar(
  pr: PullRequest,
  want: Want,
  repository: Repository | null,
  editedDraft: PrDraft | null,
): Bar {
  switch (want.kind) {
    case "draft":
      return {
        form: "tinted",
        label: "Draft to approve",
        status: "Draft to approve",
        actions: [
          approveDraftButton(pr, editedDraft),
          {
            action: "discardDraft",
            label: "Discard draft",
            variant: "secondary",
            loadingLabel: "",
          },
        ],
      };
    case "changes_review": {
      const notes = [...staged(pr.review)];
      if (pr.commitFailed) {
        notes.push("the last approval didn't produce a commit");
      }
      const label = want.form === "approve" ? "Approve changes" : "Review changes";
      return {
        form: "tinted",
        label,
        progress: joined(notes),
        status: label,
        actions: [openInEditor(), approve("approvePR", pr.review)],
      };
    }
    case "merge":
      return mergeBar(pr, want, repository);
    case "pr_trouble":
      return troubleBar(pr);
    default: {
      const place = `#${pr.prNumber}`;
      return {
        form: "error",
        label: "PR closed unmerged",
        place,
        status: `PR closed unmerged · ${place}`,
        actions: [
          { action: "deleteTask", label: "Delete task…", variant: "secondary", loadingLabel: "" },
        ],
      };
    }
  }
}

function barOf(
  task: TaskSummary,
  want: Want,
  repository: Repository | null,
  editedDraft: PrDraft | null,
): Bar | null {
  switch (want.kind) {
    case "step_review":
    case "step_empty": {
      const step = currentStepOf(task);
      return step === null ? null : stepBar(task, step, want);
    }
    case "ready_to_continue":
      return continueBar(task);
    default:
      return task.pr === null ? null : prBar(task.pr, want, repository, editedDraft);
  }
}

// focusOf is the focus of a bar without one of its own: the primary, or the first action that can
// be pressed, when there is one; else the bar.
function focusOf(actions: readonly TaskRequestButton[]): RequestFocus {
  return actions.some((action) => action.disabledReason === undefined) ? "primary" : "bar";
}

// clean drops the parts a bar doesn't have and settles its focus, so a bar reads the same
// whichever source drew it.
function clean(bar: Bar): Drawn {
  const { place, progress, progressTooltip, focus, ...rest } = bar;
  return {
    ...rest,
    ...(place === undefined || place === "" ? {} : { place }),
    ...(progress === undefined || progress === "" ? {} : { progress }),
    ...(progressTooltip === undefined || progressTooltip === "" ? {} : { progressTooltip }),
    focus: focus ?? focusOf(rest.actions),
  };
}

// drawn is the bar of a situation, with its glyph, without the wait, which taskRequestOf adds.
function drawn(situation: Situation, bar: Bar): TaskRequestModel {
  return {
    ...clean(bar),
    glyph: TONES[asSituationGroup(situation.group)],
    situationId: situation.id,
  };
}

function formOf(situation: Situation): Want["form"] {
  switch (asSituationForm(situation.form)) {
    case "approve":
      return "approve";
    case "close":
      return "close";
    default:
      return "";
  }
}

// TASK_KINDS are the situations of a task whose bar the task screen draws.
const TASK_KINDS: readonly SituationKind[] = [
  ...STEP_KINDS,
  ...PR_KINDS,
  "ready_to_continue",
  "question",
  "permission",
  "reply",
  "session_error",
  "step_blocked",
  "worktree_unreadable",
  "pr_blocked",
  "plan_invalid",
  "findings",
];

// screenSituation is the situation of the conversation on screen, null when there is none: the one
// of the step (step_review and step_empty are on both tabs), of the tab on screen, of the stage or
// of the pull request.
function screenSituation(task: TaskSummary, tab: StepTab): Situation | null {
  const step = currentStepOf(task);
  let found: Situation | null = null;
  if (step !== null) {
    const inStep = stepSituation(task, step.number);
    const onReviewer = tab === "reviewer" && step.reviewer !== null;
    found =
      inStep !== null && STEP_KINDS.includes(asSituationKind(inStep.kind))
        ? inStep
        : onReviewer
          ? reviewerSituation(task, step.number)
          : inStep;
  }
  found ??= stageSituation(task) ?? prSituation(task);
  return found !== null && TASK_KINDS.includes(asSituationKind(found.kind)) ? found : null;
}

// pausedWant is what the state of the step or of the pull request asks for while the task is paused.
function pausedWant(task: TaskSummary): Want | null {
  const step = currentStepOf(task);
  if (step !== null) {
    switch (asStepStatus(step.status)) {
      case "awaiting_review":
      case "in_review":
        return { kind: "step_review", form: "" };
      case "ready_to_approve":
        return { kind: "step_review", form: "approve" };
      case "nothing_to_commit":
        return { kind: "step_empty", form: "" };
      default:
        return null;
    }
  }
  const pr = task.pr;
  if (pr === null) {
    return null;
  }
  switch (asPRStatus(pr.status)) {
    case "draft_ready":
      return { kind: "draft", form: "" };
    case "in_review":
      return { kind: "changes_review", form: "" };
    case "ready_to_approve":
      return { kind: "changes_review", form: "approve" };
    case "done":
      return { kind: "merge", form: pr.canClose ? "close" : "" };
    case "merged":
      return { kind: "merge", form: "close" };
    case "trouble":
      return { kind: "pr_trouble", form: "" };
    case "pr_closed":
      return { kind: "pr_closed", form: "" };
    default:
      return null;
  }
}

/** pausedRequestOf is the paused half: what the state of the step or the PR asks for, quiet, without a chip. */
export function pausedRequestOf(
  task: TaskSummary,
  repository: Repository | null = null,
  editedDraft: PrDraft | null = null,
): TaskRequestModel | null {
  const want = pausedWant(task);
  const bar = want === null ? null : barOf(task, want, repository, editedDraft);
  return bar === null ? null : { ...clean(bar), form: "quiet", glyph: "paused", situationId: null };
}

// situationRequestOf is the bar of a situation of the task, without the wait.
function situationRequestOf(
  situation: Situation,
  task: TaskSummary,
  pending: PendingRequest | null,
  repository: Repository | null,
  editedDraft: PrDraft | null,
): TaskRequestModel | null {
  const kind = asSituationKind(situation.kind);
  switch (kind) {
    case "question":
    case "permission":
    case "reply":
    case "session_error": {
      const atHand =
        asPlaceKind(situation.place.kind) === "pr" && task.pr !== null && draftAtHand(task.pr);
      return sessionRequestOf(situation, task, pending, atHand, editedDraft);
    }
    case "step_blocked":
    case "worktree_unreadable":
    case "pr_blocked":
      return blockRequestOf(situation, task);
    case "plan_invalid":
      return planRequestOf(situation, task);
    case "findings":
      return findingsRequestOf(situation, task);
    default: {
      const bar = barOf(
        task,
        { kind: kind as RequestKind, form: formOf(situation) },
        repository,
        editedDraft,
      );
      return bar === null ? null : drawn(situation, bar);
    }
  }
}

/**
 * taskRequestOf is the request bar of the task screen: the situation of the conversation on screen
 * (not paused), or what the state of the step or the PR asks for (paused); null for everything
 * else. pending is the card the conversation on screen holds pending.
 */
export function taskRequestOf(
  task: TaskSummary,
  tab: StepTab,
  now: number,
  repository: Repository | null = null,
  editedDraft: PrDraft | null = null,
  pending: PendingRequest | null = null,
): TaskRequestModel | null {
  if (isPaused(task)) {
    return pausedRequestOf(task, repository, editedDraft);
  }
  const situation = screenSituation(task, tab);
  const request =
    situation === null
      ? null
      : situationRequestOf(situation, task, pending, repository, editedDraft);
  if (situation === null || request === null) {
    return null;
  }
  return {
    ...request,
    time: {
      short: compactWait(situation.startedAt, now),
      long: spokenWait(situation.startedAt, now),
      tone: TONES[asSituationGroup(situation.group)],
    },
  };
}

/** pendingRequestOf is the card a conversation holds pending, from its entries: the last question or permission still unanswered. */
export function pendingRequestOf(entries: readonly Entry[]): PendingRequest | null {
  for (let index = entries.length - 1; index >= 0; index -= 1) {
    const entry = entries[index];
    if (entry?.question != null && asPermissionStatus(entry.question.status) === "pending") {
      return { kind: "question", questions: (entry.question.questions ?? []).length };
    }
    if (entry?.permission != null && asPermissionStatus(entry.permission.status) === "pending") {
      return { kind: "permission", defaultToNo: entry.permission.defaultToNo };
    }
  }
  return null;
}

/**
 * screenStageOf is the session stage of the conversation on screen: the tab of the step that runs
 * in the implementation, the pull request's in the PR stage, the stage itself before; "" when the
 * place has none yet.
 */
export function screenStageOf(task: TaskSummary, tab: StepTab): string {
  switch (asTaskStage(task.stage)) {
    case "implementation": {
      const step = currentStepOf(task);
      if (step === null) {
        return "";
      }
      return tab === "reviewer" && step.reviewer !== null
        ? step.reviewer.sessionStage
        : stepStage(step.number);
    }
    case "pr":
      return task.pr?.sessionStage ?? "";
    default:
      return task.stage;
  }
}

/** BLOCK_WORDS are the short reasons of a blocked step, the place of its bar. */
const BLOCK_WORDS: Record<BlockReason, string> = {
  dirty_worktree: "worktree not clean",
  fetch_failed: "fetch failed",
  no_base_branch: "no base branch",
  path_exists: "path exists",
  branch_exists: "branch exists",
  git_failed: "git failed",
  clone_missing: "clone missing",
};

/** PR_BLOCK_WORDS are the short reasons of a blocked pull request, the place of its bar. */
const PR_BLOCK_WORDS: Record<PRBlockReason, string> = {
  gh_missing: "gh not installed",
  gh_unauthenticated: "gh not signed in",
  gh_failed: "gh failed",
  git_failed: "git failed",
  no_worktree: "no worktree",
};

/** SESSION_WORDS are the short words of what a conversation asks, on the bar of the other one. */
const SESSION_WORDS: Partial<Record<SituationKind, string>> = {
  permission: "Permission",
  question: "Question",
  reply: "Reply",
};

/** TAB_NAMES are the conversations of the two tabs of a step, as the bar names them. */
const TAB_NAMES: Record<StepTab, string> = { implementer: "Implementer", reviewer: "Reviewer" };

/** SHOW is the action of a bar whose card holds the answer: it goes to the card. */
const SHOW: TaskRequestButton = {
  action: "show",
  label: "Show",
  variant: "secondary",
  loadingLabel: "",
};

// statusOf is what the bar's status says: the label and the place.
function statusOf(label: string, place = ""): string {
  return place === "" ? label : `${label} · ${place}`;
}

// conversationName is what the bar calls a conversation of a task, by its session stage.
function conversationName(stage: string): string {
  switch (stage.split(":")[0]) {
    case "prd":
      return "PRD";
    case "tech_spec":
      return "Tech spec";
    case "plan":
      return "Plan";
    case "one_shot":
      return "Planning";
    case "step":
      return "Implementer";
    case "step_review":
      return "Reviewer";
    case "pr":
      return "PR";
    case "pr_review":
      return "PR review";
    default:
      return "";
  }
}

// speakerOf is who talks in a conversation of a task inside a sentence, by its session stage.
function speakerOf(stage: string): string {
  switch (stage.split(":")[0]) {
    case "prd":
      return "PRD agent";
    case "tech_spec":
      return "tech spec agent";
    case "plan":
      return "plan agent";
    case "one_shot":
      return "planning agent";
    case "step":
      return "implementer";
    case "step_review":
      return "reviewer";
    case "pr":
    case "pr_review":
      return "PR agent";
    default:
      return "";
  }
}

/** retryLabelOf is the label of Retry on a session that stopped: "Retry implementer", "Retry PRD agent". */
export function retryLabelOf(stage: string): string {
  const who = speakerOf(stage);
  return who === "" ? "Retry" : `Retry ${who}`;
}

function stepOf(task: TaskSummary, number: number): Step | null {
  return (task.steps ?? []).find((step) => step.number === number) ?? null;
}

/** SituationSession is the session a situation of a task is in. */
interface SituationSession {
  /** stage is the session stage: prd, step:4, step_review:4, pr, pr_review. */
  stage: string;
  lastError: string;
}

// situationSession is the session a situation is in, by its place.
function situationSession(situation: Situation, task: TaskSummary): SituationSession {
  const { place } = situation;
  switch (asPlaceKind(place.kind)) {
    case "step":
      return { stage: stepStage(place.step), lastError: task.lastError };
    case "step_review": {
      const reviewer = stepOf(task, place.step)?.reviewer ?? null;
      return {
        stage: reviewer?.sessionStage ?? `step_review:${place.step}`,
        lastError: reviewer?.lastError ?? "",
      };
    }
    case "pr":
      return {
        stage: task.pr === null || task.pr.sessionStage === "" ? "pr" : task.pr.sessionStage,
        lastError: task.pr?.lastError ?? "",
      };
    default:
      return { stage: place.stage, lastError: task.lastError };
  }
}

/**
 * sessionRequestOf is the bar of what a conversation asks: a question or a permission, quiet with
 * Show; a reply, tinted, and with the draft at hand, Approve draft; a session error, with Retry
 * when the session stopped and none when only its turn failed. The place is the conversation;
 * editedDraft is the draft as the user edited it. Without the wait, which taskRequestOf adds.
 */
export function sessionRequestOf(
  s: Situation,
  task: TaskSummary,
  pending: PendingRequest | null,
  draftAtHand: boolean,
  editedDraft: PrDraft | null = null,
): TaskRequestModel {
  const session = situationSession(s, task);
  const place = conversationName(session.stage);
  switch (asSituationKind(s.kind)) {
    case "question": {
      const questions = pending?.kind === "question" ? pending.questions : 0;
      return drawn(s, {
        form: "quiet",
        label: "Question",
        place,
        progress: questions > 1 ? `${questions} questions` : "",
        status: statusOf("Question", place),
        actions: [SHOW],
        focus: "question",
      });
    }
    case "permission":
      return drawn(s, {
        form: "quiet",
        label: "Permission",
        place,
        status: statusOf("Permission", place),
        actions: [SHOW],
        focus: "permission",
      });
    case "session_error": {
      // A turn that failed leaves the session alive: the answer goes through the composer, and
      // Retry would do nothing.
      const actions: TaskRequestButton[] =
        session.lastError === ""
          ? []
          : [
              {
                action: "retrySession",
                label: retryLabelOf(session.stage),
                variant: "primary",
                loadingLabel: "Retrying…",
                stage: session.stage,
              },
            ];
      return drawn(s, {
        form: "error",
        label: "Session error",
        place,
        status: statusOf("Session error", place),
        actions,
        focus: actions.length > 0 ? "primary" : "composer",
      });
    }
    default: {
      const actions =
        draftAtHand && task.pr !== null ? [approveDraftButton(task.pr, editedDraft)] : [];
      return drawn(s, {
        form: "tinted",
        label: "Waiting for reply",
        place,
        status: statusOf("Waiting for reply", place),
        actions,
        focus: actions.length > 0 ? "primary" : "composer",
      });
    }
  }
}

/**
 * blockRequestOf is the bar of a block: the step blocked, with the short reason and Try again (and
 * Clean and start… or Change path… when they help); the worktree unreadable, which clears on its
 * own; the pull request blocked, with Try again. Without the wait, which taskRequestOf adds.
 */
export function blockRequestOf(s: Situation, task: TaskSummary): TaskRequestModel {
  switch (asSituationKind(s.kind)) {
    case "step_blocked": {
      const step = stepOf(task, s.place.step) ?? currentStepOf(task);
      const reason = asBlockReason(step?.block?.reason ?? "");
      const label =
        asTaskMode(task.mode) === "one_shot"
          ? "Implementation blocked"
          : `Step ${s.place.step} blocked`;
      const place = BLOCK_WORDS[reason];
      const actions: TaskRequestButton[] = [];
      if (reason === "dirty_worktree") {
        actions.push({
          action: "cleanAndStart",
          label: "Clean and start…",
          variant: "secondary",
          loadingLabel: "",
        });
      }
      if (reason === "clone_missing") {
        actions.push({
          action: "changePath",
          label: "Change path…",
          variant: "secondary",
          loadingLabel: "",
        });
      }
      actions.push({
        action: "retryStep",
        label: "Try again",
        variant: "primary",
        loadingLabel: "Checking…",
      });
      return drawn(s, {
        form: "error",
        label,
        place,
        status: statusOf(label, place),
        actions,
        focus: "primary",
      });
    }
    case "pr_blocked": {
      const place = PR_BLOCK_WORDS[asPRBlockReason(task.pr?.block?.reason ?? "")];
      return drawn(s, {
        form: "error",
        label: "PR blocked",
        place,
        status: statusOf("PR blocked", place),
        actions: [
          { action: "retryPR", label: "Try again", variant: "primary", loadingLabel: "Trying…" },
        ],
        focus: "primary",
      });
    }
    default:
      // The whole message is on the card of the changed files.
      return drawn(s, {
        form: "error",
        label: "Can't read worktree",
        status: "Can't read worktree",
        actions: [],
        focus: "bar",
      });
  }
}

/**
 * planRequestOf is the bar of a plan still invalid after the corrections: how many problems, and
 * Show problems, which opens the marker that lists them. Without the wait, which taskRequestOf adds.
 */
export function planRequestOf(s: Situation, task: TaskSummary): TaskRequestModel {
  const problems = (task.planProblems ?? []).length;
  return drawn(s, {
    form: "tinted",
    label: "Plan still invalid",
    progress: problems === 0 ? "" : `${problems} ${problems === 1 ? "problem" : "problems"}`,
    status: "Plan still invalid",
    actions: [
      {
        action: "showProblems",
        label: "Show problems",
        variant: "secondary",
        loadingLabel: "",
      },
    ],
    focus: "composer",
  });
}

/**
 * findingsRequestOf is the bar of the findings of the PR review to decide: tinted, without an
 * action, the answer going through the composer. Without the wait, which taskRequestOf adds.
 */
export function findingsRequestOf(s: Situation, _task: TaskSummary): TaskRequestModel {
  return drawn(s, {
    form: "tinted",
    label: "Decide findings",
    place: "PR review",
    status: statusOf("Decide findings", "PR review"),
    actions: [],
    focus: "composer",
  });
}

/**
 * otherConversationOf is the bar of a step with both tabs when the conversation on screen asks
 * nothing and the other one asks: it waits (a permission, a question, a reply) or it failed. Null
 * otherwise; step_review and step_empty are the step's, and their bar is on both tabs.
 */
export function otherConversationOf(
  task: TaskSummary,
  tab: StepTab,
  now: number,
): OtherConversationModel | null {
  const step = asTaskStage(task.stage) === "implementation" ? currentStepOf(task) : null;
  if (step === null || !hasStepSession(step) || step.reviewer === null) {
    return null;
  }
  const ofStep = stepSituation(task, step.number);
  const ofReviewer = reviewerSituation(task, step.number);
  if (ofStep !== null && STEP_KINDS.includes(asSituationKind(ofStep.kind))) {
    return null;
  }
  const [onScreen, other] = tab === "reviewer" ? [ofReviewer, ofStep] : [ofStep, ofReviewer];
  if (onScreen !== null || other === null) {
    return null;
  }
  const goTab: StepTab = tab === "reviewer" ? "implementer" : "reviewer";
  const kind = asSituationKind(other.kind);
  const word = SESSION_WORDS[kind];
  let label: string;
  if (kind === "session_error") {
    label = `Session error · ${TAB_NAMES[goTab]}`;
  } else if (word !== undefined) {
    label = `The ${goTab} waits · ${word}`;
  } else {
    return null;
  }
  return {
    failed: kind === "session_error",
    label,
    goLabel: `Go to ${goTab}`,
    goTab,
    status: label,
    situationId: other.id,
    time: { short: compactWait(other.startedAt, now), long: spokenWait(other.startedAt, now) },
  };
}
