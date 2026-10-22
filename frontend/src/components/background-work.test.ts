import { describe, expect, it } from "vitest";
import { backgroundOf, countOf, summaryOfRunning } from "@/components/background-work";
import { makeRunningTask } from "@/test/wails-mock";

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
