import { describe, expect, it } from "vitest";
import {
  backDescription,
  discardDescription,
  joinList,
  lostItems,
  nextStage,
  stageActionTitle,
  stageNoun,
} from "@/features/task/stage-actions";

describe("stage actions", () => {
  it.each([
    ["prd", "PRD"],
    ["tech_spec", "tech spec"],
    ["plan", "plan"],
    ["one_shot", "planning"],
    ["implementation", "implementation"],
  ] as const)("names %s inside a sentence", (stage, noun) => {
    expect(stageNoun(stage)).toBe(noun);
  });

  it.each([
    ["prd", "tech_spec"],
    ["tech_spec", "plan"],
    ["plan", "implementation"],
    ["one_shot", "implementation"],
    ["implementation", "implementation"],
  ] as const)("follows %s with %s", (stage, next) => {
    expect(nextStage(stage)).toBe(next);
  });

  it("loses only the stage itself when the task is still in it", () => {
    expect(lostItems("structured", "tech_spec", "tech_spec")).toEqual([
      "the tech spec conversation and document",
    ]);
  });

  it("loses every stage the task reached since, worktrees included", () => {
    expect(lostItems("structured", "prd", "implementation")).toEqual([
      "the PRD conversation and document",
      "the tech spec conversation and document",
      "the plan conversation and the step files",
      "the step conversations, worktrees and branches, with any uncommitted work in them",
    ]);
  });

  it("loses nothing from a stage the task has not reached", () => {
    expect(lostItems("structured", "plan", "tech_spec")).toEqual([]);
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
    expect(backDescription("structured", "prd", "tech_spec")).toBe(
      "This deletes the tech spec conversation and document. The PRD stays, and the next stage starts again from scratch when you continue.",
    );
  });

  it("counts the plan and the worktrees in when the task is already implementing", () => {
    expect(backDescription("structured", "tech_spec", "implementation")).toBe(
      "This deletes the plan conversation and the step files and the step conversations, worktrees and branches, with any uncommitted work in them. The Tech spec stays, and the next stage starts again from scratch when you continue.",
    );
  });

  it("says what discarding a stage costs", () => {
    expect(discardDescription("structured", "prd", "plan")).toBe(
      "This deletes the PRD conversation and document, the tech spec conversation and document and the plan conversation and the step files. A new PRD session starts right away.",
    );
  });

  it("takes the worktrees with the plan once the task is implementing", () => {
    expect(discardDescription("structured", "plan", "implementation")).toBe(
      "This deletes the plan conversation and the step files and the step conversations, worktrees and branches, with any uncommitted work in them. A new Plan session starts right away.",
    );
  });

  it.each([
    ["back", "prd", "Back to the PRD?"],
    ["back", "tech_spec", "Back to the Tech spec?"],
    ["discard", "plan", "Discard the Plan and start over?"],
  ] as const)("asks to %s the %s of a Structured task", (action, stage, expected) => {
    expect(stageActionTitle(action, stage)).toBe(expected);
  });
});

describe("stage actions of a One-Shot task", () => {
  it("loses only the planning while the task is still in it", () => {
    expect(lostItems("one_shot", "one_shot", "one_shot")).toEqual([
      "the planning conversation and the One-Shot document",
    ]);
  });

  it.each(["implementation", "pr"] as const)(
    "loses the planning and the implementation from the %s",
    (current) => {
      expect(lostItems("one_shot", "one_shot", current)).toEqual([
        "the planning conversation and the One-Shot document",
        "the implementation conversations and review reports, and its worktree and branch, with any uncommitted work in them",
      ]);
    },
  );

  it.each(["implementation", "pr"] as const)(
    "says what going back to the planning costs from the %s",
    (current) => {
      expect(backDescription("one_shot", "one_shot", current)).toBe(
        "This deletes the implementation conversations and review reports, and its worktree and branch, with any uncommitted work in them. The One-Shot document and its conversation stay, and the implementation starts again from scratch when you continue.",
      );
    },
  );

  it("says what discarding the planning costs while the task plans", () => {
    expect(discardDescription("one_shot", "one_shot", "one_shot")).toBe(
      "This deletes the planning conversation and the One-Shot document. A new planning session starts right away.",
    );
  });

  it("takes the implementation with the planning once the task got past it", () => {
    expect(discardDescription("one_shot", "one_shot", "pr")).toBe(
      "This deletes the planning conversation and the One-Shot document and the implementation conversations and review reports, and its worktree and branch, with any uncommitted work in them. A new planning session starts right away.",
    );
  });

  it.each([
    ["back", "Back to planning?"],
    ["discard", "Discard the planning and start over?"],
  ] as const)("asks to %s the planning", (action, expected) => {
    expect(stageActionTitle(action, "one_shot")).toBe(expected);
  });
});
