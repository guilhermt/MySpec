import { describe, expect, it } from "vitest";
import {
  hasArtifacts,
  isAttention,
  taskStageLabel,
  taskStatusLabel,
  taskStatusTone,
} from "@/features/task/status";
import { makeStep, makeTask } from "@/test/wails-mock";

describe("task status", () => {
  it.each([
    ["working", "Working", "working", false],
    ["waiting", "Waiting", "attention", true],
    ["needs_permission", "Permission", "attention", true],
    ["paused", "Paused", "paused", false],
    ["error", "Error", "error", true],
  ])("reads %s", (sessionStatus, label, tone, attention) => {
    const task = makeTask({ sessionStatus });

    expect(taskStatusLabel(task)).toBe(label);
    expect(taskStatusTone(task)).toBe(tone);
    expect(isAttention(task)).toBe(attention);
  });

  it("treats a status it does not know as waiting", () => {
    const task = makeTask({ sessionStatus: "hibernating" });

    expect(taskStatusLabel(task)).toBe("Waiting");
    expect(taskStatusTone(task)).toBe("attention");
  });

  it("counts the steps once the implementation starts", () => {
    const task = makeTask({
      stage: "implementation",
      sessionStatus: "working",
      steps: [makeStep(), makeStep({ number: 2, file: "2-wire-the-api.md" })],
    });

    expect(taskStatusLabel(task)).toBe("0 of 2 steps");
    expect(taskStatusTone(task)).toBe("idle");
    expect(isAttention(task)).toBe(false);
  });

  it("counts no steps when the backend sends none", () => {
    const task = makeTask({ stage: "implementation", steps: null });

    expect(taskStatusLabel(task)).toBe("0 of 0 steps");
  });
});

describe("taskStageLabel", () => {
  it("names the stage the task is in", () => {
    expect(taskStageLabel(makeTask())).toBe("PRD");
    expect(taskStageLabel(makeTask({ stage: "tech_spec" }))).toBe("Tech spec");
    expect(taskStageLabel(makeTask({ stage: "implementation" }))).toBe("Implementation");
  });

  it("says when a stage was reopened", () => {
    expect(taskStageLabel(makeTask({ stage: "plan", revisiting: true }))).toBe("Plan · revisiting");
  });
});

describe("hasArtifacts", () => {
  it.each([
    [{}, false],
    [{ hasPrd: true }, true],
    [{ hasTechSpec: true }, true],
    [{ steps: [makeStep()] }, true],
  ])("knows whether the task wrote anything %#", (overrides, expected) => {
    expect(hasArtifacts(makeTask(overrides))).toBe(expected);
  });
});
