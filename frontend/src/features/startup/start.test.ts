import { describe, expect, it } from "vitest";
import { failureError, failureText, stepViews } from "@/features/startup/start";
import { makeStartup, makeStartupFailure, makeStartupStep } from "@/test/wails-mock";

const STARTED = "2026-10-01T10:00:00.000Z";
const at = (ms: number) => Date.parse(STARTED) + ms;

describe("stepViews", () => {
  it.each([
    [1, "Checking the clone of 1 repository"],
    [12, "Checking the clones of 12 repositories"],
  ])("labels the clones of %i repositories", (count, label) => {
    const startup = makeStartup({
      steps: [
        makeStartupStep(),
        makeStartupStep({ id: "clones", state: "running", startedAt: STARTED, count }),
      ],
    });

    const views = stepViews(startup, at(0));

    expect(views.map((view) => [view.label, view.state])).toEqual([
      ["Opening your data", "done"],
      [label, "running"],
    ]);
  });

  it.each([
    ["2.9 s", 2900, ""],
    ["3 s", 3000, "3s"],
    ["12 s", 12_000, "12s"],
    ["1m 15s", 75_000, "1m 15s"],
  ])("says the time of a step that runs for %s as %j", (_name, ms, elapsed) => {
    const startup = makeStartup({
      steps: [makeStartupStep({ state: "running", startedAt: STARTED })],
    });

    expect(stepViews(startup, at(ms))[0]?.elapsed).toBe(elapsed);
  });

  it("says no time of a step that is done or still to do", () => {
    const startup = makeStartup({
      steps: [
        makeStartupStep({ state: "done", startedAt: STARTED }),
        makeStartupStep({ id: "clones", state: "todo", count: 2 }),
      ],
    });

    expect(stepViews(startup, at(60_000)).map((view) => view.elapsed)).toEqual(["", ""]);
  });

  it("gives the reason only to the slow step of the clones", () => {
    const detail = "/home/dev/code/infra";
    const startup = makeStartup({
      steps: [
        makeStartupStep({ state: "running", startedAt: STARTED, detail }),
        makeStartupStep({ id: "clones", state: "running", startedAt: STARTED, count: 2, detail }),
      ],
    });

    expect(stepViews(startup, at(2900)).map((view) => view.reason)).toEqual(["", ""]);
    expect(stepViews(startup, at(5000)).map((view) => view.reason)).toEqual([
      "",
      " · ~/code/infra doesn't answer",
    ]);
  });

  it("gives no reason to a slow clones step before a path is named", () => {
    const startup = makeStartup({
      steps: [makeStartupStep({ id: "clones", state: "running", startedAt: STARTED, count: 2 })],
    });

    expect(stepViews(startup, at(5000))[0]?.reason).toBe("");
  });

  it("takes an unknown step as todo", () => {
    const startup = makeStartup({ steps: [makeStartupStep({ state: "weird" })] });

    expect(stepViews(startup, at(0))[0]?.state).toBe("todo");
  });
});

describe("failureText", () => {
  it.each([
    [
      "permission",
      "MySpec can't open its data. Nothing was changed: your tasks, documents and worktrees are as they were. Give your user back the folder ~/.local/share/myspec, then try again.",
    ],
    [
      "disk_full",
      "MySpec can't open its data: the disk of ~/.local/share/myspec is full. Free some space, then try again.",
    ],
    [
      "other",
      "MySpec couldn't finish starting. If trying again fails the same way, the log at ~/.local/state/myspec/myspec.log says what happened before it.",
    ],
    [
      "unknown",
      "MySpec couldn't finish starting. If trying again fails the same way, the log at ~/.local/state/myspec/myspec.log says what happened before it.",
    ],
  ])("says the %s case", (kind, text) => {
    expect(failureText(makeStartupFailure({ case: kind }))).toBe(text);
  });
});

describe("failureError", () => {
  it("writes the home folder of the error as a tilde", () => {
    const failure = makeStartupFailure({
      error: "open /home/dev/.local/share/myspec/myspec.db: permission denied",
    });

    expect(failureError(failure)).toBe("open ~/.local/share/myspec/myspec.db: permission denied");
  });
});
