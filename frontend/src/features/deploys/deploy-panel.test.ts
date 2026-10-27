import { describe, expect, it } from "vitest";
import { actionModel, panelModel } from "@/features/deploys/deploy-panel";
import type { DeployEnvironment, DeployRepository, DeployRun } from "@/lib/wails";
import { makeDeployEnvironment, makeDeployRepository } from "@/test/wails-mock";

const NOW = Date.parse("2026-09-16T12:00:00Z");
const ago = (ms: number) => new Date(NOW - ms).toISOString();
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const repo = (overrides: Partial<DeployRepository> = {}) =>
  makeDeployRepository({ id: "api", name: "api", fullName: "dev/api", ...overrides });

const development = (overrides: Partial<DeployEnvironment> = {}) =>
  makeDeployEnvironment(overrides);

const staging = (overrides: Partial<DeployEnvironment> = {}) =>
  makeDeployEnvironment({
    position: 1,
    name: "Staging",
    branch: "staging",
    previousName: "Development",
    previousBranch: "dev",
    workflowUrl: "https://github.com/dev/api/actions/workflows/deploy.yml",
    compareUrl: "https://github.com/dev/api/compare/staging...dev",
    ...overrides,
  });

const run = (overrides: Partial<DeployRun> = {}): DeployRun => ({
  id: 1,
  status: "succeeded",
  conclusion: "success",
  url: "https://github.com/dev/api/actions/runs/1",
  startedAt: ago(3 * HOUR),
  endedAt: ago(3 * HOUR - 192_000),
  ...overrides,
});

const promotion = (overrides: Partial<NonNullable<DeployEnvironment["promotion"]>> = {}) => ({
  commits: 3,
  partial: false,
  ahead: 3,
  pendingSince: ago(2 * DAY),
  pullRequests: [
    { number: 12, title: "Fix login", url: "https://github.com/dev/api/pull/12", author: "ana" },
  ],
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

describe("panelModel", () => {
  const model = (env: DeployEnvironment, r = repo()) => panelModel(r, env, NOW);

  it("names a later environment by its promotion and points at the deploy pull request", () => {
    const m = model(staging({ promotion: promotion({ deployPr: deployPr() }) }));

    expect(m.first).toBe(false);
    expect(m.head).toEqual({
      label: "Deploy api to Staging",
      number: "Development → Staging",
      repository: "dev/api",
      url: "https://github.com/dev/api/pull/88",
    });
    expect(m.title).toBe("Deploy to Staging");
  });

  it("points at the comparison when no deploy pull request is open", () => {
    expect(model(staging({ promotion: promotion() })).head.url).toBe(
      "https://github.com/dev/api/compare/staging...dev",
    );
  });

  it("names the first environment alone, and points at its run", () => {
    const m = model(development({ lastRun: run() }));

    expect(m.first).toBe(true);
    expect(m.head).toMatchObject({
      label: "api · Development",
      number: "Development",
      url: "https://github.com/dev/api/actions/runs/1",
    });
    expect(m.title).toBe("Development");
    expect(m.changes).toBeNull();
    expect(m.pullRequests).toBeNull();
    expect(m.deployPr).toBeNull();
  });

  it("has no way to GitHub for a first environment that never deployed", () => {
    expect(model(development()).head.url).toBe("");
  });

  it("tells the changes and how long they wait", () => {
    expect(model(staging({ promotion: promotion() })).changes).toEqual({
      summary: "3 commits · waiting for 2 days",
      partial: null,
    });
  });

  it("says the reading is partial", () => {
    expect(
      model(staging({ promotion: promotion({ commits: 235, ahead: 240, partial: true }) })).changes,
    ).toMatchObject({
      partial: "Showing the pull requests of the first 100 of 240 commits.",
    });
  });

  it("says there is nothing to deploy", () => {
    expect(
      model(staging({ promotion: promotion({ commits: 0, pendingSince: "" }) })).changes,
    ).toEqual({ summary: "Nothing to deploy.", partial: null });
    expect(model(staging()).changes?.summary).toBe("Nothing to deploy.");
  });

  it("lists the pull requests of the deploy, never the commits", () => {
    expect(model(staging({ promotion: promotion() })).pullRequests).toEqual([
      { number: 12, title: "Fix login", url: "https://github.com/dev/api/pull/12", author: "ana" },
    ]);
  });

  it("tells the deploy pull request, a draft, and the other ones", () => {
    const m = model(
      staging({
        promotion: promotion({ deployPr: deployPr({ draft: true }), otherDeployPrs: 2 }),
      }),
    );

    expect(m.deployPr).toEqual({
      number: 88,
      title: "Deploy to Staging",
      url: "https://github.com/dev/api/pull/88",
      draft: true,
      age: "1h ago",
      others: "2 more deploy pull requests are open.",
    });
    expect(
      model(staging({ promotion: promotion({ deployPr: deployPr(), otherDeployPrs: 1 }) })).deployPr
        ?.others,
    ).toBe("1 more deploy pull request is open.");
  });

  it("tells the last run, how long it took, and the workflow", () => {
    const m = model(staging({ lastRun: run() }));

    expect(m.run.last).toMatchObject({ glyph: "done", word: "Succeeded" });
    expect(m.run.last?.detail).toMatch(/^Started .* · 3m 12s$/);
    expect(m.run.workflow).toEqual({
      name: "Deploy",
      url: "https://github.com/dev/api/actions/workflows/deploy.yml",
    });
  });

  it("tells a run that goes on with how long it has", () => {
    expect(
      model(staging({ lastRun: run({ status: "running", startedAt: ago(80_000), endedAt: "" }) }))
        .run.last,
    ).toEqual({ glyph: "github", word: "Running", detail: "Running for 1m 20s" });
    expect(
      model(staging({ lastRun: run({ status: "queued", startedAt: "", endedAt: "" }) })).run.last,
    ).toMatchObject({ glyph: "github", word: "Queued" });
  });

  it("tells a failed run, and a second line for the failed one behind the last", () => {
    const m = model(
      staging({
        lastRun: run(),
        failedRun: run({ status: "failed", endedAt: ago(20 * MINUTE) }),
      }),
    );

    expect(m.run.last?.word).toBe("Succeeded");
    expect(m.run.failed).toEqual({ glyph: "error", word: "Failed", detail: "20m ago" });
    expect(model(staging({ lastRun: run({ status: "failed" }) })).run.last).toMatchObject({
      glyph: "error",
      word: "Failed",
    });
  });

  it("says there is no run yet", () => {
    expect(model(staging()).run.last).toBeNull();
  });

  it("offers each destination on GitHub it has", () => {
    expect(
      model(staging({ lastRun: run(), promotion: promotion({ deployPr: deployPr() }) })).links,
    ).toEqual([
      { label: "Open the deploy pull request", url: "https://github.com/dev/api/pull/88" },
      { label: "Open the run", url: "https://github.com/dev/api/actions/runs/1" },
      { label: "Compare staging...dev", url: "https://github.com/dev/api/compare/staging...dev" },
    ]);
    expect(model(development({ lastRun: run() })).links).toEqual([
      { label: "Open the run", url: "https://github.com/dev/api/actions/runs/1" },
    ]);
    expect(model(development()).links).toEqual([]);
  });

  it("tells a missing branch and a missing workflow", () => {
    expect(model(staging({ state: "problem", problem: "branch_missing" })).problem).toEqual({
      text: "Branch staging doesn't exist on GitHub.",
    });
    expect(model(staging({ state: "problem", problem: "workflow_missing" })).problem).toEqual({
      text: "The workflow Deploy no longer exists.",
    });
    expect(model(staging()).problem).toBeNull();
  });

  it("carries the failure of the reading of the repository", () => {
    expect(
      model(
        staging(),
        repo({ failure: { reason: "failed", message: "rate limited", failedAt: ago(4 * MINUTE) } }),
      ).readFailure,
    ).toEqual({ title: "Couldn't read api · 4m ago", reason: "rate limited" });
    expect(model(staging()).readFailure).toBeNull();
  });
});

describe("actionModel", () => {
  it("has no action on the first environment", () => {
    expect(actionModel(development())).toBeNull();
  });

  it("offers Deploy with the key D when changes wait", () => {
    expect(actionModel(staging({ available: "deploy" }))).toMatchObject({
      kind: "deploy",
      label: "Deploy to Staging",
      shortcut: "D",
      busy: null,
      disabledReason: null,
      failure: null,
    });
  });

  it("offers Merge when a deploy pull request is ready", () => {
    expect(actionModel(staging({ available: "merge", prReady: true }))).toMatchObject({
      kind: "merge",
      label: "Merge",
      disabledReason: null,
    });
  });

  it("says a draft may be refused", () => {
    expect(
      actionModel(
        staging({
          available: "merge",
          prReady: true,
          promotion: promotion({ deployPr: deployPr({ draft: true }) }),
        }),
      )?.draftNote,
    ).toBe("This pull request is a draft. GitHub may refuse to merge it.");
    expect(actionModel(staging({ available: "deploy" }))?.draftNote).toBeNull();
  });

  it("is dashed with the reason of the key when there is nothing to do", () => {
    expect(actionModel(staging())).toMatchObject({
      label: "Deploy to Staging",
      disabledReason: "Nothing to deploy to Staging.",
    });
  });

  it("carries the loading label of each phase while the app acts", () => {
    const action = (phase: string) =>
      actionModel(staging({ busy: true, action: { kind: "deploy", phase, failure: "", pr: 0 } }));

    expect(action("creating")?.busy).toBe("Creating the pull request…");
    expect(action("merging")?.busy).toBe("Merging…");
    expect(action("waiting_run")?.busy).toBe("Waiting for the run…");
    expect(action("running")?.busy).toBe("Deploying…");
    expect(action("creating")?.disabledReason).toBe("A deploy action is running on Staging.");
  });

  it("carries what GitHub said when the action failed, and offers it again", () => {
    expect(
      actionModel(
        staging({
          available: "deploy",
          action: { kind: "deploy", phase: "failed", failure: "Base branch was modified", pr: 0 },
        }),
      ),
    ).toMatchObject({ failure: "Base branch was modified", disabledReason: null, busy: null });
  });

  it("warns about the environment before", () => {
    expect(actionModel(staging({ available: "deploy", previous: "failed" }))?.warning).toBe(
      "Development's last deploy failed",
    );
    expect(actionModel(staging({ available: "deploy", previous: "deploying" }))?.warning).toBe(
      "Development is still deploying",
    );
    expect(actionModel(staging({ available: "deploy" }))?.warning).toBeNull();
  });
});
