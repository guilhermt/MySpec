import { describe, expect, it } from "vitest";
import { MODEL_STAGES } from "@/lib/models";
import { makeModelCatalog, makeModelDefaults } from "@/test/wails-mock";
import { catalogNotice, changedText, chipName, chipNote, MODEL_GROUPS } from "./defaults";

const CATALOG = makeModelCatalog();
const FABLE = { model: "claude-fable-5-1", effort: "high" };
const OPUS = { model: "claude-opus-5-5[1m]", effort: "high" };

describe("MODEL_GROUPS", () => {
  it("holds the nine stages once each, in four groups, the last untitled", () => {
    expect(MODEL_GROUPS.map(({ title }) => title)).toEqual([
      "Planning",
      "Steps",
      "Pull request",
      null,
    ]);
    expect(MODEL_GROUPS.flatMap(({ stages }) => stages.map(({ stage }) => stage)).sort()).toEqual(
      [...MODEL_STAGES].sort(),
    );
    expect(MODEL_GROUPS[3]?.label).toBe("Discussion");
  });

  it("orders the stages of each group as the workflow runs them", () => {
    expect(MODEL_GROUPS.map(({ stages }) => stages.map(({ stage }) => stage))).toEqual([
      ["prd", "tech_spec", "plan", "one_shot"],
      ["implementation", "step_review"],
      ["pr", "pr_review"],
      ["discussion"],
    ]);
  });
});

describe("changedText", () => {
  const factory = makeModelDefaults();

  it("says none changed when the defaults are the factory ones", () => {
    expect(changedText(makeModelDefaults(), factory)).toBe(
      "None changed from the factory defaults",
    );
  });

  it("counts the stages whose model or effort differs", () => {
    const one = makeModelDefaults().map((line) =>
      line.stage === "pr" ? { ...line, effort: "low" } : line,
    );
    const many = makeModelDefaults().map((line) =>
      line.stage === "prd" || line.stage === "plan" ? { ...line, model: "claude-sonnet-5" } : line,
    );

    expect(changedText(one, factory)).toBe("1 of 9 changed from the factory defaults");
    expect(changedText(many, factory)).toBe("2 of 9 changed from the factory defaults");
  });
});

describe("chipName", () => {
  it("says a changed choice and the factory one", () => {
    expect(chipName(CATALOG, "prd", { ...OPUS, effort: "xhigh" }, FABLE)).toBe(
      "PRD: Opus 5.5 (1M) · xhigh, changed from the factory default Fable 5.1 · high",
    );
  });

  it("says the factory choice", () => {
    expect(
      chipName(CATALOG, "pr", { ...OPUS, effort: "medium" }, { ...OPUS, effort: "medium" }),
    ).toBe("PR: Opus 5.5 (1M) · medium, the factory default");
  });

  it("says unavailable between the choice and the factory", () => {
    expect(
      chipName(CATALOG, "step_review", { model: "claude-opus-4-1", effort: "high" }, OPUS),
    ).toBe(
      "Step review: Opus 4.1 · high, unavailable, changed from the factory default Opus 5.5 (1M) · high",
    );
  });

  it("doesn't call a choice unavailable while the catalog is read", () => {
    expect(chipName(makeModelCatalog({ models: [] }), "prd", FABLE, FABLE)).toBe(
      "PRD: Fable 5.1 · high, the factory default",
    );
  });
});

describe("chipNote", () => {
  it("names the factory choice for a changed one", () => {
    expect(chipNote(CATALOG, OPUS, FABLE)).toBe("Factory default: Fable 5.1 · high");
  });

  it("says a choice is the factory default", () => {
    expect(chipNote(CATALOG, FABLE, FABLE)).toBe("The factory default");
  });
});

describe("catalogNotice", () => {
  it.each([
    [
      "not_found",
      "Claude Code was not found",
      "Install it or point MYSPEC_CLAUDE_PATH at the executable, then check again in Settings › Machine. The choices below stay as they are.",
    ],
    [
      "unsupported",
      "The installed Claude Code doesn't list its models",
      "Update it, then check again in Settings › Machine. The choices below stay as they are.",
    ],
    [
      "failed",
      "Couldn't read the models of Claude Code",
      "Check again in Settings › Machine to read them again. The choices below stay as they are.",
    ],
  ] as const)("says why for %s", (failure, title, text) => {
    expect(catalogNotice(failure)).toEqual({ title, text });
  });

  it("says nothing without a failure", () => {
    expect(catalogNotice("")).toBeNull();
  });
});
