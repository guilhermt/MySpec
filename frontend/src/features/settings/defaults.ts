import {
  catalogModels,
  choiceLabel,
  choiceOf,
  choiceUnavailable,
  MODEL_STAGES,
  type ModelChoice,
  modelStageLabel,
  sameChoice,
} from "@/lib/models";
import type { CatalogFailure, ModelCatalog, ModelStage, StageModel } from "@/lib/wails";

export interface ModelGroup {
  /** title is the title of the group; null for the untitled Discussion. */
  title: string | null;
  /** label names the group for a screen reader. */
  label: string;
  stages: { stage: ModelStage; note: string }[];
}

/** MODEL_GROUPS are the four groups of Defaults: Planning, Steps, Pull request and the untitled Discussion. */
export const MODEL_GROUPS: readonly ModelGroup[] = [
  {
    title: "Planning",
    label: "Planning",
    stages: [
      { stage: "prd", note: "" },
      { stage: "tech_spec", note: "" },
      { stage: "plan", note: "" },
      { stage: "one_shot", note: "" },
    ],
  },
  {
    title: "Steps",
    label: "Steps",
    stages: [
      { stage: "implementation", note: "" },
      { stage: "step_review", note: "" },
    ],
  },
  {
    title: "Pull request",
    label: "Pull request",
    stages: [
      { stage: "pr", note: "" },
      { stage: "pr_review", note: "Also where a review of someone's pull request starts" },
    ],
  },
  {
    title: null,
    label: "Discussion",
    stages: [{ stage: "discussion", note: "Where a new discussion starts" }],
  },
];

/** changedText is "6 of 9 changed from the factory defaults", "None changed from the factory defaults". */
export function changedText(
  defaults: readonly StageModel[],
  factory: readonly StageModel[],
): string {
  const changed = MODEL_STAGES.filter(
    (stage) => !sameChoice(choiceOf(defaults, stage), choiceOf(factory, stage)),
  ).length;
  return changed === 0
    ? "None changed from the factory defaults"
    : `${changed} of ${MODEL_STAGES.length} changed from the factory defaults`;
}

// factoryClause is how the name of a chip says it stands against the factory choice.
function factoryClause(catalog: ModelCatalog, choice: ModelChoice, factory: ModelChoice): string {
  return sameChoice(choice, factory)
    ? "the factory default"
    : `changed from the factory default ${choiceLabel(catalog, factory)}`;
}

/** chipName is the whole accessible name of the chip of a stage (material §4.2 O chip). */
export function chipName(
  catalog: ModelCatalog,
  stage: ModelStage,
  choice: ModelChoice,
  factory: ModelChoice,
): string {
  const unavailable = catalogModels(catalog).length > 0 && choiceUnavailable(catalog, choice);
  const parts = [
    `${modelStageLabel(stage)}: ${choiceLabel(catalog, choice)}`,
    ...(unavailable ? ["unavailable"] : []),
    factoryClause(catalog, choice, factory),
  ];
  return parts.join(", ");
}

/** chipNote is the tooltip: "Factory default: Fable 5.1 · high" or "The factory default". */
export function chipNote(catalog: ModelCatalog, choice: ModelChoice, factory: ModelChoice): string {
  return sameChoice(choice, factory)
    ? "The factory default"
    : `Factory default: ${choiceLabel(catalog, factory)}`;
}

/** catalogNotice is the title and the text of the notice for each failure of the catalog; null when there is none. */
export function catalogNotice(failure: CatalogFailure): { title: string; text: string } | null {
  const stay = "The choices below stay as they are.";
  switch (failure) {
    case "not_found":
      return {
        title: "Claude Code was not found",
        text: `Install it or point MYSPEC_CLAUDE_PATH at the executable, then reopen MySpec. ${stay}`,
      };
    case "unsupported":
      return {
        title: "The installed Claude Code doesn't list its models",
        text: `Update it, then reopen MySpec. ${stay}`,
      };
    case "failed":
      return {
        title: "Couldn't read the models of Claude Code",
        text: `Reopen MySpec to try again. ${stay}`,
      };
    default:
      return null;
  }
}
