import { describe, expect, it } from "vitest";
import {
  adjustmentSummary,
  catalogFailureMessage,
  choiceLabel,
  choiceUnavailable,
  MODEL_STAGES,
  modelLabel,
  modelStageLabel,
  modelStagesOf,
  takesEffort,
  withChoice,
} from "@/lib/models";
import { makeCatalogModel, makeModelCatalog, makeModelDefaults } from "@/test/wails-mock";

const CATALOG = makeModelCatalog();
const EMPTY_CATALOG = makeModelCatalog({ models: [] });

describe("modelStagesOf", () => {
  it("lists the stages of a Structured task", () => {
    expect(modelStagesOf("structured")).toEqual([
      "prd",
      "tech_spec",
      "plan",
      "implementation",
      "step_review",
      "pr",
      "pr_review",
    ]);
  });

  it("lists the stages of a One-Shot task", () => {
    expect(modelStagesOf("one_shot")).toEqual([
      "one_shot",
      "implementation",
      "step_review",
      "pr",
      "pr_review",
    ]);
  });

  it("leaves every stage of the settings to one mode or both, but the discussion", () => {
    const stages = new Set([...modelStagesOf("structured"), ...modelStagesOf("one_shot")]);

    expect(MODEL_STAGES.filter((stage) => !stages.has(stage))).toEqual(["discussion"]);
    expect(stages.size).toBe(MODEL_STAGES.length - 1);
  });
});

describe("modelLabel", () => {
  it("names a model from its family and its version digits", () => {
    expect(modelLabel("claude-opus-5-5[1m]")).toBe("Opus 5.5 (1M)");
    expect(modelLabel("claude-fable-5-1")).toBe("Fable 5.1");
    expect(modelLabel("claude-sonnet-5")).toBe("Sonnet 5");
    expect(modelLabel("claude-haiku-4-5-20251001")).toBe("Haiku 4.5");
  });

  it("drops the date of a dated identifier with a context suffix", () => {
    expect(modelLabel("claude-opus-5-5-20260101[1m]")).toBe("Opus 5.5 (1M)");
  });

  it("leaves an identifier of another shape as it is", () => {
    expect(modelLabel("gpt-5")).toBe("gpt-5");
    expect(modelLabel("claude")).toBe("claude");
    expect(modelLabel("")).toBe("");
  });
});

describe("takesEffort", () => {
  it("says a model the catalog lists no effort level for takes none", () => {
    expect(takesEffort(CATALOG, "claude-haiku-4-5-20251001")).toBe(false);
  });

  it("says a model with effort levels takes one", () => {
    expect(takesEffort(CATALOG, "claude-sonnet-5")).toBe(true);
  });

  it("keeps the effort of a model the catalog lacks", () => {
    expect(takesEffort(CATALOG, "claude-opus-5")).toBe(true);
  });
});

describe("choiceUnavailable", () => {
  it("accepts a model and an effort the catalog has", () => {
    expect(choiceUnavailable(CATALOG, { model: "claude-sonnet-5", effort: "high" })).toBe(false);
  });

  it("marks a model the catalog lacks", () => {
    expect(choiceUnavailable(CATALOG, { model: "claude-opus-5", effort: "high" })).toBe(true);
  });

  it("marks an effort the model does not list", () => {
    const catalog = makeModelCatalog({
      models: [makeCatalogModel({ name: "claude-sonnet-5", efforts: ["low", "medium"] })],
    });

    expect(choiceUnavailable(catalog, { model: "claude-sonnet-5", effort: "high" })).toBe(true);
  });

  it("accepts any effort on a model that takes none", () => {
    expect(choiceUnavailable(CATALOG, { model: "claude-haiku-4-5-20251001", effort: "high" })).toBe(
      false,
    );
  });

  it("marks every choice while there is no catalog", () => {
    expect(choiceUnavailable(EMPTY_CATALOG, { model: "claude-sonnet-5", effort: "high" })).toBe(
      true,
    );
  });
});

describe("choiceLabel", () => {
  it("names the model and the effort of a model that takes one", () => {
    expect(choiceLabel(CATALOG, { model: "claude-opus-5-5[1m]", effort: "high" })).toBe(
      "Opus 5.5 (1M) · high",
    );
  });

  it("names a model that takes no effort alone", () => {
    expect(choiceLabel(CATALOG, { model: "claude-haiku-4-5-20251001", effort: "high" })).toBe(
      "Haiku 4.5",
    );
  });

  it("keeps the effort of a model the catalog lacks", () => {
    expect(choiceLabel(CATALOG, { model: "unknown", effort: "high" })).toBe("unknown · high");
  });

  it("names a choice without an effort alone", () => {
    expect(choiceLabel(CATALOG, { model: "claude-sonnet-5", effort: "" })).toBe("Sonnet 5");
  });
});

describe("catalogFailureMessage", () => {
  it("says the CLI was not found", () => {
    expect(catalogFailureMessage("not_found")).toContain("Claude Code was not found");
  });

  it("says the CLI does not list its models", () => {
    expect(catalogFailureMessage("unsupported")).toContain("doesn't list its models");
  });

  it("says the reading failed", () => {
    expect(catalogFailureMessage("failed")).toContain("failed");
  });

  it("says nothing when there is a catalog", () => {
    expect(catalogFailureMessage("")).toBe("");
  });
});

describe("modelStageLabel", () => {
  it("names the step review, which the stage track does not have", () => {
    expect(modelStageLabel("step_review")).toBe("Step review");
  });

  it("names the One-Shot planning apart from the planning of the track", () => {
    expect(modelStageLabel("one_shot")).toBe("One-Shot planning");
  });

  it("names the discussion, which is no stage of a task", () => {
    expect(modelStageLabel("discussion")).toBe("Discussion");
  });

  it("names a stage the way the track does", () => {
    expect(modelStageLabel("tech_spec")).toBe("Tech spec");
    expect(modelStageLabel("pr_review")).toBe("PR review");
  });
});

describe("adjustmentSummary", () => {
  it("says the defaults when nothing was adjusted", () => {
    const defaults = makeModelDefaults();

    expect(adjustmentSummary(CATALOG, makeModelDefaults(), defaults, MODEL_STAGES)).toBe(
      "Defaults",
    );
  });

  it("names the adjusted stage and its choice", () => {
    const defaults = makeModelDefaults();
    const choices = withChoice(defaults, "prd", { model: "claude-fable-5-1", effort: "xhigh" });

    expect(adjustmentSummary(CATALOG, choices, defaults, MODEL_STAGES)).toBe(
      "PRD: Fable 5.1 · xhigh · the rest from Defaults",
    );
  });

  it("leaves the rest out when every stage was adjusted", () => {
    const defaults = makeModelDefaults();
    const choices = withChoice(defaults, "one_shot", {
      model: "claude-fable-5-1",
      effort: "xhigh",
    });

    expect(adjustmentSummary(CATALOG, choices, defaults, ["one_shot"])).toBe(
      "One-Shot planning: Fable 5.1 · xhigh",
    );
  });

  it("counts only the stages it is given", () => {
    const defaults = makeModelDefaults();
    const choices = withChoice(
      withChoice(defaults, "prd", { model: "claude-fable-5-1", effort: "xhigh" }),
      "pr",
      { model: "claude-sonnet-5", effort: "medium" },
    );

    expect(adjustmentSummary(CATALOG, choices, defaults, modelStagesOf("one_shot"))).toBe(
      "PR: Sonnet 5 · medium · the rest from Defaults",
    );
    expect(adjustmentSummary(CATALOG, choices, defaults, ["one_shot", "implementation"])).toBe(
      "Defaults",
    );
  });

  it("counts the other adjusted stages after the first", () => {
    const defaults = makeModelDefaults();
    const choices = withChoice(
      withChoice(defaults, "prd", { model: "claude-fable-5-1", effort: "xhigh" }),
      "pr",
      { model: "claude-sonnet-5", effort: "medium" },
    );

    expect(adjustmentSummary(CATALOG, choices, defaults, MODEL_STAGES)).toBe(
      "PRD: Fable 5.1 · xhigh +1 · the rest from Defaults",
    );
  });
});

describe("withChoice", () => {
  it("leaves the list it was given alone", () => {
    const defaults = makeModelDefaults();

    const choices = withChoice(defaults, "prd", { model: "claude-sonnet-5", effort: "max" });

    expect(choices[0]).toEqual({ stage: "prd", model: "claude-sonnet-5", effort: "max" });
    expect(defaults[0]).toEqual({ stage: "prd", model: "claude-fable-5-1", effort: "high" });
  });
});
