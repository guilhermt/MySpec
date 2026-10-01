import { describe, expect, it } from "vitest";
import {
  backTarget,
  type DetailsModel,
  detailsOf,
  earlierPlace,
  reportOf,
} from "@/features/task/details";
import type { TaskSummary } from "@/lib/wails";
import {
  makePullRequest,
  makeRepository,
  makeStep,
  makeStepReviewer,
  makeTask,
  makeTaskCard,
  makeTaskConversation,
  makeTextPRReport,
} from "@/test/wails-mock";

const AT = "2026-09-27T09:14:00Z";
const conversation = (stage: string) => makeTaskConversation({ stage, startedAt: AT });

const committed = (number: number) =>
  makeStep({
    number,
    title: `Step ${number} title`,
    status: "done",
    commitSha: "c19f02e8a1b2",
    commitSubject: `Commit ${number}`,
    committedAt: "2026-09-27T13:48:00Z",
    reports: [{ pass: 1, file: `${number}-1.md`, clean: false, findings: -1 }],
  });

const STRUCTURED: TaskSummary = makeTask({
  stage: "implementation",
  reviewMode: "agent",
  currentStep: 3,
  steps: [
    committed(1),
    committed(2),
    makeStep({
      number: 3,
      title: "Wire the API",
      status: "agent_review",
      reviewMode: "agent",
      reviewPass: 2,
      reviewer: makeStepReviewer({ sessionStage: "step_review:3", sessionStatus: "working" }),
      reports: [{ pass: 1, file: "3-1.md", clean: false, findings: -1 }],
    }),
    makeStep({ number: 4, title: "Add the limits" }),
  ],
  conversations: [
    conversation("prd"),
    conversation("tech_spec"),
    conversation("plan"),
    conversation("step:1"),
    conversation("step_review:1"),
    conversation("step:2"),
    conversation("step:3"),
    conversation("step_review:3"),
  ],
  branch: "rate-limit",
  baseBranch: "origin/dev",
  worktreePath: "/home/dev/worktrees/rate-limit",
});

describe("detailsOf, Steps", () => {
  it("lists the committed steps, the current one with its reports, and the ones not started", () => {
    const { steps } = detailsOf(STRUCTURED, null, "step_review:3");

    expect(steps?.legend).toBe("Steps · 2 of 4 committed");
    expect(steps?.empty).toBeNull();
    expect(steps?.rows[0]).toEqual({
      kind: "committed",
      number: 1,
      title: "Step 1 title",
      sha: "c19f02e",
      committedAt: "2026-09-27T13:48:00Z",
      subject: "Commit 1",
      conversations: [
        { stage: "step:1", label: "Implementer", startedAt: AT, now: false },
        { stage: "step_review:1", label: "Reviewer", startedAt: AT, now: false },
      ],
      reports: [
        {
          key: "step-1-1",
          label: "Review 1 · changes",
          file: "step-reviews/1-1.md",
          title: "Step 1 · Review 1 · changes",
        },
      ],
    });
    expect(steps?.rows[1]).toMatchObject({
      kind: "committed",
      conversations: [{ label: "Implementer" }],
    });
    expect(steps?.rows[2]).toEqual({
      kind: "current",
      number: 3,
      title: "Wire the API",
      glyph: "work",
      mode: "Agent",
      fallbackReason: "",
      reports: [
        {
          key: "step-3-1",
          label: "Review 1 · changes",
          file: "step-reviews/3-1.md",
          title: "Step 3 · Review 1 · changes",
        },
      ],
    });
    expect(steps?.rows[3]).toEqual({ kind: "not_started", step: STRUCTURED.steps?.[3] });
  });

  it("says a Manual current step and why the agent review gave way", () => {
    const task = makeTask({
      stage: "implementation",
      currentStep: 1,
      steps: [
        makeStep({ status: "in_review", reviewMode: "manual", reviewFallback: "taken_over" }),
      ],
    });

    expect(detailsOf(task, null, "step:1").steps?.rows[0]).toMatchObject({
      kind: "current",
      mode: "Manual",
      fallbackReason: "Taken over from the agent review",
    });
  });

  it.each([
    [[committed(1), committed(2)], "Steps · 2 committed"],
    [[committed(1), makeStep({ number: 2 })], "Steps · 1 of 2 committed"],
  ])("counts the commits in the legend", (steps, legend) => {
    expect(detailsOf(makeTask({ stage: "pr", steps }), null, null).steps?.legend).toBe(legend);
  });

  it("says the steps come from the plan before it", () => {
    expect(detailsOf(makeTask({ stage: "tech_spec", steps: [] }), null, "tech_spec").steps).toEqual(
      {
        legend: "Steps",
        rows: [],
        empty: "Steps come from the plan.",
      },
    );
  });

  it("has no Implementation group in a Structured task", () => {
    expect(detailsOf(STRUCTURED, null, null).implementation).toBeNull();
  });
});

describe("detailsOf, Implementation", () => {
  const oneShot = (overrides: Partial<TaskSummary>) =>
    makeTask({ mode: "one_shot", conversations: [conversation("one_shot")], ...overrides });

  it("has no group before the implementation, and no Steps", () => {
    const details = detailsOf(oneShot({ stage: "one_shot" }), null, "one_shot");

    expect(details.implementation).toBeNull();
    expect(details.steps).toBeNull();
  });

  it("is the current implementation, with its reports", () => {
    const task = oneShot({
      stage: "implementation",
      currentStep: 1,
      steps: [
        makeStep({
          status: "agent_review",
          reviewMode: "agent",
          reports: [{ pass: 1, file: "1-1.md", clean: true, findings: 0 }],
        }),
      ],
    });

    expect(detailsOf(task, null, "step:1").implementation).toMatchObject({
      kind: "current",
      reports: [{ label: "Review 1 · clean", title: "Implementation · Review 1 · clean" }],
    });
  });

  it("is the committed implementation in the PR stage, with its conversations", () => {
    const task = oneShot({
      stage: "pr",
      steps: [committed(1)],
      conversations: [conversation("one_shot"), conversation("step:1")],
      pr: makePullRequest({ status: "drafting" }),
    });

    expect(detailsOf(task, null, "pr").implementation).toMatchObject({
      kind: "committed",
      conversations: [{ stage: "step:1", label: "Implementer" }],
    });
  });
});

describe("detailsOf, Planning", () => {
  it.each<[string, TaskSummary, string | null, DetailsModel["planning"]]>([
    [
      "the Structured conversations, the one on screen now",
      makeTask({
        stage: "plan",
        conversations: [conversation("prd"), conversation("tech_spec"), conversation("plan")],
      }),
      "plan",
      [
        { stage: "prd", label: "PRD", startedAt: AT, now: false },
        { stage: "tech_spec", label: "Tech spec", startedAt: AT, now: false },
        { stage: "plan", label: "Plan", startedAt: AT, now: true },
      ],
    ],
    [
      "the One-Shot conversation",
      makeTask({
        mode: "one_shot",
        stage: "implementation",
        conversations: [conversation("one_shot")],
      }),
      "step:1",
      [{ stage: "one_shot", label: "Planning", startedAt: AT, now: false }],
    ],
    ["nothing before a conversation", makeTask({ conversations: [] }), null, []],
  ])("lists %s", (_, task, onScreen, planning) => {
    expect(detailsOf(task, null, onScreen).planning).toEqual(planning);
  });
});

describe("detailsOf, Pull request", () => {
  it("is absent before the PR stage", () => {
    expect(detailsOf(STRUCTURED, null, null).pullRequest).toBeNull();
  });

  it("lists the draft conversation before the pull request opens", () => {
    const task = makeTask({
      stage: "pr",
      conversations: [conversation("pr")],
      pr: makePullRequest({ status: "drafting" }),
    });

    expect(detailsOf(task, null, "pr").pullRequest).toEqual({
      conversations: [{ stage: "pr", label: "Draft and opening", startedAt: AT, now: true }],
      reports: [],
      pr: null,
    });
  });

  it("lists the closed review of a done pull request as the one on screen, with every report", () => {
    const task = makeTask({
      stage: "pr",
      conversations: [conversation("pr"), conversation("pr_review")],
      pr: makePullRequest({
        status: "done",
        prNumber: 1284,
        prUrl: "https://github.com/acme/api/pull/1284",
        prState: "open",
        prBase: "dev",
        sessionStage: "pr_review",
        reports: [makeTextPRReport(1, false), makeTextPRReport(2, true)],
      }),
    });

    expect(detailsOf(task, null, null).pullRequest).toEqual({
      conversations: [
        { stage: "pr", label: "Draft and opening · #1284", startedAt: AT, now: false },
        { stage: "pr_review", label: "PR review", startedAt: AT, now: true },
      ],
      reports: [
        {
          key: "pr-1",
          label: "Review 1 · changes",
          file: "pr/review-1.md",
          title: "PR review · Review 1 · changes",
        },
        {
          key: "pr-2",
          label: "Review 2 · clean",
          file: "pr/review-2.md",
          title: "PR review · Review 2 · clean",
        },
      ],
      pr: {
        number: 1284,
        url: "https://github.com/acme/api/pull/1284",
        base: "dev",
        state: "open",
      },
    });
  });
});

describe("detailsOf, Pull request past its review", () => {
  it.each(["done", "trouble", "merged", "pr_closed"])(
    "has the review on screen with the pull request %s",
    (status) => {
      const task = makeTask({
        stage: "pr",
        conversations: [conversation("pr"), conversation("pr_review")],
        pr: makePullRequest({ status, prNumber: 1284, sessionStage: "" }),
      });

      expect(detailsOf(task, null, null).pullRequest?.conversations).toEqual([
        { stage: "pr", label: "Draft and opening · #1284", startedAt: AT, now: false },
        { stage: "pr_review", label: "PR review", startedAt: AT, now: true },
      ]);
    },
  );

  it("leaves the review an earlier conversation while a pass waits for the checks", () => {
    const task = makeTask({
      stage: "pr",
      conversations: [conversation("pr"), conversation("pr_review")],
      pr: makePullRequest({ status: "waiting_checks", prNumber: 1284, sessionStage: "" }),
    });

    expect(detailsOf(task, null, null).pullRequest?.conversations[1]?.now).toBe(false);
  });
});

describe("detailsOf, Task", () => {
  it("tells the facts of a task with its worktree and card", () => {
    const card = makeTaskCard();
    const repository = makeRepository({ path: "/home/dev/code/api", missing: true });

    expect(
      detailsOf({ ...STRUCTURED, card, repository: "acme/api" }, repository, null).task,
    ).toEqual({
      repository: "acme/api",
      path: "/home/dev/code/api",
      cloneMissing: true,
      card,
      epic: card.epic,
      mode: "Structured",
      reviewMode: "agent",
      branch: "rate-limit",
      base: "dev",
      worktree: "/home/dev/worktrees/rate-limit",
      startedAt: STRUCTURED.createdAt,
    });
  });

  it("tells a One-Shot task before its worktree, without a repository", () => {
    expect(
      detailsOf(makeTask({ mode: "one_shot", stage: "one_shot" }), null, null).task,
    ).toMatchObject({
      path: "",
      cloneMissing: false,
      card: null,
      epic: null,
      mode: "One-Shot",
      reviewMode: "manual",
      branch: "",
      base: "",
      worktree: "",
    });
  });
});

describe("earlierPlace", () => {
  it.each([
    ["structured", "prd", "PRD"],
    ["structured", "tech_spec", "Tech spec"],
    ["structured", "plan", "Plan"],
    ["one_shot", "one_shot", "Planning"],
    ["structured", "step:2", "Step 2 · Implementer"],
    ["structured", "step_review:2", "Step 2 · Reviewer"],
    ["one_shot", "step:1", "Implementation · Implementer"],
    ["one_shot", "step_review:1", "Implementation · Reviewer"],
    ["structured", "pr", "Draft and opening"],
    ["structured", "pr_review", "PR review"],
  ])("names a %s conversation of %s as %s", (mode, stage, place) => {
    expect(earlierPlace(makeTask({ mode }), stage)).toBe(place);
  });
});

describe("backTarget", () => {
  it.each<[string, TaskSummary, string | null, string]>([
    ["a step", makeTask({ stage: "implementation", currentStep: 3 }), "step:3", "step 3"],
    [
      "a One-Shot implementation",
      makeTask({ mode: "one_shot", stage: "implementation", currentStep: 1 }),
      "step:1",
      "the implementation",
    ],
    ["the PRD", makeTask({ stage: "prd" }), "prd", "the PRD"],
    ["the tech spec", makeTask({ stage: "tech_spec" }), "tech_spec", "the tech spec"],
    ["the plan", makeTask({ stage: "plan" }), "plan", "the plan"],
    ["planning", makeTask({ mode: "one_shot", stage: "one_shot" }), "one_shot", "planning"],
    ["the review of the pull request", makeTask({ stage: "pr" }), "pr_review", "the PR review"],
    ["the pull request, drafting", makeTask({ stage: "pr" }), "pr", "the pull request"],
    ["the pull request, done", makeTask({ stage: "pr" }), null, "the pull request"],
  ])("goes back to %s", (_, task, screen, target) => {
    expect(backTarget(task, screen)).toBe(target);
  });
});

describe("reportOf", () => {
  it("finds a report of a step, of the implementation and of the pull request by its file", () => {
    const steps = detailsOf(STRUCTURED, null, null);
    expect(reportOf(steps, "step-reviews/2-1.md")).toMatchObject({ file: "step-reviews/2-1.md" });
    expect(reportOf(steps, "step-reviews/3-1.md")).toMatchObject({ file: "step-reviews/3-1.md" });

    const oneShot = detailsOf(
      makeTask({
        mode: "one_shot",
        stage: "implementation",
        currentStep: 1,
        steps: [
          makeStep({
            status: "agent_review",
            reports: [{ pass: 1, file: "1-1.md", clean: true, findings: 0 }],
          }),
        ],
      }),
      null,
      null,
    );
    expect(reportOf(oneShot, "step-reviews/1-1.md")).toMatchObject({ file: "step-reviews/1-1.md" });

    const pr = detailsOf(
      makeTask({
        stage: "pr",
        pr: makePullRequest({
          prNumber: 1284,
          reports: [makeTextPRReport(1, true)],
        }),
      }),
      null,
      null,
    );
    expect(reportOf(pr, "pr/review-1.md")).toMatchObject({ file: "pr/review-1.md" });
  });

  it("finds nothing for a file Details doesn't list", () => {
    expect(reportOf(detailsOf(STRUCTURED, null, null), "step-reviews/9-1.md")).toBeNull();
  });
});
