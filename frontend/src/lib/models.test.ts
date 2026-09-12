import { describe, expect, it } from "vitest";
import { adjustmentSummary, choiceLabel, withChoice } from "@/lib/models";
import { makeModelDefaults } from "@/test/wails-mock";

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

describe("adjustmentSummary", () => {
  it("says the defaults when nothing was adjusted", () => {
    const defaults = makeModelDefaults();

    expect(adjustmentSummary(makeModelDefaults(), defaults)).toBe("Defaults");
  });

  it("names the adjusted stage and its choice", () => {
    const defaults = makeModelDefaults();
    const choices = withChoice(defaults, "prd", { model: "claude-fable-5-1", effort: "xhigh" });

    expect(adjustmentSummary(choices, defaults)).toBe("PRD: Fable 5.1 · xhigh");
  });

  it("counts the other adjusted stages after the first", () => {
    const defaults = makeModelDefaults();
    const choices = withChoice(
      withChoice(defaults, "prd", { model: "claude-fable-5-1", effort: "xhigh" }),
      "pr",
      { model: "claude-sonnet-5", effort: "medium" },
    );

    expect(adjustmentSummary(choices, defaults)).toBe("PRD: Fable 5.1 · xhigh +1");
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
