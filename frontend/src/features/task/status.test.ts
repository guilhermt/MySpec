import { describe, expect, it } from "vitest";
import { isAttention, taskStatusLabel, taskStatusTone } from "@/features/task/status";
import { makeTask } from "@/test/wails-mock";

describe("task status", () => {
  it.each([
    ["working", "prd", "Working", "working", false],
    ["waiting", "prd", "Waiting", "attention", true],
    ["waiting", "prd_done", "PRD done", "done", false],
    ["needs_permission", "prd", "Permission", "attention", true],
    ["paused", "prd", "Paused", "paused", false],
    ["error", "prd", "Error", "error", true],
  ])("reads %s at stage %s", (sessionStatus, stage, label, tone, attention) => {
    const task = makeTask({ sessionStatus, stage });

    expect(taskStatusLabel(task)).toBe(label);
    expect(taskStatusTone(task)).toBe(tone);
    expect(isAttention(task)).toBe(attention);
  });

  it("treats a status it does not know as waiting", () => {
    const task = makeTask({ sessionStatus: "hibernating" });

    expect(taskStatusLabel(task)).toBe("Waiting");
    expect(taskStatusTone(task)).toBe("attention");
  });
});
