import { describe, expect, it } from "vitest";
import { isValidTaskName, suggestTaskName, TASK_NAME_MAX, taskNameProblem } from "@/lib/task-name";

describe("isValidTaskName", () => {
  it.each([
    ["add-login", true],
    ["login", true],
    ["v2-api-2", true],
    ["Add-Login", false],
    ["add login", false],
    ["-login", false],
    ["login-", false],
    ["add--login", false],
    ["add_login", false],
    ["", false],
    ["a".repeat(TASK_NAME_MAX), true],
    ["a".repeat(TASK_NAME_MAX + 1), false],
  ])("says %s is %s", (name, valid) => {
    expect(isValidTaskName(name)).toBe(valid);
  });
});

describe("suggestTaskName", () => {
  it.each([
    ["Minha Feature!", "minha-feature"],
    ["  Add Login  ", "add-login"],
    ["add--login", "add-login"],
    ["Refactor: the store", "refactor-the-store"],
    ["!!!", ""],
  ])("turns %s into %s", (raw, expected) => {
    expect(suggestTaskName(raw)).toBe(expected);
  });

  it("cuts a long name without leaving a trailing hyphen", () => {
    const suggestion = suggestTaskName(`${"a".repeat(TASK_NAME_MAX)} tail`);

    expect(suggestion).toBe("a".repeat(TASK_NAME_MAX));
    expect(isValidTaskName(suggestion)).toBe(true);
  });
});

describe("taskNameProblem", () => {
  const taken = ["add-login"];

  it.each([
    ["", "empty"],
    ["Add Login", "invalid"],
    ["add-login", "taken"],
  ])("reports %s as %s", (name, problem) => {
    expect(taskNameProblem(name, taken)).toBe(problem);
  });

  it("reports a name past the limit as too long", () => {
    expect(taskNameProblem("a".repeat(TASK_NAME_MAX + 1), taken)).toBe("too_long");
  });

  it("finds no problem with a fresh valid name", () => {
    expect(taskNameProblem("fix-the-tree", taken)).toBeNull();
  });
});
