import type { RequestForm } from "@/components/system/RequestBar";
import type { GlyphState } from "@/components/system/StateGlyph";
import { canCloseTask, closeHint } from "@/features/task/pr-status";
import { currentStepOf, reviewCountLabel } from "@/features/task/step-status";
import { isPaused } from "@/features/task/task-session";
import { prBaseName, troubleLabel } from "@/lib/pull-requests";
import { fallbackReason } from "@/lib/review-modes";
import {
  compactWait,
  lowerFirst,
  prSituation,
  spokenWait,
  stageSituation,
  stepSituation,
} from "@/lib/situations";
import { asLifecycleStage, stageLabel } from "@/lib/stages";
import type {
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
  asPRStatus,
  asReviewFallback,
  asSituationForm,
  asSituationGroup,
  asSituationKind,
  asStepStatus,
  asTaskMode,
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
  | "deleteTask";

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
}

/** TaskRequestModel is the request bar of the task screen. */
export interface TaskRequestModel {
  /** form is tinted, error or closing, or quiet when paused. */
  form: RequestForm;
  /** glyph is the one of the situation, or paused when paused. */
  glyph: GlyphState;
  label: string;
  place?: string;
  /** time is the wait of the situation; absent when paused. */
  time?: { short: string; long: string; tone: "wait" | "error" | "close" };
  progress?: string;
  /** status is the label and the place the situation was born with. */
  status: string;
  actions: TaskRequestButton[];
  /** situationId is null when paused. */
  situationId: string | null;
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

/** Bar is the part of the bar both sources draw the same. */
type Bar = Omit<TaskRequestModel, "glyph" | "time" | "situationId">;

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
  return {
    form: "tinted",
    label: want.form === "approve" ? `Approve step ${step.number}` : `Review step ${step.number}`,
    progress: joined(notes),
    status: `Review step ${step.number}`,
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
    { action: "reviewAgain", label: "Review again", variant: "primary", loadingLabel: "Asking…" },
  ];
  if (pr.canClose) {
    actions.push(closeTaskButton("secondary"));
  }
  return { form: "error", label, progress: joined(notes), status: label, actions };
}

function prBar(
  pr: PullRequest,
  want: Want,
  repository: Repository | null,
  editedDraft: PrDraft | null,
): Bar {
  switch (want.kind) {
    case "draft": {
      const refusal = draftRefusal(pr, effectiveDraft(pr, editedDraft));
      return {
        form: "tinted",
        label: "Draft to approve",
        status: "Draft to approve",
        actions: [
          {
            action: "approveDraft",
            label: "Approve draft",
            variant: "primary",
            loadingLabel: "Approving…",
            ...(refusal === undefined ? {} : { disabledReason: refusal }),
          },
          {
            action: "discardDraft",
            label: "Discard draft",
            variant: "secondary",
            loadingLabel: "",
          },
        ],
      };
    }
    case "changes_review": {
      const notes = [...staged(pr.review)];
      if (pr.commitFailed) {
        notes.push("the last approval didn't produce a commit");
      }
      return {
        form: "tinted",
        label: want.form === "approve" ? "Approve changes" : "Review changes",
        progress: joined(notes),
        status: "Review changes",
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

// clean drops the parts a bar doesn't have, so a bar reads the same whichever source drew it.
function clean(bar: Bar): Bar {
  const { place, progress, ...rest } = bar;
  return {
    ...rest,
    ...(place === undefined || place === "" ? {} : { place }),
    ...(progress === undefined || progress === "" ? {} : { progress }),
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

// screenSituation is the situation of the task whose bar the task screen draws, null when there is none.
function screenSituation(task: TaskSummary): Situation | null {
  const step = currentStepOf(task);
  const inStep = step === null ? null : stepSituation(task, step.number);
  if (inStep !== null && STEP_KINDS.includes(asSituationKind(inStep.kind))) {
    return inStep;
  }
  const stage = stageSituation(task);
  if (stage !== null && asSituationKind(stage.kind) === "ready_to_continue") {
    return stage;
  }
  const pr = prSituation(task);
  return pr !== null && PR_KINDS.includes(asSituationKind(pr.kind)) ? pr : null;
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

/**
 * taskRequestOf is the request bar of the task screen in task 3: the eight situations of §4.2 (not
 * paused), or what the state of the step or the PR asks for (paused); null for everything else.
 */
export function taskRequestOf(
  task: TaskSummary,
  _tab: StepTab,
  now: number,
  repository: Repository | null = null,
  editedDraft: PrDraft | null = null,
): TaskRequestModel | null {
  if (isPaused(task)) {
    return pausedRequestOf(task, repository, editedDraft);
  }
  const situation = screenSituation(task);
  if (situation === null) {
    return null;
  }
  const kind = asSituationKind(situation.kind) as RequestKind;
  const bar = barOf(task, { kind, form: formOf(situation) }, repository, editedDraft);
  if (bar === null) {
    return null;
  }
  const tone = TONES[asSituationGroup(situation.group)];
  return {
    ...clean(bar),
    glyph: tone,
    time: {
      short: compactWait(situation.startedAt, now),
      long: spokenWait(situation.startedAt, now),
      tone,
    },
    situationId: situation.id,
  };
}
