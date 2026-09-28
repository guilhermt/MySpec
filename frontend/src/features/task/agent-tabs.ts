import type { SessionState } from "@/features/chat/session";
import type { StepperGlyph } from "@/features/task/stepper";
import { reviewerSituation, situationLabel, spokenWait, stepSituation } from "@/lib/situations";
import type { Situation, Step, TaskSummary } from "@/lib/wails";
import { asSessionStatus, asSituationGroup, asStepStatus } from "@/lib/wails";
import type { StepTab } from "@/store/app-store";

export { firstTab } from "@/store/step-tab";

/** AgentTabModel is one tab of a step with two conversations. */
export interface AgentTabModel {
  /** tab is implementer or reviewer. */
  tab: StepTab;
  name: "Implementer" | "Reviewer";
  glyph: StepperGlyph | "idle";
  /** word is said only on the tab not chosen: waits, error, or nothing. */
  word: "" | "waits" | "error";
  /** disabled is the reviewer tab before its session: Reviewer · starts with pass 1. */
  disabled: boolean;
  /** label is "<Name>: <state>", the accessible name and the tooltip. */
  label: string;
  /** situationId is the situation of the conversation, for the flash. */
  situationId: string | null;
}

function asks(situation: Situation): string {
  const label = situationLabel(situation);
  return `${label.charAt(0).toLowerCase()}${label.slice(1)}`;
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
): AgentTabModel {
  const name = tab === "reviewer" ? "Reviewer" : "Implementer";
  const glyph = glyphOf(session, situation);
  const waits = situation !== null && asSituationGroup(situation.group) !== "error";
  const word = tab === chosen ? "" : waits ? "waits" : glyph === "error" ? "error" : "";
  return {
    tab,
    name,
    glyph,
    word,
    disabled: false,
    label: `${name}: ${stateOf(session, situation, now)}`,
    situationId: situation?.id ?? null,
  };
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
  const implementer = tabOf("implementer", task, stepSituation(task, step.number), chosen, now);
  const reviewer =
    step.reviewer === null
      ? {
          tab: "reviewer" as const,
          name: "Reviewer" as const,
          glyph: "idle" as const,
          word: "" as const,
          disabled: true,
          label: "Reviewer: starts with pass 1",
          situationId: null,
        }
      : tabOf("reviewer", step.reviewer, reviewerSituation(task, step.number), chosen, now);
  return [implementer, reviewer];
}
