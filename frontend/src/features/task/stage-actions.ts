import { stageIndex, stageLabel } from "@/lib/stages";
import type { TaskMode, TaskStage } from "@/lib/wails";

/**
 * MAX_CORRECTIONS is how many times the app corrects an invalid plan before it
 * hands the plan back to the user. It mirrors flow.MaxCorrections.
 */
export const MAX_CORRECTIONS = 3;

/** StageAction is what the stage track can do to a stage. */
export type StageAction = "back" | "discard";

// What a task loses when a planning stage is thrown away, in stage order, for
// each mode.
const LOSSES: Record<TaskMode, readonly string[]> = {
  structured: [
    "the PRD conversation and document",
    "the tech spec conversation and document",
    "the plan conversation and the step files",
    "the step conversations, worktrees and branches, with any uncommitted work in them",
  ],
  one_shot: [
    "the planning conversation and the One-Shot document",
    "the implementation conversations and review reports, and its worktree and branch, with any uncommitted work in them",
  ],
};

// How a stage reads in the middle of a sentence, where the label of the track
// would carry a capital it should not.
const NOUNS: Record<TaskStage, string> = {
  prd: "PRD",
  tech_spec: "tech spec",
  plan: "plan",
  one_shot: "planning",
  implementation: "implementation",
  pr: "PR",
};

/** stageNoun names a stage inside a sentence. */
export function stageNoun(stage: TaskStage): string {
  return NOUNS[stage];
}

/** nextStage is the stage the task moves on to once this one is done. */
export function nextStage(stage: TaskStage): TaskStage {
  switch (stage) {
    case "prd":
      return "tech_spec";
    case "tech_spec":
      return "plan";
    default:
      return "implementation";
  }
}

/**
 * lostItems lists what going back to, or discarding, a stage takes with it: the
 * stage itself and every planning stage the task has reached since.
 */
export function lostItems(mode: TaskMode, from: TaskStage, current: TaskStage): string[] {
  const losses = LOSSES[mode];
  const last = Math.min(stageIndex(mode, current), losses.length - 1);
  return losses.slice(stageIndex(mode, from), last + 1);
}

/** joinList reads a list out loud: "a", "a and b", "a, b and c". */
export function joinList(items: readonly string[]): string {
  if (items.length < 2) {
    return items[0] ?? "";
  }
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

/** backDescription says what reopening a stage costs. */
export function backDescription(mode: TaskMode, target: TaskStage, current: TaskStage): string {
  const lost = joinList(lostItems(mode, nextStage(target), current));
  if (mode === "one_shot") {
    return `This deletes ${lost}. The One-Shot document and its conversation stay, and the implementation starts again from scratch when you continue.`;
  }
  return `This deletes ${lost}. The ${stageLabel(target)} stays, and the next stage starts again from scratch when you continue.`;
}

/** discardDescription says what starting a stage over costs. */
export function discardDescription(mode: TaskMode, stage: TaskStage, current: TaskStage): string {
  const lost = joinList(lostItems(mode, stage, current));
  if (mode === "one_shot") {
    return `This deletes ${lost}. A new planning session starts right away.`;
  }
  return `This deletes ${lost}. A new ${stageLabel(stage)} session starts right away.`;
}

/** stageActionTitle is the question that confirms an action on a stage. */
export function stageActionTitle(action: StageAction, stage: TaskStage): string {
  if (stage === "one_shot") {
    return action === "back" ? "Back to planning?" : "Discard the planning and start over?";
  }
  return action === "back"
    ? `Back to the ${stageLabel(stage)}?`
    : `Discard the ${stageLabel(stage)} and start over?`;
}
