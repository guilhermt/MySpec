import { describe, expect, it } from "vitest";
import { type PanelAction, panelReason, prPanelModel } from "@/features/reviews/pr-panel";
import type { PullRequestRow, Repository, State } from "@/lib/wails";
import {
  makePRCheck,
  makePullRequestRow,
  makePullReview,
  makePullsFailure,
  makeRepository,
  makeReviewCenter,
  makeReviewSummary,
  makeState,
  makeTask,
} from "@/test/wails-mock";

// NOW is Sunday, September 27, 2026, 15:00 in the local time of the runner.
const NOW = new Date(2026, 8, 27, 15, 0).getTime();
const ago = (ms: number) => new Date(NOW - ms).toISOString();
const MINUTE = 60_000;

function panel(
  overrides: Partial<PullRequestRow>,
  app: Partial<State> = {},
  repository: Partial<Repository> = {},
) {
  const row = makePullRequestRow(overrides);
  const state = makeState({
    repositories: [makeRepository(repository)],
    reviewCenter: makeReviewCenter({ pullRequests: [row], readAt: ago(2 * MINUTE) }),
    ...app,
  });
  return prPanelModel(row, { app: state, now: NOW });
}

describe("prPanelModel", () => {
  it("heads the panel with the reference, the repository and the link", () => {
    const model = panel({ repository: "acme/api", number: 1302 });

    expect(model.head).toEqual({
      reference: "api#1302",
      repository: "acme/api",
      url: "https://github.com/dev/web/pull/31",
    });
  });

  it("tells the author, the state, the draft and the age of the update", () => {
    const model = panel({ author: "lnakamura", draft: true, updatedAt: ago(2 * 60 * MINUTE) });

    expect(model.meta).toMatchObject({
      author: "lnakamura",
      state: "Never reviewed",
      draft: true,
      updated: "updated 2 hours ago",
    });
    expect(model.meta.updatedTooltip).not.toBe("");
  });

  it("leaves the state to the block of an active review", () => {
    const review = makeReviewSummary();
    const model = panel({ reviewId: review.id, action: "open_review" }, { reviews: [review] });

    expect(model.meta.state).toBeNull();
    expect(model.action).toEqual({ kind: "review", review });
  });

  it.each<[string, Partial<PullRequestRow>, Partial<Repository>, PanelAction]>([
    ["a pending one", {}, {}, { kind: "start", primary: true, reason: null }],
    [
      "one with checks not finished",
      {
        checks: [
          makePRCheck({ state: "running" }),
          makePRCheck({ state: "queued" }),
          makePRCheck({ state: "passed" }),
        ],
      },
      {},
      {
        kind: "start",
        primary: true,
        reason: "The first pass waits for the checks: 2 not finished.",
      },
    ],
    [
      "your own",
      { own: true },
      {},
      {
        kind: "start-own",
        reason: "Your own pull request: the review can publish a comment, or apply its findings.",
      },
    ],
    ["one from a fork", { action: "fork" }, {}, { kind: "fork" }],
    [
      "one whose clone is missing",
      { action: "clone_missing" },
      { path: "~/code/web" },
      { kind: "clone-missing", path: "~/code/web" },
    ],
    [
      "one never cloned",
      { action: "clone", repository: "acme/docs" },
      { cloned: false },
      { kind: "clone", state: "idle", repository: "acme/docs", message: "" },
    ],
    [
      "one cloning",
      { action: "clone", repository: "acme/docs" },
      { cloned: false, cloning: true },
      { kind: "clone", state: "cloning", repository: "acme/docs", message: "" },
    ],
    [
      "one whose clone failed",
      { action: "clone", repository: "acme/docs" },
      { cloned: false, cloneError: "gh: repository not found" },
      {
        kind: "clone",
        state: "failed",
        repository: "acme/docs",
        message: "gh: repository not found",
      },
    ],
  ])("offers the action of %s", (_, overrides, repository, action) => {
    expect(panel(overrides, {}, repository).action).toEqual(action);
  });

  it("offers the task a pull request belongs to", () => {
    const task = makeTask({ id: "task-1" });

    expect(panel({ taskId: "task-1", action: "open_task" }, { tasks: [task] }).action).toEqual({
      kind: "task",
      task,
      taskId: "task-1",
    });
    expect(panel({ taskId: "task-2", action: "open_task" }).action).toEqual({
      kind: "task",
      task: null,
      taskId: "task-2",
    });
  });

  it("sums up the checks of the reading of the list, with its age", () => {
    const model = panel({
      checks: [makePRCheck({ state: "failed" }), makePRCheck({ state: "passed" })],
      mergeable: "conflicting",
      baseBranch: "dev",
    });

    expect(model.checks).toMatchObject({
      summary: "1 failed · 1 of 2 passed · conflict with dev",
      age: "read 2m ago",
      failed: null,
    });
    expect(model.checks.ageTooltip).toMatch(/^Last read at \d\d:\d\d$/);
  });

  it("says the repository couldn't be read in the place of the age", () => {
    const failures = [makePullsFailure({ repository: "acme/ios", failedAt: ago(4 * MINUTE) })];
    const row = makePullRequestRow();
    const app = makeState({
      reviewCenter: makeReviewCenter({ pullRequests: [row], readAt: ago(MINUTE), failures }),
    });

    expect(prPanelModel(row, { app, now: NOW }).checks.failed).toBe(
      "◇ acme/ios couldn't be read · 4m ago",
    );
  });

  it("lists the facts, with your review only in Reviewed", () => {
    const yourReview = makePullReview({ at: new Date(2026, 8, 27, 10, 2).toISOString() });
    const reviewed = panel({
      headBranch: "idempotency-keys",
      baseBranch: "dev",
      labels: [
        { name: "payments", color: "" },
        { name: "api", color: "" },
      ],
      pending: false,
      reviewed: true,
      yourReview,
    });

    expect(reviewed.facts).toEqual({
      branch: "idempotency-keys → dev",
      card: null,
      labels: "payments, api",
      yourReview: "You approved it today at 10:02",
    });
    expect(panel({ pending: true, reviewed: true, yourReview }).facts.yourReview).toBeNull();
    expect(panel({}).facts.labels).toBe("");
  });

  it("carries the description", () => {
    expect(panel({ body: "## Why" }).body).toBe("## Why");
  });
});

describe("panelReason", () => {
  it.each<[PanelAction, string | null]>([
    [{ kind: "start", primary: true, reason: null }, null],
    [
      {
        kind: "start",
        primary: true,
        reason: "The first pass waits for the checks: 2 not finished.",
      },
      "The first pass waits for the checks: 2 not finished.",
    ],
    [{ kind: "review", review: makeReviewSummary() }, null],
    [
      { kind: "task", task: null, taskId: "task-1" },
      "The review of this pull request happens in its task.",
    ],
    [{ kind: "fork" }, "Pull requests from forks can't be reviewed yet."],
    [{ kind: "clone-missing", path: "~/code/web" }, "The clone at ~/code/web is missing."],
    [
      { kind: "clone", state: "idle", repository: "acme/docs", message: "" },
      "acme/docs isn't cloned yet. A review needs a clone.",
    ],
    [
      { kind: "clone", state: "cloning", repository: "acme/docs", message: "" },
      "The dialog opens when the clone ends.",
    ],
    [
      { kind: "clone", state: "failed", repository: "acme/docs", message: "gh: not found" },
      "gh: not found",
    ],
  ])("says the reason of %j", (action, reason) => {
    expect(panelReason(action)).toBe(reason);
  });
});
