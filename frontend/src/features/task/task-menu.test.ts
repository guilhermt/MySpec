import { describe, expect, it } from "vitest";
import { menuItems, type TaskMenuGroup, taskMenuOf } from "@/features/task/task-menu";
import type { PullRequest, Step, TaskSummary } from "@/lib/wails";
import { makePullRequest, makeStep, makeTask } from "@/test/wails-mock";

const NOW = Date.parse("2026-09-27T15:00:00Z");
const WORKTREE = "/home/dev/.local/share/myspec/worktrees/dev/web/add-login";

/** outline is the menu as a list of lines: the legend, then each label with its disabled reason. */
function outline(groups: TaskMenuGroup[]): string[] {
  return groups.map(
    (group) =>
      `${group.label ?? "—"}: ${group.items
        .map((item) =>
          item.disabledReason === undefined ? item.label : `${item.label} [${item.disabledReason}]`,
        )
        .join(", ")}`,
  );
}

const TASK_TAIL = ["—: Delete task…"];
const TASK_GROUP = "Task: Review mode, Models";

function inStep(step: Partial<Step>, task: Partial<TaskSummary> = {}): TaskSummary {
  return makeTask({
    stage: "implementation",
    currentStep: 3,
    worktreePath: WORKTREE,
    steps: [makeStep({ number: 3, title: "Wire the API", reviewMode: "agent", ...step })],
    ...task,
  });
}

function inPR(pr: Partial<PullRequest>, task: Partial<TaskSummary> = {}): TaskSummary {
  return makeTask({ stage: "pr", worktreePath: WORKTREE, pr: makePullRequest(pr), ...task });
}

const open = (status: string, pr: Partial<PullRequest> = {}, task: Partial<TaskSummary> = {}) =>
  inPR({ status, prNumber: 1284, checkedAt: "2026-09-27T14:58:00Z", ...pr }, task);

const PR_OPEN = "Pull request #1284: Open PR, Refresh PR, Review again, Open in VS Code";

describe("taskMenuOf, by stage", () => {
  it.each<[string, TaskSummary, string[]]>([
    [
      "Structured, PRD",
      makeTask({ stage: "prd" }),
      ["PRD: Discard and restart the PRD…", TASK_GROUP, ...TASK_TAIL],
    ],
    [
      "Structured, tech spec",
      makeTask({ stage: "tech_spec" }),
      [
        "Tech spec: Discard and restart the tech spec…",
        `${TASK_GROUP}, Back to PRD…, Discard and restart the PRD…`,
        ...TASK_TAIL,
      ],
    ],
    [
      "Structured, tech spec revisited",
      makeTask({ stage: "tech_spec", revisiting: true }),
      [
        "Tech spec: Discard and restart the tech spec…",
        `${TASK_GROUP}, Back to PRD…, Discard and restart the PRD…`,
        ...TASK_TAIL,
      ],
    ],
    [
      "Structured, plan",
      makeTask({ stage: "plan" }),
      [
        "Plan: Discard and restart the plan…",
        `${TASK_GROUP}, Back to PRD…, Discard and restart the PRD…, Back to Tech spec…, Discard and restart the tech spec…`,
        ...TASK_TAIL,
      ],
    ],
    [
      "Structured, implementation",
      inStep({ status: "implementing" }),
      [
        "Step 3 · Wire the API: Review myself, Open in VS Code, Discard step 3…",
        `${TASK_GROUP}, Back to PRD…, Discard and restart the PRD…, Back to Tech spec…, Discard and restart the tech spec…, Discard and restart the plan…`,
        ...TASK_TAIL,
      ],
    ],
    [
      "Structured, PR",
      inPR({ status: "drafting" }),
      [
        "Pull request: Discard draft, Open in VS Code",
        `${TASK_GROUP}, Back to PRD…, Discard and restart the PRD…, Back to Tech spec…, Discard and restart the tech spec…`,
        ...TASK_TAIL,
      ],
    ],
    [
      "One-Shot, planning",
      makeTask({ mode: "one_shot", stage: "one_shot" }),
      ["Planning: Discard and restart planning…", TASK_GROUP, ...TASK_TAIL],
    ],
    [
      "One-Shot, implementation",
      inStep({ status: "agent_review" }, { mode: "one_shot", currentStep: 3 }),
      [
        "Implementation: Review myself, Open in VS Code, Discard the implementation…",
        `${TASK_GROUP}, Back to planning…, Discard and restart planning…`,
        ...TASK_TAIL,
      ],
    ],
    [
      "One-Shot, PR",
      open("reviewing", { sessionStage: "pr_review" }, { mode: "one_shot" }),
      [PR_OPEN, `${TASK_GROUP}, Back to planning…, Discard and restart planning…`, ...TASK_TAIL],
    ],
  ])("groups %s", (_, task, lines) => {
    expect(outline(taskMenuOf(task, NOW))).toEqual(lines);
  });
});

describe("taskMenuOf, the step group", () => {
  it.each<[string, TaskSummary, string]>([
    ["not started", inStep({ status: "not_started" }), "Step 3 · Wire the API: Open in VS Code"],
    [
      "preparing, before the worktree",
      inStep({ status: "preparing" }, { worktreePath: "" }),
      "Step 3 · Wire the API: Open in VS Code [the worktree doesn't exist yet]",
    ],
    ["blocked", inStep({ status: "blocked" }), "Step 3 · Wire the API: Open in VS Code"],
    [
      "under the agent review",
      inStep({ status: "agent_review" }),
      "Step 3 · Wire the API: Review myself, Open in VS Code, Discard step 3…",
    ],
    [
      "Manual, in review",
      inStep({ status: "in_review", reviewMode: "manual" }),
      "Step 3 · Wire the API: Open in VS Code, Discard step 3…",
    ],
    [
      "with nothing to commit",
      inStep({ status: "nothing_to_commit", reviewMode: "manual" }),
      "Step 3 · Wire the API: Open in VS Code, Discard step 3…",
    ],
    [
      "committing",
      inStep({ status: "committing" }),
      "Step 3 · Wire the API: Open in VS Code, Discard step 3…",
    ],
  ])("offers a step %s", (_, task, line) => {
    expect(outline(taskMenuOf(task, NOW))[0]).toBe(line);
  });

  it("has no step group with every step committed", () => {
    const task = makeTask({
      stage: "implementation",
      currentStep: 0,
      steps: [makeStep({ status: "done" })],
    });

    expect(outline(taskMenuOf(task, NOW))[0]).toMatch(/^Task: /);
  });
});

describe("taskMenuOf, the pull request group", () => {
  it.each<[string, TaskSummary, string | null]>([
    ["preparing", inPR({ status: "preparing" }), "Pull request: Open in VS Code"],
    ["drafting", inPR({ status: "drafting" }), "Pull request: Discard draft, Open in VS Code"],
    [
      "draft_ready",
      inPR({ status: "draft_ready" }),
      "Pull request: Discard draft, Open in VS Code",
    ],
    [
      "awaiting_reply before the PR",
      inPR({ status: "awaiting_reply" }),
      "Pull request: Discard draft, Open in VS Code",
    ],
    ["opening", inPR({ status: "opening" }), "Pull request: Open in VS Code"],
    ["blocked without a worktree", inPR({ status: "blocked", worktreePath: "" }), null],
    [
      "waiting_checks",
      open("waiting_checks"),
      "Pull request #1284: Open PR, Refresh PR, Review again [a pass waits for the checks], Open in VS Code",
    ],
    ["reviewing", open("reviewing"), PR_OPEN],
    ["awaiting_reply of a pass", open("awaiting_reply"), PR_OPEN],
    ["awaiting_decision", open("awaiting_decision"), PR_OPEN],
    ["in_review", open("in_review"), PR_OPEN],
    ["ready_to_approve", open("ready_to_approve"), PR_OPEN],
    [
      "committing",
      open("committing"),
      "Pull request #1284: Open PR, Refresh PR, Review again [the changes are being committed], Open in VS Code",
    ],
    ["done", open("done"), PR_OPEN],
    ["trouble", open("trouble"), PR_OPEN],
    ["merged", open("merged"), PR_OPEN],
    [
      "pr_closed",
      open("pr_closed"),
      "Pull request #1284: Open PR, Refresh PR, Review again [the pull request was closed], Open in VS Code",
    ],
    [
      "blocked",
      open("blocked"),
      "Pull request #1284: Open PR, Refresh PR, Review again [the pull request stage is blocked], Open in VS Code",
    ],
    [
      "closing",
      open("closing"),
      "Pull request #1284: Open PR, Refresh PR [the task is closing], Review again [the task is closing]",
    ],
  ])("offers a pull request %s", (_, task, line) => {
    const [first] = outline(taskMenuOf(task, NOW));

    if (line === null) {
      expect(first).toMatch(/^Task: /);
    } else {
      expect(first).toBe(line);
    }
  });
});

describe("taskMenuOf, the items", () => {
  it("opens the worktree with Ctrl+E", () => {
    const [step] = taskMenuOf(inStep({ status: "implementing" }), NOW);

    expect(step?.items.find((item) => item.id === "step.openInEditor")).toEqual({
      id: "step.openInEditor",
      label: "Open in VS Code",
      action: { kind: "openInEditor" },
      icon: "openInEditor",
      shortcut: "Ctrl+E",
    });
  });

  it.each([
    ["2026-09-27T14:58:00Z", "Read the pull request now · checked 2m ago"],
    ["", "Read the pull request now"],
  ])("tells the age of the reading on Refresh PR, read at %o", (checkedAt, tooltip) => {
    const [pr] = taskMenuOf(open("done", { checkedAt }), NOW);

    expect(pr?.items.find((item) => item.id === "pr.refresh")?.tooltip).toBe(tooltip);
  });

  it("opens the pull request on GitHub", () => {
    const [pr] = taskMenuOf(open("done"), NOW);

    expect(pr?.items[0]).toEqual({
      id: "pr.open",
      label: "Open PR",
      action: { kind: "openPR" },
      icon: "external",
    });
  });

  it.each([
    ["agent", "Agent"],
    ["manual", "Manual"],
  ])("names the %s review mode beside its popover, and the models per stage", (reviewMode, sub) => {
    const task = taskMenuOf(makeTask({ reviewMode }), NOW).find((group) => group.label === "Task");

    expect(task?.items.slice(0, 2)).toEqual([
      {
        id: "task.reviewMode",
        label: "Review mode",
        action: { kind: "reviewModePopover" },
        sub,
        opensPopover: true,
      },
      {
        id: "task.models",
        label: "Models",
        action: { kind: "modelsPopover" },
        sub: "per stage",
        opensPopover: true,
      },
    ]);
  });

  it("asks for each action on a stage by what it does and to which stage", () => {
    const task = taskMenuOf(makeTask({ stage: "plan" }), NOW).find(
      (group) => group.label === "Task",
    );

    expect(task?.items.slice(2).map((item) => [item.id, item.action])).toEqual([
      ["task.back.prd", { kind: "stage", action: "back", stage: "prd" }],
      ["task.discard.prd", { kind: "stage", action: "discard", stage: "prd" }],
      ["task.back.tech_spec", { kind: "stage", action: "back", stage: "tech_spec" }],
      ["task.discard.tech_spec", { kind: "stage", action: "discard", stage: "tech_spec" }],
    ]);
  });

  it("deletes the task last, in red", () => {
    const groups = taskMenuOf(makeTask(), NOW);

    expect(groups[groups.length - 1]).toEqual({
      label: null,
      items: [
        {
          id: "task.delete",
          label: "Delete task…",
          action: { kind: "deleteTask" },
          destructive: true,
        },
      ],
    });
  });
});

describe("menuItems", () => {
  it.each([
    ["structured", "tech_spec", "prd", ["back prd", "discard prd"]],
    ["structured", "prd", "prd", ["discard prd"]],
    ["structured", "implementation", "tech_spec", ["back tech_spec", "discard tech_spec"]],
    ["structured", "implementation", "plan", ["discard plan"]],
    ["structured", "pr", "plan", []],
    ["structured", "implementation", "implementation", []],
    ["one_shot", "one_shot", "one_shot", ["discard one_shot"]],
    ["one_shot", "pr", "one_shot", ["back one_shot", "discard one_shot"]],
  ] as const)("offers, in %s at %s, on %s: %o", (mode, current, id, items) => {
    expect(menuItems(mode, current, id).map((item) => `${item.action} ${item.stage}`)).toEqual(
      items,
    );
  });
});
