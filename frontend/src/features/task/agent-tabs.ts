import { countOf } from "@/components/background-work";
import type { SessionState } from "@/features/chat/session";
import { stepStage } from "@/features/task/step-status";
import type { StepperGlyph } from "@/features/task/stepper";
import { hasReviewConversation, isReviewed } from "@/lib/pull-requests";
import {
  isSessionKind,
  lowerFirst,
  prFixSituation,
  prSituation,
  reviewerSituation,
  situationLabel,
  spokenWait,
  stepSituation,
} from "@/lib/situations";
import type { PullRequest, Situation, Step, TaskSummary } from "@/lib/wails";
import {
  asReviewMode,
  asSessionStatus,
  asSituationGroup,
  asSituationKind,
  asStepStatus,
} from "@/lib/wails";
import type { StepTab } from "@/store/app-store";

export { firstTab } from "@/store/step-tab";

/** AgentTabModel is one tab of a step with two conversations. */
export interface AgentTabModel {
  /** tab is implementer or reviewer. */
  tab: StepTab;
  name: "Implementer" | "Reviewer";
  glyph: StepperGlyph | "idle";
  /** word is said only on the tab not chosen: waits, error, background, or nothing. */
  word: "" | "waits" | "error" | "background";
  /** disabled is a tab before its session: Reviewer · starts with pass 1. */
  disabled: boolean;
  /** disabledLabel is what a disabled tab says it waits for: "starts with pass 1". */
  disabledLabel: string;
  /** label is "<Name>: <state>", the accessible name and the tooltip. */
  label: string;
  /** situationId is the situation of the conversation, for the flash. */
  situationId: string | null;
}

function asks(situation: Situation): string {
  return lowerFirst(situationLabel(situation));
}

function glyphOf(session: SessionState, situation: Situation | null): StepperGlyph | "idle" {
  if (situation !== null) {
    return asSituationGroup(situation.group) === "error" ? "error" : "wait";
  }
  switch (asSessionStatus(session.sessionStatus)) {
    case "working":
      return "work";
    case "paused":
      return "paused";
    case "error":
      return "error";
    default:
      return "idle";
  }
}

function stateOf(session: SessionState, situation: Situation | null, now: number): string {
  if (situation !== null) {
    const tone = asSituationGroup(situation.group) === "error" ? "error" : "waits for you";
    return `${tone}: ${asks(situation)}, for ${spokenWait(situation.startedAt, now)}`;
  }
  switch (asSessionStatus(session.sessionStatus)) {
    case "working":
      return session.processRunning ? "working" : "starting";
    case "paused":
      return "paused";
    case "error":
      return "error";
    default:
      return "idle";
  }
}

function tabOf(
  tab: StepTab,
  session: SessionState,
  situation: Situation | null,
  chosen: StepTab,
  now: number,
  background: number,
): AgentTabModel {
  const name = tab === "reviewer" ? "Reviewer" : "Implementer";
  const glyph = glyphOf(session, situation);
  const waits = situation !== null && asSituationGroup(situation.group) !== "error";
  const word =
    tab === chosen
      ? ""
      : waits
        ? "waits"
        : glyph === "error"
          ? "error"
          : situation === null && background > 0
            ? "background"
            : "";
  return {
    tab,
    name,
    glyph,
    word,
    disabled: false,
    disabledLabel: "",
    label: `${name}: ${stateOf(session, situation, now)}${background > 0 ? `, ${background} in the background` : ""}`,
    situationId: situation?.id ?? null,
  };
}

// implementerSituation is the situation of the step that the implementer's conversation holds: the
// step in review by the user, or without changes, belongs to the step and not to a conversation.
function implementerSituation(task: TaskSummary, step: Step): Situation | null {
  const situation = stepSituation(task, step.number);
  const kind = situation === null ? null : asSituationKind(situation.kind);
  return kind === "step_review" || kind === "step_empty" ? null : situation;
}

/**
 * agentTabsOf is the two tabs of a step: they exist with a reviewer, or in agent_review before its
 * session (the Reviewer tab disabled), until the commit. null when the step has no tabs.
 */
export function agentTabsOf(
  task: TaskSummary,
  step: Step,
  chosen: StepTab,
  now: number,
): AgentTabModel[] | null {
  const status = asStepStatus(step.status);
  if (status === "committing" || status === "done") {
    return null;
  }
  if (step.reviewer === null && status !== "agent_review") {
    return null;
  }
  const implementer = tabOf(
    "implementer",
    task,
    implementerSituation(task, step),
    chosen,
    now,
    countOf(task.running, stepStage(step.number)),
  );
  const reviewer =
    step.reviewer === null
      ? {
          tab: "reviewer" as const,
          name: "Reviewer" as const,
          glyph: "idle" as const,
          word: "" as const,
          disabled: true,
          disabledLabel: "starts with pass 1",
          label: "Reviewer: starts with pass 1",
          situationId: null,
        }
      : tabOf(
          "reviewer",
          step.reviewer,
          reviewerSituation(task, step.number),
          chosen,
          now,
          countOf(task.running, step.reviewer.sessionStage),
        );
  return [implementer, reviewer];
}

// implementerWaits is what the implementer tab of the pull request says before its session exists:
// past the review, the implementer that never started never will.
function implementerWaits(task: TaskSummary, pr: PullRequest): string {
  if (isReviewed(pr)) {
    return "never started";
  }
  return asReviewMode(task.prReviewMode) === "agent"
    ? "starts with round 1"
    : "starts with Apply approved";
}

/**
 * prAgentTabsOf is the two tabs of the review of the pull request: they exist once the reviewer has
 * its conversation, and stay after the review ends, when both conversations are read-only. null
 * before.
 */
export function prAgentTabsOf(
  task: TaskSummary,
  pr: PullRequest,
  chosen: StepTab,
  now: number,
): AgentTabModel[] | null {
  if (!hasReviewConversation(task)) {
    return null;
  }
  const ofPR = prSituation(task);
  const reviewer = tabOf(
    "reviewer",
    pr,
    ofPR !== null && isSessionKind(ofPR) ? ofPR : null,
    chosen,
    now,
    countOf(task.running, pr.sessionStage),
  );
  let implementer: AgentTabModel;
  if (pr.implementer !== null) {
    implementer = tabOf(
      "implementer",
      pr.implementer,
      prFixSituation(task),
      chosen,
      now,
      countOf(task.running, "pr_fix"),
    );
  } else if (pr.implementerStarted) {
    implementer = {
      tab: "implementer",
      name: "Implementer",
      glyph: "idle",
      word: "",
      disabled: false,
      disabledLabel: "",
      label: "Implementer: idle",
      situationId: null,
    };
  } else {
    const waits = implementerWaits(task, pr);
    implementer = {
      tab: "implementer",
      name: "Implementer",
      glyph: "idle",
      word: "",
      disabled: true,
      disabledLabel: waits,
      label: `Implementer: ${waits}`,
      situationId: null,
    };
  }
  return [implementer, reviewer];
}
