import { describe, expect, it } from "vitest";
import {
  backDescription,
  discardDescription,
  joinList,
  lostItems,
  nextStage,
  stageNoun,
} from "@/features/task/stage-actions";

describe("stage actions", () => {
  it.each([
    ["prd", "PRD"],
    ["tech_spec", "tech spec"],
    ["plan", "plan"],
    ["implementation", "implementation"],
  ] as const)("names %s inside a sentence", (stage, noun) => {
    expect(stageNoun(stage)).toBe(noun);
  });

  it.each([
    ["prd", "tech_spec"],
    ["tech_spec", "plan"],
    ["plan", "implementation"],
    ["implementation", "implementation"],
  ] as const)("follows %s with %s", (stage, next) => {
    expect(nextStage(stage)).toBe(next);
  });

  it("loses only the stage itself when the task is still in it", () => {
    expect(lostItems("tech_spec", "tech_spec")).toEqual([
      "the tech spec conversation and document",
    ]);
  });

  it("loses every planning stage the task reached since", () => {
    expect(lostItems("prd", "implementation")).toEqual([
      "the PRD conversation and document",
      "the tech spec conversation and document",
      "the plan conversation and the step files",
    ]);
  });

  it("loses nothing from a stage the task has not reached", () => {
    expect(lostItems("plan", "tech_spec")).toEqual([]);
  });

  it.each([
    [[], ""],
    [["a"], "a"],
    [["a", "b"], "a and b"],
    [["a", "b", "c"], "a, b and c"],
  ])("reads %j as a list", (items, expected) => {
    expect(joinList(items)).toBe(expected);
  });

  it("says what going back to the PRD costs", () => {
    expect(backDescription("prd", "tech_spec")).toBe(
      "This deletes the tech spec conversation and document. The PRD stays, and the next stage starts again from scratch when you continue.",
    );
  });

  it("counts the plan in when the task is already implementing", () => {
    expect(backDescription("tech_spec", "implementation")).toBe(
      "This deletes the plan conversation and the step files. The Tech spec stays, and the next stage starts again from scratch when you continue.",
    );
  });

  it("says what discarding a stage costs", () => {
    expect(discardDescription("prd", "plan")).toBe(
      "This deletes the PRD conversation and document, the tech spec conversation and document and the plan conversation and the step files. A new PRD session starts right away.",
    );
  });

  it("restarts the plan alone once the task is implementing", () => {
    expect(discardDescription("plan", "implementation")).toBe(
      "This deletes the plan conversation and the step files. A new Plan session starts right away.",
    );
  });
});
