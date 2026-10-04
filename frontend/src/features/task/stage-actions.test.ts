import { describe, expect, it } from "vitest";
import type { PreviewReading } from "@/features/task/deletion";
import {
  joinList,
  lostItems,
  nextStage,
  openPR,
  stageActionConfirm,
  stageActionLoading,
  stageActionTitle,
  stageNoun,
  whatStays,
} from "@/features/task/stage-actions";
import type { TaskStage, TaskSummary } from "@/lib/wails";
import {
  makeDeletePreview,
  makePRReport,
  makePullRequest,
  makeStep,
  makeTask,
  makeTaskCard,
} from "@/test/wails-mock";

const WORKTREE = "/home/dev/.local/share/myspec/worktrees/dev/web/add-login";

function ready(files: number): PreviewReading {
  return {
    kind: "ready",
    preview: makeDeletePreview({
      worktree: { path: WORKTREE, dirty: files > 0, files, error: "" },
    }),
  };
}

const DRAFT = { title: "Limit requests", body: "", file: "draft.md" };
const report = { pass: 1, file: "1-review-1.md", clean: false, findings: 1 };

// A Structured task in the implementation: a plan of 7 files, steps 1 to 3 begun, 4 reports.
function implementing(overrides: Partial<TaskSummary> = {}): TaskSummary {
  return makeTask({
    stage: "implementation",
    branch: "add-login",
    worktreePath: WORKTREE,
    currentStep: 3,
    steps: [
      makeStep({ number: 1, status: "done", reports: [report, report] }),
      makeStep({ number: 2, status: "done", reports: [report] }),
      makeStep({ number: 3, status: "awaiting_review", reports: [report] }),
      makeStep({ number: 4 }),
      makeStep({ number: 5 }),
      makeStep({ number: 6 }),
      makeStep({ number: 7 }),
    ],
    ...overrides,
  });
}

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

  it.each([
    [[], ""],
    [["a"], "a"],
    [["a", "b"], "a and b"],
    [["a", "b", "c"], "a, b and c"],
  ])("reads %j as a list", (items, expected) => {
    expect(joinList(items)).toBe(expected);
  });

  it("loses only the stage itself when the task is still in it", () => {
    expect(lostItems(makeTask({ stage: "tech_spec" }), "discard", "tech_spec", null)).toEqual([
      "the tech spec conversation and document",
    ]);
  });

  it("loses from the stage after the target when going back", () => {
    expect(lostItems(makeTask({ stage: "plan" }), "back", "prd", null)).toEqual([
      "the tech spec conversation and document",
      "the plan conversation",
    ]);
  });

  it("counts the step files of the plan, one or many", () => {
    const plan = (count: number) =>
      makeTask({
        stage: "plan",
        steps: Array.from({ length: count }, (_, index) => makeStep({ number: index + 1 })),
      });

    expect(lostItems(plan(7), "discard", "plan", null)).toEqual([
      "the plan conversation and the 7 step files",
    ]);
    expect(lostItems(plan(1), "discard", "plan", null)).toEqual([
      "the plan conversation and the step file",
    ]);
  });

  it.each([
    [
      "the steps that began and their reports",
      3,
      "the conversations of steps 1 to 3 and their 4 review reports",
    ],
    ["a single step", 1, "the conversation of step 1 and its 2 review reports"],
  ])("lists %s", (_name, current, expected) => {
    const task = implementing({ currentStep: current });

    expect(lostItems(task, "back", "plan", ready(0))[0]).toBe(expected);
  });

  it("leaves the reports out when there are none", () => {
    const task = implementing({
      currentStep: 2,
      steps: [
        makeStep({ number: 1, status: "done" }),
        makeStep({ number: 2, status: "implementing" }),
      ],
    });

    expect(lostItems(task, "back", "plan", ready(0))[0]).toBe("the conversations of steps 1 to 2");
  });

  it("names the worktree and the branch last, with the uncommitted files read", () => {
    const task = implementing();

    expect(lostItems(task, "back", "tech_spec", ready(3)).slice(-1)).toEqual([
      "the worktree and the branch add-login, with 3 uncommitted files",
    ]);
    expect(lostItems(task, "back", "tech_spec", ready(1)).slice(-1)).toEqual([
      "the worktree and the branch add-login, with 1 uncommitted file",
    ]);
    expect(lostItems(task, "back", "tech_spec", ready(0)).slice(-1)).toEqual([
      "the worktree and the branch add-login",
    ]);
  });

  it.each([
    ["not read yet", null],
    ["being read", { kind: "reading" } as PreviewReading],
    ["unreadable", { kind: "failed", error: "git is busy" } as PreviewReading],
  ])("says any uncommitted work when the worktree is %s", (_name, reading) => {
    expect(lostItems(implementing(), "back", "tech_spec", reading).slice(-1)).toEqual([
      "the worktree and the branch add-login, with any uncommitted work in them",
    ]);
  });

  it("names no worktree for a task that has none", () => {
    const task = implementing({ worktreePath: "" });

    expect(lostItems(task, "back", "tech_spec", null).join(" ")).not.toContain("worktree");
  });

  it("joins the parts of the pull request that exist", () => {
    const pr = (overrides = {}) =>
      makeTask({
        stage: "pr",
        pr: makePullRequest({ draft: null, sessionStage: "", reports: [], ...overrides }),
        steps: [],
        currentStep: 0,
      });
    const lost = (task: TaskSummary) => lostItems(task, "back", "plan", null);

    expect(lost(pr({ draft: DRAFT, sessionStage: "pr", reports: [makePRReport()] }))).toEqual([
      "the pull request draft, the PR conversation and the reports of its review",
    ]);
    expect(lost(pr({ draft: DRAFT }))).toEqual(["the pull request draft"]);
    expect(lost(pr({ sessionStage: "pr" }))).toEqual(["the PR conversation"]);
    expect(lost(pr())).toEqual([]);
  });

  it.each([
    ["back", "prd", "Back to the PRD?", "Back to the PRD"],
    ["back", "tech_spec", "Back to the Tech spec?", "Back to the Tech spec"],
    ["discard", "prd", "Discard the PRD and start over?", "Discard the PRD"],
    ["discard", "tech_spec", "Discard the Tech spec and start over?", "Discard the Tech spec"],
    ["discard", "plan", "Discard the Plan and start over?", "Discard the Plan"],
  ] as const)("words %s of the %s of a Structured task", (action, stage, title, confirm) => {
    expect(stageActionTitle(action, "structured", stage)).toBe(title);
    expect(stageActionConfirm(action, "structured", stage)).toBe(confirm);
  });

  it.each([
    ["back", "Back to planning?", "Back to planning"],
    ["discard", "Discard the planning and start over?", "Discard the planning"],
  ] as const)("words %s of the planning of a One-Shot task", (action, title, confirm) => {
    expect(stageActionTitle(action, "one_shot", "one_shot")).toBe(title);
    expect(stageActionConfirm(action, "one_shot", "one_shot")).toBe(confirm);
  });

  it("says the gerund of what is running", () => {
    expect(stageActionLoading("back")).toBe("Going back…");
    expect(stageActionLoading("discard")).toBe("Discarding…");
  });

  it.each([
    [
      "back",
      "tech_spec",
      "The Tech spec stays, and the plan starts again from scratch when you continue.",
    ],
    [
      "back",
      "prd",
      "The PRD stays, and the tech spec starts again from scratch when you continue.",
    ],
    ["discard", "plan", "A new plan session starts right away, from the tech spec."],
    ["discard", "tech_spec", "A new tech spec session starts right away, from the PRD."],
    ["discard", "prd", "A new PRD session starts right away, from your description."],
  ] as const)("says what stays after %s of the %s", (action, stage, expected) => {
    expect(whatStays(makeTask(), action, stage)).toBe(expected);
  });

  it("starts the first session from the card when the task has one", () => {
    const task = makeTask({ card: makeTaskCard({ repository: "acme/api", number: 398 }) });

    expect(whatStays(task, "discard", "prd")).toBe(
      "A new PRD session starts right away, from the card api#398.",
    );
  });

  it("only the open pull request stays", () => {
    const pr = (prState: string) =>
      makeTask({
        pr: makePullRequest({ prNumber: 1284, prUrl: "https://github.com/o/r/pull/1284", prState }),
      });

    expect(openPR(pr("open"))).toEqual({ number: 1284, url: "https://github.com/o/r/pull/1284" });
    expect(openPR(pr("merged"))).toBeNull();
    expect(openPR(pr("closed"))).toBeNull();
    expect(openPR(makeTask())).toBeNull();
  });
});

describe("stage actions of a One-Shot task", () => {
  const oneShot = (stage: TaskStage, overrides: Partial<TaskSummary> = {}) =>
    makeTask({ mode: "one_shot", stage, ...overrides });

  it("loses only the planning while the task is still in it", () => {
    expect(lostItems(oneShot("one_shot"), "discard", "one_shot", null)).toEqual([
      "the planning conversation and the One-Shot document",
    ]);
  });

  it("goes back to the planning losing the implementation, with its reports", () => {
    const task = oneShot("implementation", {
      currentStep: 1,
      branch: "add-login",
      worktreePath: WORKTREE,
      steps: [makeStep({ number: 1, status: "implementing", reports: [report, report] })],
    });

    expect(lostItems(task, "back", "one_shot", ready(0))).toEqual([
      "the implementation conversations and their 2 review reports",
      "the worktree and the branch add-login",
    ]);
  });

  it("discards the planning with the implementation after it", () => {
    const task = oneShot("implementation", {
      currentStep: 1,
      steps: [makeStep({ number: 1, status: "implementing" })],
    });

    expect(lostItems(task, "discard", "one_shot", null)).toEqual([
      "the planning conversation and the One-Shot document",
      "the implementation conversations",
    ]);
  });

  it("says what stays", () => {
    expect(whatStays(oneShot("implementation"), "back", "one_shot")).toBe(
      "The One-Shot document and its conversation stay, and the implementation starts again from scratch when you continue.",
    );
    expect(whatStays(oneShot("one_shot"), "discard", "one_shot")).toBe(
      "A new planning session starts right away, from your description.",
    );
    expect(
      whatStays(
        oneShot("one_shot", { card: makeTaskCard({ repository: "acme/api", number: 398 }) }),
        "discard",
        "one_shot",
      ),
    ).toBe("A new planning session starts right away, from the card api#398.");
  });
});
