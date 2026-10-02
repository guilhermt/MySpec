import type { PillView, StepperGlyph } from "@/components/system/Pill";
import type { StepperStepView } from "@/components/system/Stepper";
import { currentStepOf } from "@/features/task/step-status";
import { isPaused, waitingSession } from "@/features/task/task-session";
import { checkCounts, prChecks } from "@/lib/pull-requests";
import { situationFragment } from "@/lib/situations";
import { type LifecycleStage, lifecycleOf, stageLabel, stageState } from "@/lib/stages";
import type { PullRequest, Situation, SituationGroup, Step, TaskSummary } from "@/lib/wails";
import {
  asPRStatus,
  asReviewMode,
  asSessionStatus,
  asSituationGroup,
  asStepStatus,
  asTaskMode,
} from "@/lib/wails";
import { clockTime } from "@/lib/when";

export type { StepperGlyph };

/** StepperStep is one stage of the stepper of a task. */
export interface StepperStep extends StepperStepView {
  id: LifecycleStage;
}

/** PillModel is what the pill of the current stage says. */
export type PillModel = PillView;

/** StepperModel is the stepper of a task: the stages, the pill, the accessible name and the tooltip. */
export interface StepperModel {
  steps: StepperStep[];
  pill: PillModel;
  /** label is "Progress · Implementation 3/7 · pass 2 · waiting for you: question in Reviewer". */
  label: string;
  /** tooltip is the list of the stages, and "Paused since 14:52" on a second line. */
  tooltip: string[];
}

/** Moment is the pill of the moment of a stage, before a pause or a situation says otherwise. */
interface Moment {
  name: string;
  position: string;
  qualifier: string;
  keepsQualifier: boolean;
  glyph: StepperGlyph;
  word: string;
  shimmer: boolean;
  state: string;
}

const SITUATION_GLYPHS: Record<SituationGroup, StepperGlyph> = {
  error: "error",
  waiting: "wait",
  closing: "close",
};

const SITUATION_TONES: Record<SituationGroup, string> = {
  error: "error",
  waiting: "waiting for you",
  closing: "ready to close",
};

// The states the pull request reaches once its pass wrote the report: the pass counts the reports.
const REPORTED: readonly string[] = [
  "awaiting_decision",
  "in_review",
  "ready_to_approve",
  "committing",
  "done",
  "trouble",
];

function busy(name: string, state: string, extra: Partial<Moment> = {}): Moment {
  return {
    name,
    position: "",
    qualifier: "",
    keepsQualifier: false,
    glyph: "work",
    word: "working",
    shimmer: false,
    state,
    ...extra,
  };
}

function idle(name: string, extra: Partial<Moment> = {}): Moment {
  return busy(name, "idle", { glyph: null, word: "", ...extra });
}

// agent is the moment of a stage whose agent may be working: the spinner while its session works,
// also starting, and idle once it stopped on its own.
function agent(task: TaskSummary, name: string, extra: Partial<Moment> = {}): Moment {
  const session = waitingSession(task);
  if (session !== null && asSessionStatus(session.sessionStatus) === "working") {
    return busy(name, `${session.role} working`, extra);
  }
  return idle(name, extra);
}

function planningMoment(task: TaskSummary, id: LifecycleStage): Moment {
  return agent(task, stageLabel(id), { qualifier: task.revisiting ? "revisiting" : "" });
}

function stepQualifier(step: Step): string {
  switch (asStepStatus(step.status)) {
    case "committing":
      return "committing";
    case "not_started":
    case "preparing":
      return "preparing";
    default:
      break;
  }
  if (asReviewMode(step.reviewMode) === "manual") {
    return "Manual";
  }
  switch (asStepStatus(step.status)) {
    case "agent_review":
      return `pass ${step.reviewPass}`;
    case "addressing_review":
      return `round ${step.reviewRound}`;
    default:
      return "";
  }
}

function implementationMoment(task: TaskSummary): Moment {
  const name = stageLabel("implementation");
  const oneShot = asTaskMode(task.mode) === "one_shot";
  const total = (task.steps ?? []).length;
  const step = currentStepOf(task);
  if (step === null) {
    // No current step with a plan behind it means every step is committed.
    return total > 0
      ? busy(name, "starting the pull request", { position: oneShot ? "" : `${total}/${total}` })
      : idle(name);
  }
  const extra = {
    position: oneShot ? "" : `${step.number}/${total}`,
    qualifier: stepQualifier(step),
    keepsQualifier: oneShot,
  };
  switch (asStepStatus(step.status)) {
    case "not_started":
    case "preparing":
      return busy(name, "preparing the worktree", extra);
    case "committing":
      return busy(name, "committing", extra);
    default:
      return agent(task, name, extra);
  }
}

/**
 * reviewPassOf is the pass of the review of a pull request: its reports once it wrote its own, one
 * more while it runs. A structured pass has its row from the moment it is asked for, so the current
 * pass is the one that runs.
 */
function reviewPassOf(pr: PullRequest): string {
  const reports = (pr.reports ?? []).length;
  const status = asPRStatus(pr.status);
  if (REPORTED.includes(status)) {
    return `pass ${reports}`;
  }
  if (status === "reviewing" || (status === "awaiting_reply" && pr.prNumber > 0)) {
    return `pass ${pr.currentPass > 0 ? pr.currentPass : reports + 1}`;
  }
  return "";
}

function prMoment(task: TaskSummary): Moment {
  const name = stageLabel("pr");
  switch (task.pr === null ? "" : asPRStatus(task.pr.status)) {
    case "preparing":
      return busy(name, "checking GitHub");
    case "opening":
      return busy(name, "opening the pull request");
    default:
      return agent(task, name);
  }
}

function prReviewMoment(task: TaskSummary, pr: PullRequest): Moment {
  const name = stageLabel("pr_review");
  switch (asPRStatus(pr.status)) {
    case "waiting_checks": {
      const { passed, total } = checkCounts(prChecks(pr));
      if (pr.checkedAt !== "" && total > 0) {
        return busy(name, `waiting for the checks, ${passed} of ${total} passed`, {
          glyph: "github",
          word: `checks ${passed}/${total}`,
        });
      }
      return busy(name, "checking GitHub", {
        glyph: "github",
        word: "checking GitHub",
        shimmer: true,
      });
    }
    case "committing":
      return busy(name, "committing", { position: reviewPassOf(pr), qualifier: "committing" });
    default:
      return agent(task, name, { position: reviewPassOf(pr) });
  }
}

function closingMoment(task: TaskSummary): Moment {
  const name = stageLabel("closing");
  return task.pr !== null && asPRStatus(task.pr.status) === "closing"
    ? busy(name, "closing the task")
    : idle(name);
}

function momentOf(task: TaskSummary, id: LifecycleStage): Moment {
  switch (id) {
    case "implementation":
      return implementationMoment(task);
    case "pr":
      return prMoment(task);
    case "pr_review":
      return task.pr === null ? idle(stageLabel(id)) : prReviewMoment(task, task.pr);
    case "closing":
      return closingMoment(task);
    default:
      return planningMoment(task, id);
  }
}

// situationState is the state of a pill with a situation: the tone and what the most urgent one asks, with how many more.
function situationState(situation: Situation, count: number): string {
  const tone = SITUATION_TONES[asSituationGroup(situation.group)];
  const more = count > 1 ? `, and ${count - 1} more` : "";
  return `${tone}: ${situationFragment(situation)}${more}`;
}

function pillOf(task: TaskSummary, id: LifecycleStage, now: number): PillModel {
  const { shimmer, glyph, word, state, ...place } = momentOf(task, id);
  if (isPaused(task)) {
    const pausedAt = waitingSession(task)?.pausedAt ?? "";
    return {
      ...place,
      glyph: "paused",
      word: "paused",
      shimmer: false,
      paused: true,
      state: pausedAt === "" ? "paused" : `paused since ${clockTime(pausedAt, now)}`,
    };
  }
  const situations = task.situations ?? [];
  const [situation] = situations;
  if (situation !== undefined) {
    return {
      ...place,
      glyph: SITUATION_GLYPHS[asSituationGroup(situation.group)],
      word: "",
      shimmer: false,
      paused: false,
      state: situationState(situation, situations.length),
    };
  }
  return { ...place, glyph, word, shimmer, paused: false, state };
}

// pillText is the name of the pill with its position and qualifier: "Implementation 3/7 · pass 2".
function pillText(pill: PillModel): string {
  const position = pill.position === "" ? "" : ` ${pill.position}`;
  // A qualifier that takes the place of the position is written as one: "Implementation pass 2".
  const separator = pill.keepsQualifier && pill.position === "" ? " " : " · ";
  const qualifier = pill.qualifier === "" ? "" : `${separator}${pill.qualifier}`;
  return `${pill.name}${position}${qualifier}`;
}

const MARKS: Record<StepperStep["state"], string> = { done: "✓", current: "●", upcoming: "○" };

/** stepperOf is the stepper of a task: its stages, the pill of the current one, its name and its tooltip. */
export function stepperOf(task: TaskSummary, now: number): StepperModel {
  const steps = lifecycleOf(asTaskMode(task.mode)).map((id) => ({
    id,
    name: stageLabel(id),
    state: stageState(task, id),
  }));
  const current = steps.find((step) => step.state === "current") ?? steps[0];
  const pill = pillOf(task, current?.id ?? "prd", now);
  const list = steps
    .map((step) => `${MARKS[step.state]} ${step.state === "current" ? pillText(pill) : step.name}`)
    .join("  ");
  const pausedAt = pill.paused ? (waitingSession(task)?.pausedAt ?? "") : "";
  return {
    steps,
    pill,
    label: `Progress · ${pillText(pill)} · ${pill.state}`,
    tooltip: pausedAt === "" ? [list] : [list, `Paused since ${clockTime(pausedAt, now)}`],
  };
}

/** loadingSteps is the Structured stages with no pill, for the instant before the first snapshot. */
export function loadingSteps(): StepperStep[] {
  return lifecycleOf("structured").map((id) => ({
    id,
    name: stageLabel(id),
    state: "upcoming",
  }));
}
