import { stageLabel } from "@/lib/stages";
import type {
  CatalogFailure,
  CatalogModel,
  ModelCatalog,
  ModelStage,
  StageModel,
  TaskMode,
} from "@/lib/wails";

/** ModelChoice is a model and an effort level, the way every picker holds them. */
export interface ModelChoice {
  model: string;
  effort: string;
}

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
  "discussion",
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

/** MODEL_IDENTIFIER is the shape of a model identifier a readable name comes from: family, version digits, an optional context suffix. */
const MODEL_IDENTIFIER = /^claude-([a-z]+)-(\d+(?:-\d+)*)(\[1m\])?$/;

/** DATE_SUFFIX_DIGITS is the length of the date a model identifier may end with. */
const DATE_SUFFIX_DIGITS = 8;

/**
 * modelLabel is the readable name of a model, derived from its identifier: the
 * family capitalized, the version digits joined with dots, a date suffix
 * dropped, and a [1m] suffix shown as (1M). "claude-opus-5-5[1m]" reads
 * "Opus 5.5 (1M)"; "claude-haiku-4-5-20251001" reads "Haiku 4.5". An
 * identifier of another shape reads as it is.
 */
export function modelLabel(model: string): string {
  const match = MODEL_IDENTIFIER.exec(model);
  if (match === null) {
    return model;
  }
  const [, family = "", version = "", wide] = match;
  const parts = version.split("-");
  if (parts.length > 1 && (parts[parts.length - 1] ?? "").length === DATE_SUFFIX_DIGITS) {
    parts.pop();
  }
  const name = `${family.charAt(0).toUpperCase()}${family.slice(1)} ${parts.join(".")}`;
  return wide === undefined ? name : `${name} (1M)`;
}

/** catalogModels are the models a catalog offers, empty for one the reading never filled. */
export function catalogModels(catalog: ModelCatalog): readonly CatalogModel[] {
  return catalog.models ?? [];
}

/** modelEfforts are the effort levels an entry of the catalog accepts, empty for a model that takes none. */
function modelEfforts(entry: CatalogModel): readonly string[] {
  return entry.efforts ?? [];
}

/** catalogModel is the entry of a model in the catalog, undefined for one it lacks. */
export function catalogModel(catalog: ModelCatalog, model: string): CatalogModel | undefined {
  return catalogModels(catalog).find((entry) => entry.name === model);
}

/**
 * takesEffort says whether a choice of this model carries an effort: false only
 * for a model the catalog knows and that lists no effort level. A model the
 * catalog lacks keeps its effort, so that nothing of a saved choice is hidden.
 */
export function takesEffort(catalog: ModelCatalog, model: string): boolean {
  const entry = catalogModel(catalog, model);
  return entry === undefined || modelEfforts(entry).length > 0;
}

/**
 * choiceUnavailable says whether the catalog lacks what a choice names: its
 * model, or its effort among the levels of its model. A model that takes no
 * effort is available whatever effort the choice holds. With an empty catalog
 * every choice is unavailable.
 */
export function choiceUnavailable(catalog: ModelCatalog, choice: ModelChoice): boolean {
  const entry = catalogModel(catalog, choice.model);
  if (entry === undefined) {
    return true;
  }
  const efforts = modelEfforts(entry);
  return efforts.length > 0 && !efforts.includes(choice.effort);
}

/** choiceLabel is a choice as the whole interface writes it: "Opus 5.5 (1M) · high", or the name alone for a model that takes no effort or a choice without one. */
export function choiceLabel(catalog: ModelCatalog, choice: ModelChoice): string {
  const name = modelLabel(choice.model);
  if (!takesEffort(catalog, choice.model) || choice.effort === "") {
    return name;
  }
  return `${name} · ${choice.effort}`;
}

/** catalogFailureMessage says why the pickers have nothing to offer; "" when they have. */
export function catalogFailureMessage(failure: CatalogFailure): string {
  switch (failure) {
    case "not_found":
      return "Claude Code was not found. Install it or point MYSPEC_CLAUDE_PATH at the executable.";
    case "unsupported":
      return "The installed Claude Code doesn't list its models. Update it and reopen the app.";
    case "failed":
      return "Reading the models of Claude Code failed. Reopen the app to try again.";
    default:
      return "";
  }
}

/** sameChoice reports whether two choices name the same model and effort. */
export function sameChoice(a: ModelChoice, b: ModelChoice): boolean {
  return a.model === b.model && a.effort === b.effort;
}

/**
 * modelStageLabel is the name of a stage: the one the stage track gives it, but
 * "Step review", which has no chip of its own, "One-Shot planning", which the
 * track of its task calls just "Planning", and "Discussion", which is no stage
 * of a task at all.
 */
export function modelStageLabel(stage: ModelStage): string {
  switch (stage) {
    case "step_review":
      return "Step review";
    case "one_shot":
      return "One-Shot planning";
    case "discussion":
      return "Discussion";
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
  catalog: ModelCatalog,
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
  const summary = `${modelStageLabel(first)}: ${choiceLabel(catalog, choiceOf(choices, first))}`;
  return others.length === 0 ? summary : `${summary} +${others.length}`;
}
