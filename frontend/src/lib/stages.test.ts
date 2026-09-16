import { describe, expect, it } from "vitest";
import { lifecycleOf, stageIndex, stageLabel, stageState } from "@/lib/stages";
import { makePullRequest, makeTask } from "@/test/wails-mock";

describe("lifecycleOf", () => {
  it("runs a Structured task from the PRD to the closing", () => {
    expect(lifecycleOf("structured")).toEqual([
      "prd",
      "tech_spec",
      "plan",
      "implementation",
      "pr",
      "pr_review",
      "closing",
    ]);
  });

  it("runs a One-Shot task from its planning to the closing", () => {
    expect(lifecycleOf("one_shot")).toEqual([
      "one_shot",
      "implementation",
      "pr",
      "pr_review",
      "closing",
    ]);
  });
});

describe("stageIndex", () => {
  it("is the position in the track of the mode", () => {
    expect(stageIndex("structured", "prd")).toBe(0);
    expect(stageIndex("structured", "implementation")).toBe(3);
    expect(stageIndex("structured", "closing")).toBe(6);
    expect(stageIndex("one_shot", "one_shot")).toBe(0);
    expect(stageIndex("one_shot", "implementation")).toBe(1);
    expect(stageIndex("one_shot", "closing")).toBe(4);
  });

  it("places nowhere a stage the mode does not have", () => {
    expect(stageIndex("structured", "one_shot")).toBe(-1);
    expect(stageIndex("one_shot", "tech_spec")).toBe(-1);
  });
});

describe("stageLabel", () => {
  it("names every stage", () => {
    expect(stageLabel("prd")).toBe("PRD");
    expect(stageLabel("tech_spec")).toBe("Tech spec");
    expect(stageLabel("plan")).toBe("Plan");
    expect(stageLabel("one_shot")).toBe("Planning");
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

  it.each([
    ["one_shot", "one_shot", "current"],
    ["one_shot", "implementation", "upcoming"],
    ["implementation", "one_shot", "done"],
    ["implementation", "implementation", "current"],
    ["implementation", "pr", "upcoming"],
    ["pr", "one_shot", "done"],
    ["pr", "implementation", "done"],
    ["pr", "pr", "current"],
  ] as const)("reads a One-Shot task in %s against %s", (stage, id, expected) => {
    expect(stageState(makeTask({ mode: "one_shot", stage, pr: null }), id)).toBe(expected);
  });

  // The PR stage covers two chips, and the pull request decides which of them
  // the task is on.
  it("stays on the PR chip while the pull request is not open", () => {
    const task = makeTask({ stage: "pr", pr: makePullRequest({ status: "draft_ready" }) });

    expect(stageState(task, "implementation")).toBe("done");
    expect(stageState(task, "pr")).toBe("current");
    expect(stageState(task, "pr_review")).toBe("upcoming");
    expect(stageState(task, "closing")).toBe("upcoming");
  });

  it("moves to the PR review chip once the pull request is open", () => {
    const task = makeTask({
      stage: "pr",
      pr: makePullRequest({ status: "in_review", prNumber: 12 }),
    });

    expect(stageState(task, "pr")).toBe("done");
    expect(stageState(task, "pr_review")).toBe("current");
    expect(stageState(task, "closing")).toBe("upcoming");
  });

  it("moves to the closing chip once the review is over", () => {
    const task = makeTask({ stage: "pr", pr: makePullRequest({ status: "done", prNumber: 12 }) });

    expect(stageState(task, "pr")).toBe("done");
    expect(stageState(task, "pr_review")).toBe("done");
    expect(stageState(task, "closing")).toBe("current");
  });

  it("stays on the PR chip before the pull request is known", () => {
    const task = makeTask({ stage: "pr", pr: null });

    expect(stageState(task, "pr")).toBe("current");
    expect(stageState(task, "pr_review")).toBe("upcoming");
  });
});
