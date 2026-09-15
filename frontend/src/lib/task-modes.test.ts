import { describe, expect, it } from "vitest";
import { isOneShot, TASK_MODES, taskModeHint, taskModeLabel } from "@/lib/task-modes";
import type { TaskMode } from "@/lib/wails";

describe("TASK_MODES", () => {
  it("offers Structured first", () => {
    expect(TASK_MODES).toEqual(["structured", "one_shot"]);
  });
});

describe("taskModeLabel", () => {
  it.each([
    ["structured", "Structured"],
    ["one_shot", "One-Shot"],
  ] as const)("names the %s mode", (mode: TaskMode, expected) => {
    expect(taskModeLabel(mode)).toBe(expected);
  });
});

describe("taskModeHint", () => {
  it.each([
    ["structured", "A PRD, a tech spec and a plan of steps, each step its own commit."],
    ["one_shot", "One planning conversation writes a single document, implemented in one commit."],
  ] as const)("says what the %s mode does to a task", (mode: TaskMode, expected) => {
    expect(taskModeHint(mode)).toBe(expected);
  });
});

describe("isOneShot", () => {
  it.each([
    ["one_shot", true],
    ["structured", false],
    ["", false],
    ["unknown", false],
  ])("reads a task of mode %j", (mode, expected) => {
    expect(isOneShot({ mode })).toBe(expected);
  });
});
