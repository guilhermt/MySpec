import { describe, expect, it } from "vitest";
import {
  blockHint,
  blockTitle,
  currentStepDisplay,
  currentStepOf,
  hasStepSession,
  stepPhaseLabel,
  stepStatusLabel,
  stepStatusTone,
} from "@/features/task/step-status";
import type { BlockReason, Step, TaskSummary } from "@/lib/wails";
import { makeStep, makeTask } from "@/test/wails-mock";

function implementing(step: Partial<Step>, task: Partial<TaskSummary> = {}): TaskSummary {
  return makeTask({
    stage: "implementation",
    currentStep: 1,
    steps: [makeStep(step), makeStep({ number: 2, file: "2-wire-the-api.md" })],
    ...task,
  });
}

describe("currentStepOf", () => {
  it("finds the step the task points at", () => {
    expect(currentStepOf(implementing({}, { currentStep: 2 }))?.number).toBe(2);
  });

  it("has no step before the implementation starts", () => {
    expect(currentStepOf(makeTask())).toBeNull();
    expect(currentStepOf(makeTask({ stage: "implementation", steps: null }))).toBeNull();
  });
});

describe("hasStepSession", () => {
  it.each([
    ["not_started", false],
    ["preparing", false],
    ["blocked", false],
    ["implementing", true],
    ["awaiting_review", true],
  ])("knows whether %s has a conversation", (status, expected) => {
    expect(hasStepSession(makeStep({ status }))).toBe(expected);
  });

  it("has no conversation without a step", () => {
    expect(hasStepSession(null)).toBe(false);
  });
});

describe("step status", () => {
  it.each([
    ["not_started", "Not started", "idle"],
    ["preparing", "Preparing", "working"],
    ["blocked", "Blocked", "attention"],
    ["implementing", "Implementing", "working"],
    ["awaiting_review", "Awaiting review", "attention"],
  ])("reads %s", (status, label, tone) => {
    const step = makeStep({ status });

    expect(stepStatusLabel(step)).toBe(label);
    expect(stepStatusTone(step)).toBe(tone);
  });

  it("treats a status it does not know as not started", () => {
    expect(stepStatusLabel(makeStep({ status: "committing" }))).toBe("Not started");
    expect(stepStatusTone(makeStep({ status: "committing" }))).toBe("idle");
  });
});

describe("stepPhaseLabel", () => {
  it.each([
    ["fetching", "Fetching origin…"],
    ["creating", "Creating the worktree…"],
    ["checking", "Checking the worktree…"],
    ["", "Preparing…"],
  ])("names the %s phase", (phase, expected) => {
    expect(stepPhaseLabel(phase)).toBe(expected);
  });
});

describe("currentStepDisplay", () => {
  it("says so when the task has no step", () => {
    expect(currentStepDisplay(makeTask({ stage: "implementation" }))).toEqual({
      label: "No steps",
      tone: "idle",
    });
  });

  it.each([
    ["not_started", "Not started", "idle"],
    ["preparing", "Preparing", "working"],
    ["blocked", "Blocked", "attention"],
    ["awaiting_review", "Awaiting review", "attention"],
  ])("reads %s from the step alone", (status, label, tone) => {
    const task = implementing({ status }, { sessionStatus: "paused" });

    expect(currentStepDisplay(task)).toEqual({ label, tone });
  });

  it.each([
    ["working", "Implementing", "working"],
    ["waiting", "Implementing", "working"],
    ["needs_permission", "Permission", "attention"],
    ["paused", "Paused", "paused"],
    ["error", "Error", "error"],
  ])("reads an implementing step through a %s session", (sessionStatus, label, tone) => {
    const task = implementing({ status: "implementing" }, { sessionStatus });

    expect(currentStepDisplay(task)).toEqual({ label, tone });
  });
});

describe("blockTitle", () => {
  it.each([
    ["dirty_worktree", "The worktree has uncommitted changes"],
    ["fetch_failed", "Couldn't fetch origin"],
    ["no_base_branch", "No base branch"],
    ["path_exists", "The worktree folder already exists"],
    ["branch_exists", "The branch already exists"],
    ["git_failed", "Git failed"],
    ["no_repository", "The step doesn't name a repository of this task"],
  ] as const)("names %s", (reason: BlockReason, expected) => {
    expect(blockTitle(reason)).toBe(expected);
  });
});

describe("blockHint", () => {
  function blockedStep(reason: string, files = 0): Step {
    return makeStep({ status: "blocked", block: { reason, detail: "", files } });
  }

  it.each([
    ["fetch_failed", "Check the network and the credentials of origin, then try again."],
    [
      "no_base_branch",
      "Neither origin/dev nor origin/main exists. Create one of them, then try again.",
    ],
    ["path_exists", "Move or delete the folder, then try again."],
    ["git_failed", "Fix what git reports, then try again."],
    ["no_repository", "Fix the repository header of the step file, then try again."],
  ])("tells the user what to do about %s", (reason, expected) => {
    expect(blockHint(blockedStep(reason), makeTask())).toBe(expected);
  });

  it("names the branch that is in the way", () => {
    expect(blockHint(blockedStep("branch_exists"), makeTask())).toBe(
      'Delete or rename the branch "add-login", then try again.',
    );
  });

  it.each([
    [1, "1 changed file in the worktree."],
    [3, "3 changed files in the worktree."],
  ])("counts the %d changed files of a dirty worktree", (files, start) => {
    expect(blockHint(blockedStep("dirty_worktree", files), makeTask())).toBe(
      `${start} Clean it yourself and try again, or let the app discard every change and start the step.`,
    );
  });

  it("falls back on a reason it does not know", () => {
    expect(blockHint(blockedStep("rebase_in_progress"), makeTask())).toBe(
      "Fix what git reports, then try again.",
    );
  });
});
