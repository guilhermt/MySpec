import { stageLabel } from "@/lib/stages";
import type { ModelStage, StageModel, TaskMode } from "@/lib/wails";

/** ModelChoice is a model and an effort level, the way every picker holds them. */
export interface ModelChoice {
  model: string;
  effort: string;
}

/** MODELS are the models the app offers, in the order the pickers list them. */
export const MODELS: readonly { id: string; label: string }[] = [
  { id: "claude-fable-5-1", label: "Fable 5.1" },
  { id: "claude-opus-5", label: "Opus 5" },
  { id: "claude-sonnet-5", label: "Sonnet 5" },
];

/** EFFORTS are the effort levels, from the least. */
export const EFFORTS: readonly string[] = ["low", "medium", "high", "xhigh", "max"];

/** MODEL_STAGES are every stage that carries a choice, in the order the settings list them. */
export const MODEL_STAGES: readonly ModelStage[] = [
  "prd",
  "tech_spec",
  "plan",
  "one_shot",
  "implementation",
  "step_review",
  "pr",
  "pr_review",
];

const STRUCTURED_MODEL_STAGES: readonly ModelStage[] = [
  "prd",
  "tech_spec",
  "plan",
  "implementation",
  "step_review",
  "pr",
  "pr_review",
];

const ONE_SHOT_MODEL_STAGES: readonly ModelStage[] = [
  "one_shot",
  "implementation",
  "step_review",
  "pr",
  "pr_review",
];

/** modelStagesOf is the stages of a task of a mode that carry a choice, in order. It mirrors task.Mode.ModelStages. */
export function modelStagesOf(mode: TaskMode): readonly ModelStage[] {
  return mode === "one_shot" ? ONE_SHOT_MODEL_STAGES : STRUCTURED_MODEL_STAGES;
}

/** modelLabel is the name of a model; one the app does not know reads as its id. */
export function modelLabel(model: string): string {
  return MODELS.find((entry) => entry.id === model)?.label ?? model;
}

/** choiceLabel is a choice as the whole interface writes it: "Opus 5 · high". */
export function choiceLabel(choice: ModelChoice): string {
  return `${modelLabel(choice.model)} · ${choice.effort}`;
}

/** sameChoice reports whether two choices name the same model and effort. */
export function sameChoice(a: ModelChoice, b: ModelChoice): boolean {
  return a.model === b.model && a.effort === b.effort;
}

/**
 * modelStageLabel is the name of a stage: the one the stage track gives it, but
 * "Step review", which has no chip of its own, and "One-Shot planning", which
 * the track of its task calls just "Planning".
 */
export function modelStageLabel(stage: ModelStage): string {
  switch (stage) {
    case "step_review":
      return "Step review";
    case "one_shot":
      return "One-Shot planning";
    default:
      return stageLabel(stage);
  }
}

/** choiceOf is the choice of a stage in a list of them; a stage the list lacks reads as empty. */
export function choiceOf(list: readonly StageModel[], stage: ModelStage): ModelChoice {
  const entry = list.find((line) => line.stage === stage);
  return { model: entry?.model ?? "", effort: entry?.effort ?? "" };
}

/** withChoice is a copy of a list of stage choices with one stage changed. */
export function withChoice(
  list: readonly StageModel[],
  stage: ModelStage,
  choice: ModelChoice,
): StageModel[] {
  return list.map((line) => (line.stage === stage ? { ...line, ...choice } : { ...line }));
}

/**
 * adjustmentSummary is what the folded Models row of the creation dialog says:
 * "Defaults" with nothing adjusted, or the first adjusted stage with its choice
 * and "+N" for the others, as in "PRD: Fable 5.1 · xhigh +1". Only the stages
 * it is given count.
 */
export function adjustmentSummary(
  choices: readonly StageModel[],
  defaults: readonly StageModel[],
  stages: readonly ModelStage[],
): string {
  const adjusted = stages.filter(
    (stage) => !sameChoice(choiceOf(choices, stage), choiceOf(defaults, stage)),
  );
  const [first, ...others] = adjusted;
  if (first === undefined) {
    return "Defaults";
  }
  const summary = `${modelStageLabel(first)}: ${choiceLabel(choiceOf(choices, first))}`;
  return others.length === 0 ? summary : `${summary} +${others.length}`;
}
