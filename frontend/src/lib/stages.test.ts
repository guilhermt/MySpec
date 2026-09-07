import { describe, expect, it } from "vitest";
import { LIFECYCLE, stageIndex, stageLabel, stageState } from "@/lib/stages";
import { makeTask } from "@/test/wails-mock";

describe("LIFECYCLE", () => {
  it("runs from the PRD to the closing", () => {
    expect(LIFECYCLE.map((stage) => stage.id)).toEqual([
      "prd",
      "tech_spec",
      "plan",
      "implementation",
      "pr",
      "pr_review",
      "closing",
    ]);
  });
});

describe("stageIndex", () => {
  it("is the position in the lifecycle", () => {
    expect(stageIndex("prd")).toBe(0);
    expect(stageIndex("implementation")).toBe(3);
    expect(stageIndex("closing")).toBe(6);
  });
});

describe("stageLabel", () => {
  it("names every stage", () => {
    expect(stageLabel("prd")).toBe("PRD");
    expect(stageLabel("tech_spec")).toBe("Tech spec");
    expect(stageLabel("plan")).toBe("Plan");
    expect(stageLabel("implementation")).toBe("Implementation");
    expect(stageLabel("pr")).toBe("PR");
    expect(stageLabel("pr_review")).toBe("PR review");
    expect(stageLabel("closing")).toBe("Closing");
  });
});

describe("stageState", () => {
  it.each([
    ["prd", "prd", "current"],
    ["prd", "tech_spec", "upcoming"],
    ["plan", "prd", "done"],
    ["plan", "tech_spec", "done"],
    ["plan", "plan", "current"],
    ["implementation", "implementation", "current"],
    ["implementation", "pr", "upcoming"],
    ["implementation", "closing", "upcoming"],
  ] as const)("reads %s against %s", (stage, id, expected) => {
    expect(stageState(makeTask({ stage }), id)).toBe(expected);
  });

  it("falls back to the PRD on a stage it does not know", () => {
    expect(stageState(makeTask({ stage: "archived" }), "prd")).toBe("current");
  });
});
