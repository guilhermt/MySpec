import { describe, expect, it } from "vitest";
import { artifactGroupsOf } from "@/features/task/artifacts";
import type { TaskSummary } from "@/lib/wails";
import { makePullRequest, makeStep, makeTask } from "@/test/wails-mock";

/** shapeOf reduces the groups to what a test needs: the legend and the label of each entry. */
function shapeOf(task: TaskSummary) {
  return artifactGroupsOf(task).map((group) => ({
    legend: group.legend,
    entries: group.entries.map(
      (entry) => `${entry.label}${entry.meta === "" ? "" : ` · ${entry.meta}`}`,
    ),
  }));
}

const STEPS = [
  makeStep({ number: 1, file: "1-login-form.md", title: "Add the login form" }),
  makeStep({ number: 2, file: "2-session.md", title: "Keep the session" }),
];

const DRAFT = { title: "Add the login screen", body: "Why", file: "draft.md" };

describe("artifactGroupsOf", () => {
  it.each([
    ["a task with nothing written yet", {}, []],
    [
      "the PRD and the tech spec, once written",
      { hasPrd: true, hasTechSpec: true },
      [{ legend: "Documents", entries: ["PRD", "Tech spec"] }],
    ],
    [
      "only the document written, leaving the other out",
      { hasPrd: true },
      [{ legend: "Documents", entries: ["PRD"] }],
    ],
    [
      "the One-Shot document, in a One-Shot task",
      { mode: "one_shot", hasOneShot: true },
      [{ legend: "Documents", entries: ["One-Shot document"] }],
    ],
    [
      "no step files in a One-Shot task, even with steps",
      { mode: "one_shot", hasOneShot: true, steps: STEPS },
      [{ legend: "Documents", entries: ["One-Shot document"] }],
    ],
    [
      "the step files, in order",
      { steps: STEPS },
      [
        {
          legend: "Step files · 2",
          entries: ["1 · Add the login form", "2 · Keep the session"],
        },
      ],
    ],
    [
      "the draft of the pull request, not yet approved",
      { pr: makePullRequest({ draft: DRAFT }) },
      [{ legend: "Pull request", entries: ["Draft · Add the login screen"] }],
    ],
    [
      "the draft of the pull request, approved once it is open",
      { pr: makePullRequest({ draft: DRAFT, prNumber: 1284 }) },
      [{ legend: "Pull request", entries: ["Draft · Add the login screen · approved"] }],
    ],
    [
      "every group together, each only with what it has",
      { hasPrd: true, hasTechSpec: true, steps: STEPS, pr: makePullRequest({ draft: DRAFT }) },
      [
        { legend: "Documents", entries: ["PRD", "Tech spec"] },
        {
          legend: "Step files · 2",
          entries: ["1 · Add the login form", "2 · Keep the session"],
        },
        { legend: "Pull request", entries: ["Draft · Add the login screen"] },
      ],
    ],
  ] as const)("has %s", (_name, overrides, expected) => {
    expect(shapeOf(makeTask(overrides))).toEqual(expected);
  });
});
