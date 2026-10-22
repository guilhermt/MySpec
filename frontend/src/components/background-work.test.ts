import { describe, expect, it } from "vitest";
import {
  backgroundOf,
  conversationName,
  countOf,
  endedBy,
  hasSubagent,
  runningLine,
  summaryOfRunning,
} from "@/components/background-work";
import { makeDiscussion, makeReviewSummary, makeRunningTask, makeTask } from "@/test/wails-mock";

const agent = makeRunningTask({ taskId: "a", kind: "agent" });
const command = makeRunningTask({ taskId: "c", kind: "command", name: "Run the dev server" });
const monitor = makeRunningTask({ taskId: "m", kind: "monitor", name: "Watch the logs" });
const foreground = makeRunningTask({ taskId: "f", background: false });

const running = [
  { stage: "step:1", tasks: [agent, foreground, command] },
  { stage: "step_review:1", tasks: [monitor] },
];

describe("backgroundOf", () => {
  it("is the tasks of the stage that the turn does not wait for", () => {
    expect(backgroundOf(running, "step:1")).toEqual([agent, command]);
    expect(backgroundOf(running, "step_review:1")).toEqual([monitor]);
  });

  it("is empty for a stage without tasks and for an item without a list", () => {
    expect(backgroundOf(running, "prd")).toEqual([]);
    expect(backgroundOf(null, "prd")).toEqual([]);
  });
});

describe("countOf", () => {
  it("counts the background tasks of the stage", () => {
    expect(countOf(running, "step:1")).toBe(2);
    expect(countOf(running, "prd")).toBe(0);
    expect(countOf(null, "prd")).toBe(0);
  });
});

describe("summaryOfRunning", () => {
  it.each([
    ["one of a kind, in the singular", [command], "1 command"],
    ["several of a kind, in the plural", [agent, makeRunningTask({ taskId: "b" })], "2 agents"],
    [
      "only the kinds present, agent first",
      [monitor, command, agent],
      "1 agent · 1 command · 1 monitor",
    ],
    ["nothing", [], ""],
  ])("tells %s", (_name, tasks, expected) => {
    expect(summaryOfRunning(tasks)).toBe(expected);
  });
});

describe("endedBy", () => {
  const sessions = [
    { stage: "prd", tasks: [agent] },
    { stage: "step:1", tasks: [command] },
    { stage: "step_review:1", tasks: [monitor] },
    { stage: "step:2", tasks: [] },
    { stage: "pr", tasks: [agent] },
    { stage: "pr_review", tasks: [command] },
    { stage: "pr_fix", tasks: [monitor] },
  ];
  const item = { running: sessions };
  const stages = (ended: { stage: string }[]) => ended.map((session) => session.stage);

  it("is the conversation of the stage for a pause", () => {
    expect(stages(endedBy({ kind: "pause", stage: "step:1" }, item))).toEqual(["step:1"]);
  });

  it("is the conversations of the pull request for closing the task", () => {
    expect(stages(endedBy({ kind: "closeTask" }, item))).toEqual(["pr", "pr_review", "pr_fix"]);
  });

  it("is every conversation but the target for going back", () => {
    expect(stages(endedBy({ kind: "back", target: "prd" }, item))).toEqual([
      "step:1",
      "step_review:1",
      "pr",
      "pr_review",
      "pr_fix",
    ]);
  });

  it("is the implementer and the reviewer of the step for discarding it", () => {
    expect(stages(endedBy({ kind: "discardStep", number: 1 }, item))).toEqual([
      "step:1",
      "step_review:1",
    ]);
  });

  it("is every conversation that runs something for a restart, an archive and a deletion", () => {
    for (const kind of ["restart", "archive", "delete"] as const) {
      expect(endedBy({ kind }, item)).toHaveLength(6);
    }
  });

  it("is empty for an item without a list", () => {
    expect(endedBy({ kind: "delete" }, { running: null })).toEqual([]);
    expect(endedBy({ kind: "delete" }, {})).toEqual([]);
  });
});

describe("hasSubagent", () => {
  it("is true for a subagent, in the background or not", () => {
    expect(hasSubagent([{ stage: "prd", tasks: [command, foreground] }])).toBe(true);
    expect(hasSubagent([{ stage: "prd", tasks: [agent] }])).toBe(true);
  });

  it("is false for commands and monitors only", () => {
    expect(hasSubagent([{ stage: "prd", tasks: [command, monitor] }])).toBe(false);
    expect(hasSubagent([])).toBe(false);
  });
});

describe("conversationName", () => {
  it("names the conversations of a task as its earlier conversations are named", () => {
    const task = makeTask();
    expect(conversationName(task, "prd")).toBe("PRD");
    expect(conversationName(task, "pr_review")).toBe("PR review · Reviewer");
    expect(conversationName(task, "pr_fix")).toBe("PR review · Implementer");
  });

  it("names the conversation of a review and of a discussion", () => {
    expect(conversationName(makeReviewSummary(), "review")).toBe("Reviewer");
    expect(conversationName(makeDiscussion(), "discussion")).toBe("Discussion agent");
  });
});

describe("runningLine", () => {
  it("tells the kind, the name and how long it runs", () => {
    const now = Date.parse("2026-10-21T12:03:00Z");
    const task = makeRunningTask({ startedAt: "2026-10-21T12:00:00Z" });

    expect(runningLine(task, now)).toBe("agent · Survey the repository · 3m 0s");
  });

  it("leaves the time out when the start is unknown", () => {
    expect(runningLine(makeRunningTask({ startedAt: "" }), Date.now())).toBe(
      "agent · Survey the repository",
    );
  });
});
