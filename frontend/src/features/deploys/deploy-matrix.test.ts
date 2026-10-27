import { describe, expect, it } from "vitest";
import {
  boardColumns,
  cellModel,
  changes,
  gridSlots,
  moveFocus,
  passageModel,
} from "@/features/deploys/deploy-matrix";
import type { DeployEnvironment, DeployRepository, DeployRun } from "@/lib/wails";
import {
  makeDeployBoard,
  makeDeployEnvironment,
  makeDeployRepository,
  makeDeploys,
} from "@/test/wails-mock";

const NOW = Date.parse("2026-09-16T12:00:00Z");
const ago = (ms: number) => new Date(NOW - ms).toISOString();
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

function run(overrides: Partial<DeployRun> = {}): DeployRun {
  return {
    id: 1,
    status: "succeeded",
    conclusion: "success",
    url: "https://github.com/dev/api/actions/runs/1",
    startedAt: ago(3 * HOUR),
    endedAt: ago(2 * HOUR),
    ...overrides,
  };
}

const repo = (overrides: Partial<DeployRepository> = {}) =>
  makeDeployRepository({ id: "api", name: "api", fullName: "dev/api", ...overrides });

const staging = (overrides: Partial<DeployEnvironment> = {}) =>
  makeDeployEnvironment({
    position: 1,
    name: "Staging",
    branch: "staging",
    previousName: "Development",
    previousBranch: "dev",
    ...overrides,
  });

const promotion = (overrides: Partial<NonNullable<DeployEnvironment["promotion"]>> = {}) => ({
  commits: 3,
  partial: false,
  ahead: 3,
  pendingSince: ago(2 * DAY),
  pullRequests: [],
  deployPr: null,
  otherDeployPrs: 0,
  ...overrides,
});

const deployPr = (overrides = {}) => ({
  number: 88,
  title: "Deploy to Staging",
  url: "https://github.com/dev/api/pull/88",
  draft: false,
  createdAt: ago(HOUR),
  ...overrides,
});

describe("cellModel", () => {
  const cell = (env: DeployEnvironment, r = repo()) => cellModel(r, env, NOW);

  it("is Deployed, quiet, with the age of the last run", () => {
    expect(cell(staging({ state: "up_to_date", lastRun: run() }))).toMatchObject({
      key: "api:1:cell",
      glyph: "done",
      word: "Deployed",
      meta: "2h ago",
      tone: "quiet",
      failedMark: false,
      stale: false,
      label: "api · Staging · deployed 2 hours ago",
    });
  });

  it("says that nothing was deployed yet", () => {
    expect(cell(staging({ state: "no_deploy" }))).toMatchObject({
      glyph: "idle",
      word: "No deploy yet",
      meta: "",
      tone: "quiet",
      label: "api · Staging · no deploy yet",
    });
  });

  it("is Pending, strong, with the commits and how long they wait", () => {
    expect(
      cell(staging({ state: "pending", pending: true, promotion: promotion() })),
    ).toMatchObject({
      glyph: "promote",
      word: "Pending",
      meta: "3 commits · 2d",
      tone: "strong",
      label: "api · Staging · pending: 3 commits, changes for 2 days",
    });
  });

  it("is Ready to merge with the number of the pull request, and says draft", () => {
    const env = (draft: boolean) =>
      staging({
        state: "pr_ready",
        prReady: true,
        promotion: promotion({ deployPr: deployPr({ draft }) }),
      });

    expect(cell(env(false))).toMatchObject({
      glyph: "pullRequest",
      word: "Ready to merge",
      meta: "#88",
      tone: "strong",
      label: "api · Staging · ready to merge: pull request #88",
    });
    expect(cell(env(true)).meta).toBe("#88 · draft");
  });

  it("is Deploying with the time of the active run, or Queued", () => {
    const running = (status: string) =>
      staging({
        state: "running",
        running: true,
        lastRun: run({ status, startedAt: ago(80_000), endedAt: "" }),
      });

    expect(cell(running("running"))).toMatchObject({
      glyph: "github",
      word: "Deploying",
      meta: "1m 20s",
      tone: "github",
      label: "api · Staging · deploying for 1 minute",
    });
    expect(cell(running("queued")).meta).toBe("Queued");
  });

  it.each([
    ["creating", "work", "Creating the pull request…", "", "neutral"],
    ["merging", "work", "Merging…", "", "neutral"],
    ["waiting_run", "github", "Waiting for the run…", "#88 merged", "github"],
  ])("shows the action in the phase %s over the state", (phase, glyph, word, meta, tone) => {
    const model = cell(
      staging({
        state: "pr_ready",
        prReady: true,
        action: { kind: "merge", phase, failure: "", pr: 88 },
      }),
    );

    expect(model).toMatchObject({ glyph, word, meta, tone });
  });

  it("shows the action running as Deploying with its length", () => {
    const model = cell(
      staging({
        state: "running",
        running: true,
        lastRun: run({ status: "running", startedAt: ago(80_000), endedAt: "" }),
        action: { kind: "merge", phase: "running", failure: "", pr: 88 },
      }),
    );

    expect(model).toMatchObject({ glyph: "github", word: "Deploying", meta: "1m 20s" });
  });

  it("is Failed, in the error tone, with the age of the failed run", () => {
    expect(
      cell(
        staging({
          state: "failed",
          failed: true,
          lastRun: run({ status: "failed", endedAt: ago(20 * MINUTE) }),
        }),
      ),
    ).toMatchObject({
      glyph: "error",
      word: "Failed",
      meta: "20m ago",
      tone: "error",
      label: "api · Staging · failed 20 minutes ago",
    });
  });

  it("takes the failed run from failedRun when the last run is another", () => {
    const model = cell(
      staging({
        state: "failed",
        failed: true,
        lastRun: run({ status: "succeeded", endedAt: ago(HOUR) }),
        failedRun: run({ status: "failed", endedAt: ago(20 * MINUTE) }),
      }),
    );

    expect(model.meta).toBe("20m ago");
  });

  it("marks a failed deploy that comes with changes to promote", () => {
    const failed = { failed: true, lastRun: run({ status: "failed" }) };

    const pending = cell(
      staging({ ...failed, state: "failed", pending: true, promotion: promotion() }),
    );
    expect(pending).toMatchObject({ word: "Pending", failedMark: true });
    expect(pending.label).toBe(
      "api · Staging · pending: 3 commits, changes for 2 days, last deploy failed",
    );

    const ready = cell(
      staging({
        ...failed,
        state: "failed",
        prReady: true,
        promotion: promotion({ deployPr: deployPr() }),
      }),
    );
    expect(ready).toMatchObject({ word: "Ready to merge", failedMark: true });
  });

  it.each([
    ["merge", "Couldn't merge"],
    ["deploy", "Couldn't create the pull request"],
  ])("tells a failed %s action, and keeps the mark of a failed deploy", (kind, word) => {
    const model = cell(
      staging({
        state: "failed",
        failed: true,
        pending: true,
        promotion: promotion(),
        lastRun: run({ status: "failed" }),
        action: { kind, phase: "failed", failure: "boom", pr: 0 },
      }),
    );

    expect(model).toMatchObject({
      glyph: "error",
      word,
      meta: "See the panel",
      tone: "error",
      failedMark: true,
    });
  });

  it.each([
    ["branch_missing", "Branch missing", "staging", "branch staging is missing"],
    ["workflow_missing", "Workflow missing", "Deploy", "workflow Deploy is missing"],
  ])("is a neutral problem for %s", (problem, word, meta, said) => {
    expect(cell(staging({ state: "problem", problem }))).toMatchObject({
      glyph: "blocked",
      word,
      meta,
      tone: "neutral",
      label: `api · Staging · ${said}`,
    });
  });

  it("is Reading… under the shimmer while unread", () => {
    expect(cell(staging({ state: "unread" }))).toMatchObject({
      glyph: "shimmer",
      word: "Reading…",
      meta: "",
      tone: "quiet",
    });
  });

  it("names a merge in flight in its label", () => {
    const model = cell(
      staging({
        state: "pr_ready",
        action: { kind: "merge", phase: "merging", failure: "", pr: 88 },
      }),
    );

    expect(model.label).toBe("api · Staging · merging");
  });

  it("is stale when the row failed, and says from which reading", () => {
    const model = cell(
      staging({ state: "up_to_date", lastRun: run() }),
      repo({
        readAt: "2026-09-16T11:02:00Z",
        failure: { reason: "failed", message: "x", failedAt: "" },
      }),
    );

    expect(model.stale).toBe(true);
    expect(model.label).toMatch(/^api · Staging · deployed 2 hours ago, from the reading of /);
  });
});

describe("passageModel", () => {
  const passage = (env: DeployEnvironment) => passageModel(repo(), env);

  it("is null for the first environment", () => {
    expect(passage(makeDeployEnvironment())).toBeNull();
  });

  it("is quiet with nothing to deploy", () => {
    expect(passage(staging())).toEqual({
      key: "api:1:passage",
      lit: false,
      dashed: false,
      busy: false,
      text: "",
      short: "",
      label: "api · Development to Staging · nothing to deploy",
    });
  });

  it("is lit with the commits that wait", () => {
    expect(passage(staging({ pending: true, promotion: promotion() }))).toMatchObject({
      lit: true,
      text: "3 commits",
      short: "3",
      label: "api · Development to Staging · 3 commits to deploy",
    });
    expect(passage(staging({ pending: true, promotion: promotion({ commits: 1 }) }))?.text).toBe(
      "1 commit",
    );
  });

  it("is lit with the pull request ready to merge", () => {
    expect(
      passage(staging({ prReady: true, promotion: promotion({ deployPr: deployPr() }) })),
    ).toMatchObject({
      lit: true,
      text: "#88",
      short: "#88",
      label: "api · Development to Staging · pull request #88 ready to merge",
    });
  });

  it.each([
    ["creating", "Creating…", "creating the pull request"],
    ["merging", "Merging…", "merging"],
  ])("is busy while the app is %s", (phase, text, said) => {
    expect(
      passage(
        staging({
          prReady: true,
          promotion: promotion({ deployPr: deployPr() }),
          action: { kind: "merge", phase, failure: "", pr: 88 },
        }),
      ),
    ).toMatchObject({ busy: true, text, label: `api · Development to Staging · ${said}` });
  });

  it.each(["waiting_run", "running"])("is dashed while the action is %s", (phase) => {
    expect(
      passage(staging({ action: { kind: "merge", phase, failure: "", pr: 88 } })),
    ).toMatchObject({ dashed: true, busy: false, text: "" });
  });
});

describe("boardColumns", () => {
  const withNames = (...names: string[][]) =>
    makeDeployBoard({
      repositories: names.map((list, index) =>
        repo({
          id: `r${index}`,
          environments: list.map((name, position) => makeDeployEnvironment({ position, name })),
        }),
      ),
    });

  it("names a column when every repository that has it uses the same name", () => {
    expect(boardColumns(withNames(["Dev", "Staging"], ["Dev", "Staging", "Prod"]))).toEqual([
      { position: 0, name: "Dev" },
      { position: 1, name: "Staging" },
      { position: 2, name: "Prod" },
    ]);
  });

  it("leaves a column without a name when the repositories differ", () => {
    expect(boardColumns(withNames(["Dev", "Staging"], ["Dev", "QA"]))[1]).toEqual({
      position: 1,
      name: null,
    });
  });

  it("has no columns without repositories", () => {
    expect(boardColumns(makeDeployBoard())).toEqual([]);
  });
});

describe("gridSlots and moveFocus", () => {
  const envs = (count: number) =>
    Array.from({ length: count }, (_, position) => makeDeployEnvironment({ position }));
  const boards = [
    makeDeployBoard({
      id: "a",
      repositories: [
        repo({ id: "r1", environments: envs(3) }),
        repo({ id: "r2", environments: envs(2) }),
      ],
    }),
    makeDeployBoard({
      id: "hidden",
      shown: false,
      repositories: [repo({ id: "h", environments: envs(2) })],
    }),
    makeDeployBoard({
      id: "b",
      repositories: [
        repo({ id: "r3", environments: envs(3) }),
        repo({
          id: "r4",
          environments: [],
          failure: { reason: "failed", message: "x", failedAt: "" },
        }),
      ],
    }),
  ];
  const rows = gridSlots(boards);

  it("lists the cells and the passages of the shown boards, and no row without environments", () => {
    expect(rows.map((row) => row.map((slot) => slot.key))).toEqual([
      ["r1:0:cell", "r1:1:passage", "r1:1:cell", "r1:2:passage", "r1:2:cell"],
      ["r2:0:cell", "r2:1:passage", "r2:1:cell"],
      ["r3:0:cell", "r3:1:passage", "r3:1:cell", "r3:2:passage", "r3:2:cell"],
    ]);
    expect(rows[0]?.map((slot) => slot.column)).toEqual([0, 1, 2, 3, 4]);
  });

  it("moves along the row with the left and right arrows, and stops at the ends", () => {
    expect(moveFocus(rows, "r1:0:cell", "ArrowRight")).toBe("r1:1:passage");
    expect(moveFocus(rows, "r1:1:passage", "ArrowRight")).toBe("r1:1:cell");
    expect(moveFocus(rows, "r1:1:cell", "ArrowLeft")).toBe("r1:1:passage");
    expect(moveFocus(rows, "r1:0:cell", "ArrowLeft")).toBeNull();
    expect(moveFocus(rows, "r1:2:cell", "ArrowRight")).toBeNull();
  });

  it("moves between rows on the same column, or the greatest column below it", () => {
    expect(moveFocus(rows, "r1:1:cell", "ArrowDown")).toBe("r2:1:cell");
    expect(moveFocus(rows, "r1:2:cell", "ArrowDown")).toBe("r2:1:cell");
    expect(moveFocus(rows, "r2:1:passage", "ArrowDown")).toBe("r3:1:passage");
    expect(moveFocus(rows, "r3:1:cell", "ArrowUp")).toBe("r2:1:cell");
    expect(moveFocus(rows, "r1:0:cell", "ArrowUp")).toBeNull();
    expect(moveFocus(rows, "r3:2:cell", "ArrowDown")).toBeNull();
  });

  it("goes to the ends of the row with Home and End, and of the grid with Ctrl", () => {
    expect(moveFocus(rows, "r1:1:cell", "Home")).toBe("r1:0:cell");
    expect(moveFocus(rows, "r1:1:cell", "End")).toBe("r1:2:cell");
    expect(moveFocus(rows, "r2:1:passage", "Home", true)).toBe("r1:0:cell");
    expect(moveFocus(rows, "r1:0:cell", "End", true)).toBe("r3:2:cell");
  });

  it("does nothing for a key it does not own or a slot it does not know", () => {
    expect(moveFocus(rows, "r1:0:cell", "x")).toBeNull();
    expect(moveFocus(rows, "nope", "ArrowRight")).toBeNull();
  });
});

describe("changes", () => {
  const snapshot = (...envs: DeployEnvironment[]) =>
    makeDeploys({
      boards: [
        makeDeployBoard({
          repositories: [repo({ environments: [makeDeployEnvironment(), ...envs] })],
        }),
      ],
    });
  const texts = (before: ReturnType<typeof snapshot> | null, after: ReturnType<typeof snapshot>) =>
    changes(before, after).map((change) => change.text);
  const action = (phase: string, kind = "merge") => ({ kind, phase, failure: "", pr: 88 });

  it("is nothing for the first reading, and for an environment that appears", () => {
    expect(changes(null, snapshot(staging()))).toEqual([]);
    expect(texts(snapshot(), snapshot(staging({ state: "failed" })))).toEqual([]);
  });

  it("is nothing when the states are the same", () => {
    expect(changes(snapshot(staging()), snapshot(staging()))).toEqual([]);
  });

  it.each([
    [{ state: "up_to_date" }, { state: "running" }, "api · Staging is deploying"],
    [{ state: "running" }, { state: "up_to_date" }, "api · Staging deployed"],
    [{ state: "running" }, { state: "failed" }, "api · Staging failed"],
    [{ state: "up_to_date" }, { state: "pr_ready" }, "api · Staging is ready to merge"],
    [{ state: "up_to_date" }, { state: "pending" }, "api · Staging has changes to deploy"],
    [{ state: "pending" }, { state: "up_to_date" }, "api · Staging is up to date"],
  ])("tells %j becoming %j", (from, to, text) => {
    expect(texts(snapshot(staging(from)), snapshot(staging(to)))).toEqual([text]);
  });

  it("tells an action that runs as a deploy, and a failed one", () => {
    const before = snapshot(staging({ state: "pr_ready" }));

    expect(
      texts(before, snapshot(staging({ state: "pr_ready", action: action("waiting_run") }))),
    ).toEqual(["api · Staging is deploying"]);
    expect(
      texts(before, snapshot(staging({ state: "pr_ready", action: action("failed") }))),
    ).toEqual(["Couldn't merge api · Staging"]);
    expect(
      texts(before, snapshot(staging({ state: "pending", action: action("failed", "deploy") }))),
    ).toEqual(["Couldn't create the deploy pull request of api · Staging"]);
  });

  it("says nothing for the phases that only wait, and carries the key of the environment", () => {
    const before = snapshot(staging({ state: "pr_ready" }));

    expect(
      texts(before, snapshot(staging({ state: "pr_ready", action: action("merging") }))),
    ).toEqual([]);
    expect(changes(before, snapshot(staging({ state: "running" })))[0]?.key).toBe("api:1");
  });
});
