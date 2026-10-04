import { describe, expect, it } from "vitest";
import {
  deletionLines,
  discardStepTexts,
  interruptedSentence,
  interruptedSessions,
  type PreviewReading,
} from "@/features/task/deletion";
import { makeDeletePreview, makePullRequest, makeStep, makeTask } from "@/test/wails-mock";

const WORKTREE = {
  path: "/home/dev/.local/share/myspec/worktrees/dev/web/add-login",
  dirty: true,
  files: 3,
  error: "",
};
const BRANCH = { name: "add-login", merged: false, ahead: 9, error: "" };

function ready(overrides = {}): PreviewReading {
  return { kind: "ready", preview: makeDeletePreview(overrides) };
}

function linesOf(reading: PreviewReading, task = makeTask()) {
  const state = deletionLines(task, reading);
  return state.kind === "lines" ? state.lines : null;
}

describe("interruptedSessions", () => {
  it.each([
    ["the PRD agent", makeTask({ stage: "prd", sessionStatus: "working" }), ["PRD agent"]],
    ["a quiet session", makeTask({ stage: "prd", sessionStatus: "waiting" }), []],
    [
      "the PR agent",
      makeTask({ stage: "pr", pr: makePullRequest({ sessionStatus: "working" }) }),
      ["PR agent"],
    ],
    [
      "the implementer and the reviewer",
      makeTask({
        stage: "implementation",
        currentStep: 1,
        steps: [
          makeStep({
            number: 1,
            status: "agent_review",
            reviewer: {
              sessionStage: "step_review:1",
              sessionStatus: "working",
              turnRunning: true,
            } as never,
          }),
        ],
        sessionStatus: "working",
      }),
      ["implementer", "reviewer"],
    ],
  ])("is %s", (_name, task, roles) => {
    expect(interruptedSessions(task)).toEqual(roles);
  });
});

describe("interruptedSentence", () => {
  it("names the role", () => {
    expect(interruptedSentence("reviewer")).toBe(
      "The reviewer's answer in progress is interrupted.",
    );
  });
});

describe("deletionLines", () => {
  it("says it is reading", () => {
    expect(deletionLines(makeTask(), { kind: "reading" })).toEqual({ kind: "reading" });
  });

  it("lists nothing for a task with nothing to lose", () => {
    expect(linesOf(ready())).toEqual([]);
  });

  it("says the worktree, with its uncommitted files and its path", () => {
    const [line] = linesOf(ready({ worktree: WORKTREE })) ?? [];
    expect(line).toMatchObject({
      text: "The worktree is removed",
      tag: "3 uncommitted files",
      detail: "~/.local/share/myspec/worktrees/dev/web/add-login",
      detailMono: true,
    });
  });

  it.each([
    ["one file", { ...WORKTREE, files: 1 }, "1 uncommitted file"],
    ["a clean worktree", { ...WORKTREE, dirty: false, files: 0 }, undefined],
  ])("tags %s", (_name, worktree, tag) => {
    const [line] = linesOf(ready({ worktree })) ?? [];
    expect(line?.tag).toBe(tag);
  });

  it("says when the worktree could not be read", () => {
    const lines = linesOf(
      ready({ worktree: { ...WORKTREE, dirty: false, files: 0, error: "git status failed" } }),
    );
    expect(lines?.[1]).toEqual({
      icon: "blocked",
      text: "Couldn't read the worktree",
      detail: "git status failed. Deleting still removes it.",
    });
  });

  it.each([
    ["not merged with its commits", BRANCH, "not merged · 9 commits", undefined],
    ["not merged with one commit", { ...BRANCH, ahead: 1 }, "not merged · 1 commit", undefined],
    ["not merged with an unknown count", { ...BRANCH, ahead: -1 }, "not merged", undefined],
    ["merged", { ...BRANCH, merged: true, ahead: 0 }, undefined, undefined],
    [
      "unknown",
      { ...BRANCH, ahead: -1, error: "bad revision" },
      undefined,
      "Couldn't tell if it's merged: bad revision",
    ],
  ])("labels a branch that is %s", (_name, branch, tag, detail) => {
    const [line] = linesOf(ready({ branch })) ?? [];
    expect(line).toMatchObject({ text: "The branch", mono: "add-login", after: " is deleted" });
    expect(line?.tag).toBe(tag);
    expect(line?.detail).toBe(detail);
  });

  it("says the pull request that stays open, with its link", () => {
    const [line] =
      linesOf(
        ready({ pr: { number: 1284, url: "https://github.com/o/r/pull/1284", state: "open" } }),
      ) ?? [];
    expect(line).toMatchObject({
      text: "PR #1284 stays open on GitHub",
      detail: "Close it there if you don't need it.",
      link: { label: "Open #1284", href: "https://github.com/o/r/pull/1284" },
    });
  });

  it("says the pull request that is merged, and nothing of one that is closed", () => {
    const merged = linesOf(ready({ pr: { number: 7, url: "u", state: "merged" } }));
    expect(merged?.[0]).toMatchObject({
      text: "PR #7 is merged",
      detail: "Nothing changes on GitHub.",
    });
    expect(linesOf(ready({ pr: { number: 7, url: "u", state: "closed" } }))).toEqual([]);
  });

  it("puts the session first and the pull request last", () => {
    const task = makeTask({ stage: "prd", sessionStatus: "working" });
    const lines = linesOf(
      ready({
        worktree: WORKTREE,
        branch: BRANCH,
        pr: { number: 7, url: "u", state: "open" },
      }),
      task,
    );
    expect(lines?.map((line) => line.text)).toEqual([
      "The PRD agent's answer in progress is interrupted",
      "The worktree is removed",
      "The branch",
      "PR #7 stays open on GitHub",
    ]);
  });

  it("is one blocked line when the whole reading failed", () => {
    expect(linesOf({ kind: "failed", error: "git is busy" })).toEqual([
      {
        icon: "blocked",
        text: "Couldn't read the worktree and the branch",
        detail: "git is busy. Deleting still removes them.",
      },
    ]);
  });
});

describe("discardStepTexts", () => {
  const report = { pass: 1, file: "1-review-1.md", clean: false, findings: 1 };
  const reviewer = { sessionStage: "step_review:3" } as never;
  const task = makeTask({ stage: "implementation", currentStep: 3 });
  const oneShot = makeTask({ mode: "one_shot", stage: "implementation", currentStep: 1 });
  const texts = (
    step = makeStep({ number: 3 }),
    reading: PreviewReading = ready(),
    clean = true,
    of = task,
  ) => discardStepTexts(of, step, reading, clean);

  it.each([
    [
      "a reviewer and reports",
      { reviewer, reports: [report, report] },
      "This ends the sessions and deletes the conversations of step 3 and of its reviewer, with the 2 reports of the agent review. The step starts again from scratch right away.",
    ],
    [
      "a reviewer and one report",
      { reviewer, reports: [report] },
      "This ends the sessions and deletes the conversations of step 3 and of its reviewer, with the report of the agent review. The step starts again from scratch right away.",
    ],
    [
      "a reviewer and no report",
      { reviewer, reports: [] },
      "This ends the sessions and deletes the conversations of step 3 and of its reviewer. The step starts again from scratch right away.",
    ],
    [
      "reports of a reviewer that is gone",
      { reviewer: null, reports: [report] },
      "This ends the sessions and deletes the conversations of step 3 and of its reviewer, with the report of the agent review. The step starts again from scratch right away.",
    ],
    [
      "only the implementer",
      { reviewer: null, reports: [] },
      "This ends the session and deletes the conversation of step 3. The step starts again from scratch right away.",
    ],
  ])("tells the body of a step with %s", (_name, overrides, body) => {
    const result = texts(makeStep({ number: 3, ...overrides }));

    expect(result.title).toBe("Discard step 3 and start over?");
    expect(result.confirm).toBe("Discard step");
    expect(result.body).toBe(body);
  });

  it("says the implementation of a One-Shot task", () => {
    const result = texts(makeStep({ number: 1, reviewer }), ready(), true, oneShot);

    expect(result.title).toBe("Discard the implementation and start over?");
    expect(result.confirm).toBe("Discard the implementation");
    expect(result.body).toBe(
      "This ends the sessions and deletes the conversations of the implementation and of its reviewer. The implementation starts again from scratch right away.",
    );
  });

  it.each([
    ["3 files, checked", 3, true, "Discards the 3 uncommitted files in the worktree."],
    [
      "3 files, unchecked",
      3,
      false,
      "The 3 uncommitted files stay, and the step starts blocked until the worktree is clean.",
    ],
    ["1 file, checked", 1, true, "Discards the uncommitted file in the worktree."],
    [
      "1 file, unchecked",
      1,
      false,
      "The uncommitted file stays, and the step starts blocked until the worktree is clean.",
    ],
    ["clean, checked", 0, true, "The worktree has no uncommitted changes."],
    ["clean, unchecked", 0, false, "The worktree has no uncommitted changes."],
  ])("describes the box with %s", (_name, files, clean, expected) => {
    const reading = ready({ worktree: { ...WORKTREE, dirty: files > 0, files } });

    expect(texts(undefined, reading, clean).checkboxDescription).toBe(expected);
  });

  it.each([
    [{ kind: "reading" } as PreviewReading],
    [{ kind: "failed", error: "git is busy" } as PreviewReading],
  ])("describes the box without a count %#", (reading) => {
    expect(texts(undefined, reading, true).checkboxDescription).toBe(
      "Discards every uncommitted change in the worktree.",
    );
    expect(texts(undefined, reading, false).checkboxDescription).toBe(
      "Uncommitted changes stay, and the step starts blocked until the worktree is clean.",
    );
  });

  it("carries the error of the count only when it failed", () => {
    expect(texts(undefined, { kind: "failed", error: "git is busy" }).readError).toBe(
      "Couldn't count the uncommitted files: git is busy",
    );
    expect(texts(undefined, { kind: "reading" }).readError).toBeNull();
    expect(texts(undefined, ready()).readError).toBeNull();
  });
});
