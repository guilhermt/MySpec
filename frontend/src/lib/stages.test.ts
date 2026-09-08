import { describe, expect, it } from "vitest";
import { LIFECYCLE, stageIndex, stageLabel, stageState } from "@/lib/stages";
import { makeRepoPR, makeTask } from "@/test/wails-mock";

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

  // The PR stage covers two chips, and the pull requests decide which of them
  // the task is on.
  it("stays on the PR chip while a pull request is missing", () => {
    const task = makeTask({
      stage: "pr",
      repos: [
        makeRepoPR({ status: "reviewing", prNumber: 12 }),
        makeRepoPR({ repoPath: "/home/dev/projects/api", status: "draft_ready" }),
      ],
    });

    expect(stageState(task, "implementation")).toBe("done");
    expect(stageState(task, "pr")).toBe("current");
    expect(stageState(task, "pr_review")).toBe("upcoming");
    expect(stageState(task, "closing")).toBe("upcoming");
  });

  it("moves to the PR review chip once every pull request is open", () => {
    const task = makeTask({
      stage: "pr",
      repos: [
        makeRepoPR({ status: "reviewing", prNumber: 12 }),
        makeRepoPR({ repoPath: "/home/dev/projects/api", status: "in_review", prNumber: 13 }),
      ],
    });

    expect(stageState(task, "pr")).toBe("done");
    expect(stageState(task, "pr_review")).toBe("current");
    expect(stageState(task, "closing")).toBe("upcoming");
  });

  it("lets a skipped repository through, having no pull request to open", () => {
    const task = makeTask({
      stage: "pr",
      repos: [
        makeRepoPR({ status: "done", prNumber: 12 }),
        makeRepoPR({ repoPath: "/home/dev/projects/api", status: "skipped" }),
      ],
    });

    expect(stageState(task, "pr")).toBe("done");
    expect(stageState(task, "pr_review")).toBe("current");
  });

  it("stays on the PR chip before the repositories are known", () => {
    const task = makeTask({ stage: "pr", repos: [] });

    expect(stageState(task, "pr")).toBe("current");
    expect(stageState(task, "pr_review")).toBe("upcoming");
  });
});
