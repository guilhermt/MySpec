import { describe, expect, it } from "vitest";
import {
  adjustmentSummary,
  choiceLabel,
  MODEL_STAGES,
  modelStageLabel,
  modelStagesOf,
  withChoice,
} from "@/lib/models";
import { makeModelDefaults } from "@/test/wails-mock";

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

  it("leaves every stage of the settings to one mode or both", () => {
    const stages = new Set([...modelStagesOf("structured"), ...modelStagesOf("one_shot")]);

    expect(MODEL_STAGES.filter((stage) => !stages.has(stage))).toEqual([]);
    expect(stages.size).toBe(MODEL_STAGES.length);
  });
});

describe("choiceLabel", () => {
  it("names the model and the effort of a known model", () => {
    expect(choiceLabel({ model: "claude-opus-5", effort: "high" })).toBe("Opus 5 · high");
  });

  it("falls back to the id of a model the app does not know", () => {
    expect(choiceLabel({ model: "claude-haiku-4-5", effort: "low" })).toBe(
      "claude-haiku-4-5 · low",
    );
  });
});

describe("modelStageLabel", () => {
  it("names the step review, which the stage track does not have", () => {
    expect(modelStageLabel("step_review")).toBe("Step review");
  });

  it("names the One-Shot planning apart from the planning of the track", () => {
    expect(modelStageLabel("one_shot")).toBe("One-Shot planning");
  });

  it("names a stage the way the track does", () => {
    expect(modelStageLabel("tech_spec")).toBe("Tech spec");
    expect(modelStageLabel("pr_review")).toBe("PR review");
  });
});

describe("adjustmentSummary", () => {
  it("says the defaults when nothing was adjusted", () => {
    const defaults = makeModelDefaults();

    expect(adjustmentSummary(makeModelDefaults(), defaults, MODEL_STAGES)).toBe("Defaults");
  });

  it("names the adjusted stage and its choice", () => {
    const defaults = makeModelDefaults();
    const choices = withChoice(defaults, "prd", { model: "claude-fable-5-1", effort: "xhigh" });

    expect(adjustmentSummary(choices, defaults, MODEL_STAGES)).toBe("PRD: Fable 5.1 · xhigh");
  });

  it("counts only the stages it is given", () => {
    const defaults = makeModelDefaults();
    const choices = withChoice(
      withChoice(defaults, "prd", { model: "claude-fable-5-1", effort: "xhigh" }),
      "pr",
      { model: "claude-sonnet-5", effort: "medium" },
    );

    expect(adjustmentSummary(choices, defaults, modelStagesOf("one_shot"))).toBe(
      "PR: Sonnet 5 · medium",
    );
    expect(adjustmentSummary(choices, defaults, ["one_shot", "implementation"])).toBe("Defaults");
  });

  it("counts the other adjusted stages after the first", () => {
    const defaults = makeModelDefaults();
    const choices = withChoice(
      withChoice(defaults, "prd", { model: "claude-fable-5-1", effort: "xhigh" }),
      "pr",
      { model: "claude-sonnet-5", effort: "medium" },
    );

    expect(adjustmentSummary(choices, defaults, MODEL_STAGES)).toBe("PRD: Fable 5.1 · xhigh +1");
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
