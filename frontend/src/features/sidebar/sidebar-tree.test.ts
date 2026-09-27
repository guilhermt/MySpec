import { describe, expect, it } from "vitest";
import {
  allRows,
  discussionRow,
  emptyTreeText,
  flashOf,
  type ItemRow,
  nodeSummary,
  nodesOfItem,
  type RowTone,
  reviewRow,
  shortAction,
  sidebarTree,
  TONE_RANK,
  taskRow,
  visibleEntries,
} from "@/features/sidebar/sidebar-tree";
import { ALL_REPOSITORIES } from "@/lib/repositories";
import type { DiscussionSummary, Place, ReviewSummary, Situation, TaskSummary } from "@/lib/wails";
import {
  makeBoard,
  makeDiscussion,
  makeDiscussionCard,
  makeDraft,
  makePullRequest,
  makeRepository,
  makeReviewFinding,
  makeReviewPass,
  makeReviewSummary,
  makeSituation,
  makeState,
  makeStep,
  makeStepReviewer,
  makeTask,
  makeTaskCard,
} from "@/test/wails-mock";

const NOW = Date.parse("2026-09-05T12:00:00Z");
const TWO_HOURS_AGO = "2026-09-05T10:00:00Z";
const THREE_MINUTES_AGO = "2026-09-05T11:57:00Z";

const STAGE_PLACE: Place = { kind: "stage", stage: "plan", step: 0 };
const STEP_PLACE: Place = { kind: "step", stage: "", step: 3 };
const REVIEWER_PLACE: Place = { kind: "step_review", stage: "", step: 3 };
const PR_PLACE: Place = { kind: "pr", stage: "", step: 0 };
const REVIEW_PLACE: Place = { kind: "review", stage: "", step: 0 };
const DISCUSSION_PLACE: Place = { kind: "discussion", stage: "", step: 0 };

const STEPS = [1, 2, 3, 4, 5, 6, 7].map((number) => makeStep({ number, status: "done" }));

// A task at step 3 of 7, with an open pull request #1279 on its second pass.
function taskWith(overrides: Partial<TaskSummary> = {}): TaskSummary {
  return makeTask({
    stage: "implementation",
    steps: STEPS,
    currentStep: 3,
    pr: makePullRequest({
      status: "awaiting_decision",
      prNumber: 1279,
      reports: [
        { pass: 1, file: "", clean: false },
        { pass: 2, file: "", clean: false },
      ],
    }),
    ...overrides,
  });
}

// A review on its second pass, with one of two findings decided.
function reviewWith(overrides: Partial<ReviewSummary> = {}): ReviewSummary {
  return makeReviewSummary({
    sessionStatus: "waiting",
    status: "awaiting_decision",
    passes: [
      makeReviewPass({ pass: 1 }),
      makeReviewPass({
        pass: 2,
        findings: [
          makeReviewFinding({ number: 1, decision: "approved" }),
          makeReviewFinding({ number: 2, decision: "" }),
        ],
      }),
    ],
    ...overrides,
  });
}

function discussionWith(overrides: Partial<DiscussionSummary> = {}): DiscussionSummary {
  return makeDiscussion({ sessionStatus: "waiting", ...overrides });
}

const situation = (overrides: Partial<Situation>) =>
  makeSituation({ startedAt: TWO_HOURS_AGO, ...overrides });

const taskLine = (task: TaskSummary) => taskRow(makeState(), task, NOW).line2;

describe("the line 2 of a task with a situation", () => {
  it.each<[string, Partial<Situation>, Partial<TaskSummary>, string, string]>([
    [
      "a question in a stage",
      { kind: "question", place: STAGE_PLACE },
      {},
      "Question · Plan",
      "Question · Plan",
    ],
    [
      "a reply in a step",
      { kind: "reply", place: STEP_PLACE },
      {},
      "Reply · Implementer · Step 3/7",
      "Reply · Step 3/7",
    ],
    [
      "a permission to the reviewer",
      { kind: "permission", place: REVIEWER_PLACE },
      {},
      "Permission · Reviewer · Step 3/7",
      "Permission · Step 3/7",
    ],
    [
      "a session error on the PR before it opens",
      { kind: "session_error", group: "error", place: PR_PLACE },
      { pr: makePullRequest({ status: "drafting" }) },
      "Session error · PR",
      "Session error · PR",
    ],
    [
      "a session error on the PR review",
      { kind: "session_error", group: "error", place: PR_PLACE },
      {},
      "Session error · PR review · pass 2",
      "Session error · PR review · pass 2",
    ],
    [
      "a blocked step",
      { kind: "step_blocked", group: "error", place: STEP_PLACE },
      {
        steps: STEPS.map((step) =>
          step.number === 3
            ? {
                ...step,
                status: "blocked",
                block: { reason: "dirty_worktree", detail: "", files: 2 },
              }
            : step,
        ),
      },
      "Step 3/7 blocked · worktree not clean",
      "Step 3/7 blocked",
    ],
    [
      "an unreadable worktree",
      { kind: "worktree_unreadable", group: "error", place: STEP_PLACE },
      {},
      "Can't read worktree · Step 3/7",
      "Can't read worktree · Step 3/7",
    ],
    [
      "a plan still invalid",
      { kind: "plan_invalid", group: "error", place: STAGE_PLACE },
      {
        planProblems: [
          { file: "", message: "a" },
          { file: "", message: "b" },
        ],
      },
      "Plan still invalid · 2 problems",
      "Plan still invalid",
    ],
    [
      "a stage ready to continue",
      { kind: "ready_to_continue", place: STAGE_PLACE },
      {},
      "Ready to continue · Plan",
      "Ready to continue · Plan",
    ],
    [
      "a step to review",
      { kind: "step_review", form: "review", place: STEP_PLACE },
      {},
      "Review · Step 3/7",
      "Review · Step 3/7",
    ],
    [
      "a step being staged",
      { kind: "step_review", form: "staged", percent: 40, place: STEP_PLACE },
      {},
      "Review · Step 3/7 · 40% staged",
      "Review · Step 3/7",
    ],
    [
      "a step to approve",
      { kind: "step_review", form: "approve", place: STEP_PLACE },
      {},
      "Approve · Step 3/7",
      "Approve · Step 3/7",
    ],
    [
      "a step with no changes",
      { kind: "step_empty", place: STEP_PLACE },
      {},
      "No changes · Step 3/7",
      "No changes · Step 3/7",
    ],
    [
      "a blocked PR",
      { kind: "pr_blocked", group: "error", place: PR_PLACE },
      {
        pr: makePullRequest({
          status: "blocked",
          block: { reason: "gh_unauthenticated", detail: "" },
        }),
      },
      "PR blocked · gh not signed in",
      "PR blocked",
    ],
    ["a draft", { kind: "draft", place: PR_PLACE }, {}, "Draft to approve · PR", "Draft · PR"],
    [
      "findings to decide",
      { kind: "findings", place: PR_PLACE },
      {},
      "Decide findings · PR review · pass 2",
      "Decide findings · PR review",
    ],
    [
      "changes to review",
      { kind: "changes_review", form: "review", place: PR_PLACE },
      {},
      "Review changes · PR review",
      "Review changes · PR review",
    ],
    [
      "changes being staged",
      { kind: "changes_review", form: "staged", percent: 60, place: PR_PLACE },
      {},
      "Review changes · PR review · 60% staged",
      "Review changes · PR review",
    ],
    [
      "changes to approve",
      { kind: "changes_review", form: "approve", place: PR_PLACE },
      {},
      "Approve changes · PR review",
      "Approve changes · PR review",
    ],
    [
      "failed checks",
      { kind: "pr_trouble", group: "error", form: "checks", place: PR_PLACE },
      {},
      "Checks failed · PR #1279",
      "Checks failed · #1279",
    ],
    [
      "a conflict",
      { kind: "pr_trouble", group: "error", form: "conflict", place: PR_PLACE },
      {},
      "Conflict with base · PR #1279",
      "Conflict with base · #1279",
    ],
    [
      "failed checks and a conflict",
      { kind: "pr_trouble", group: "error", form: "checks_conflict", place: PR_PLACE },
      {},
      "Checks failed · conflict · PR #1279",
      "Checks failed · conflict · #1279",
    ],
    [
      "a PR closed unmerged",
      { kind: "pr_closed", group: "error", place: PR_PLACE },
      {},
      "PR closed unmerged · #1279",
      "PR closed unmerged · #1279",
    ],
    [
      "a PR ready to merge",
      { kind: "merge", group: "closing", form: "merge", place: PR_PLACE },
      {},
      "Ready to merge · PR #1279",
      "Ready to merge · #1279",
    ],
    [
      "a merged PR ready to close",
      { kind: "merge", group: "closing", form: "close", place: PR_PLACE },
      {},
      "Ready to close · PR #1279 merged",
      "Ready to close · #1279",
    ],
  ])("reads %s", (_case, fields, task, long, short) => {
    expect(taskLine(taskWith({ ...task, situations: [situation(fields)] }))).toEqual({
      long,
      short,
    });
  });
});

describe("the line 2 of a review with a situation", () => {
  it.each<[Partial<Situation>, string, string]>([
    [{ kind: "question", place: REVIEW_PLACE }, "Question · pass 2", "Question · pass 2"],
    [
      { kind: "review_report", form: "decide", place: REVIEW_PLACE },
      "Decide findings · pass 2 · 1 of 2",
      "Decide findings · 1/2",
    ],
    [
      { kind: "review_report", form: "publish", place: REVIEW_PLACE },
      "Ready to publish · pass 2",
      "Ready to publish · pass 2",
    ],
    [
      { kind: "review_report", form: "apply", place: REVIEW_PLACE },
      "Ready to apply · pass 2",
      "Ready to apply · pass 2",
    ],
    [
      { kind: "changes_review", form: "staged", percent: 25, place: REVIEW_PLACE },
      "Review changes · pass 2 · 25% staged",
      "Review changes · pass 2",
    ],
    [
      { kind: "pr_trouble", group: "error", form: "checks", place: REVIEW_PLACE },
      "Checks failed · pass 2",
      "Checks failed · pass 2",
    ],
    [
      { kind: "merge", group: "closing", form: "merge", place: REVIEW_PLACE },
      "Ready to merge · pass 2",
      "Ready to merge · pass 2",
    ],
    [{ kind: "new_commits", place: REVIEW_PLACE }, "New commits · pass 2", "New commits · pass 2"],
    [
      { kind: "pass_blocked", group: "error", place: REVIEW_PLACE },
      "Pass blocked · pass 2",
      "Pass blocked · pass 2",
    ],
    [
      { kind: "publish_failed", group: "error", place: REVIEW_PLACE },
      "Publish failed · pass 2",
      "Publish failed · pass 2",
    ],
  ])("reads %o as %s", (fields, long, short) => {
    expect(reviewRow(reviewWith({ situations: [situation(fields)] }), NOW).line2).toEqual({
      long,
      short,
    });
  });
});

describe("the line 2 of a discussion with a situation", () => {
  it.each<[Partial<Situation>, Partial<DiscussionSummary>, string, string]>([
    [{ kind: "reply", place: DISCUSSION_PLACE }, {}, "Reply · Discussing", "Reply · Discussing"],
    [
      { kind: "drafts", place: DISCUSSION_PLACE },
      {
        drafts: [
          makeDraft({ id: "a", decision: "approved" }),
          makeDraft({ id: "b" }),
          makeDraft({ id: "c" }),
        ],
      },
      "Decide drafts · 1 of 3",
      "Decide drafts · 1/3",
    ],
    [
      { kind: "publish_failed", group: "error", place: DISCUSSION_PLACE },
      {},
      "Publish failed",
      "Publish failed",
    ],
  ])("reads %o as %s", (fields, discussion, long, short) => {
    expect(
      discussionRow(discussionWith({ ...discussion, situations: [situation(fields)] }), NOW).line2,
    ).toEqual({
      long,
      short,
    });
  });
});

describe("a row with a situation", () => {
  const row = taskRow(
    makeState(),
    taskWith({
      situations: [
        situation({
          id: "later",
          kind: "question",
          place: STEP_PLACE,
          startedAt: THREE_MINUTES_AGO,
        }),
        situation({ id: "error", kind: "session_error", group: "error", place: REVIEWER_PLACE }),
        situation({ id: "draft", kind: "draft", place: PR_PLACE }),
      ],
    }),
    NOW,
  );

  it("speaks of the most severe situation, waiting, with the user's clock", () => {
    expect(row).toMatchObject({
      tone: "error",
      waiting: true,
      line2: { long: "Session error · Reviewer · Step 3/7" },
      clock: { kind: "chip", tone: "error", time: "2h", longTime: "2 hours" },
      situationIds: ["error", "draft", "later"],
    });
  });

  it("lists the others, the oldest first, behind +N", () => {
    expect(row.more).toEqual({
      count: 2,
      tooltip: "Draft to approve · PR · 2h, Question · Implementer · Step 3/7 · 3m",
    });
  });
});

describe("the line of an item without a situation", () => {
  const working = { sessionStatus: "working", turnRunning: true, turnStartedAt: THREE_MINUTES_AGO };
  const step = (status: string, fields = {}) =>
    STEPS.map((candidate) =>
      candidate.number === 3 ? { ...candidate, status, ...fields } : candidate,
    );

  it.each<[string, TaskSummary, RowTone, string, string, string | null]>([
    [
      "a planning stage with its agent working",
      taskWith({ stage: "plan", ...working }),
      "agent",
      "Plan",
      "Plan",
      "turn",
    ],
    [
      "a step the app prepares",
      taskWith({ steps: step("preparing") }),
      "app",
      "Step 3/7 · preparing the worktree",
      "Step 3/7 · preparing",
      null,
    ],
    [
      "a step being implemented",
      taskWith({ steps: step("implementing"), ...working }),
      "agent",
      "Step 3/7",
      "Step 3/7",
      "turn",
    ],
    [
      "a step on the reviewer's pass",
      taskWith({
        steps: step("agent_review", {
          reviewPass: 2,
          reviewer: makeStepReviewer({ sessionStatus: "working", turnRunning: true }),
        }),
      }),
      "agent",
      "Step 3/7 · Reviewer · pass 2",
      "Step 3/7 · pass 2",
      "turn",
    ],
    [
      "a step addressing the review",
      taskWith({ steps: step("addressing_review", { reviewRound: 1 }), ...working }),
      "agent",
      "Step 3/7 · Addressing review · round 1",
      "Step 3/7 · round 1",
      "turn",
    ],
    [
      "a step the app commits",
      taskWith({ steps: step("committing") }),
      "app",
      "Step 3/7 · committing",
      "Step 3/7 · committing",
      null,
    ],
    [
      "a PR the app prepares",
      taskWith({ stage: "pr", pr: makePullRequest({ status: "preparing" }) }),
      "app",
      "PR · preparing",
      "PR · preparing",
      null,
    ],
    [
      "a PR the app opens",
      taskWith({ stage: "pr", pr: makePullRequest({ status: "opening" }) }),
      "app",
      "PR · opening",
      "PR · opening",
      null,
    ],
    [
      "a PR being drafted",
      taskWith({
        stage: "pr",
        pr: makePullRequest({ status: "drafting", sessionStage: "pr", ...working }),
      }),
      "agent",
      "PR · drafting",
      "PR · drafting",
      "turn",
    ],
    [
      "a PR on its review pass",
      taskWith({
        stage: "pr",
        pr: makePullRequest({
          status: "reviewing",
          prNumber: 7,
          sessionStage: "pr_review",
          ...working,
        }),
      }),
      "agent",
      "PR review · pass 1",
      "PR review · pass 1",
      "turn",
    ],
    [
      "a PR committing the changes",
      taskWith({ stage: "pr", pr: makePullRequest({ status: "committing", prNumber: 7 }) }),
      "app",
      "PR review · committing",
      "PR review · committing",
      null,
    ],
    [
      "a PR waiting for the checks",
      taskWith({ stage: "pr", pr: makePullRequest({ status: "waiting_checks", prNumber: 7 }) }),
      "github",
      "PR review · waiting for checks",
      "PR review · checks",
      "word",
    ],
    [
      "a task the app closes",
      taskWith({ stage: "pr", pr: makePullRequest({ status: "closing", prNumber: 7 }) }),
      "app",
      "Closing",
      "Closing",
      null,
    ],
    [
      "a paused session",
      taskWith({ steps: step("implementing"), sessionStatus: "paused" }),
      "paused",
      "Paused · Step 3/7",
      "Paused · Step 3/7",
      null,
    ],
    ["an idle session", taskWith({ stage: "prd" }), "idle", "PRD", "PRD", "word"],
    [
      "a session stopped on an error",
      taskWith({ stage: "tech_spec", sessionStatus: "error" }),
      "idle",
      "Session stopped · Tech spec",
      "Session stopped · Tech spec",
      "word",
    ],
  ])("reads %s", (_case, task, tone, long, short, clock) => {
    const row = taskRow(makeState(), task, NOW);

    expect(row).toMatchObject({ tone, waiting: false, line2: { long, short } });
    expect(row.clock?.kind ?? null).toBe(clock);
  });

  it.each<[string, ReviewSummary, RowTone, string, string]>([
    [
      "a review with its pass running",
      reviewWith({ status: "reviewing", sessionStatus: "working" }),
      "agent",
      "Pass 2",
      "Pass 2",
    ],
    [
      "a review waiting for the checks",
      reviewWith({ status: "waiting_checks" }),
      "github",
      "Pass 2 · waiting for checks",
      "Pass 2 · checks",
    ],
    [
      "a review applying",
      reviewWith({ status: "applying", sessionStatus: "working" }),
      "agent",
      "Pass 2 · applying",
      "Pass 2 · applying",
    ],
    [
      "a review the app commits",
      reviewWith({ status: "committing" }),
      "app",
      "Pass 2 · committing",
      "Pass 2 · committing",
    ],
    [
      "a published review",
      reviewWith({ status: "published", passes: [makeReviewPass({ verdict: "request_changes" })] }),
      "idle",
      "Published · changes requested",
      "Published · changes requested",
    ],
  ])("reads %s", (_case, review, tone, long, short) => {
    expect(reviewRow(review, NOW)).toMatchObject({ tone, line2: { long, short } });
  });

  it.each<[string, DiscussionSummary, RowTone, string]>([
    [
      "a discussion with its agent working",
      discussionWith({ sessionStatus: "working" }),
      "agent",
      "Discussing",
    ],
    ["a discussion publishing", discussionWith({ status: "publishing" }), "app", "Publishing"],
    ["a quiet discussion", discussionWith({}), "idle", "Discussing"],
  ])("reads %s", (_case, discussion, tone, long) => {
    expect(discussionRow(discussion, NOW)).toMatchObject({ tone, line2: { long, short: long } });
  });

  it("shows a published discussion as ready to archive, with no clock and no wait", () => {
    expect(discussionRow(discussionWith({ status: "published" }), NOW)).toMatchObject({
      tone: "archive",
      waiting: false,
      line2: { long: "Ready to archive", short: "Ready to archive" },
      clock: null,
      situationIds: [],
    });
  });
});

describe("line 3", () => {
  const working = {
    sessionStatus: "working",
    turnRunning: true,
    turnStartedAt: THREE_MINUTES_AGO,
    contextPercent: 42,
  };

  it.each<[string, Partial<TaskSummary>, string, string]>([
    [
      "the action, verb first",
      { actionLabel: "Editing", actionTarget: "internal/api/ratelimit/limiter.go" },
      "Editing internal/api/ratelimit/limiter.go",
      "Editing …/limiter.go",
    ],
    ["thinking, with no action", {}, "Thinking…", "Thinking…"],
    ["a session starting", { turnRunning: false }, "Starting session…", "Starting session…"],
    ["a retry", { retryAttempt: 2 }, "Retrying · attempt 2", "Retrying · attempt 2"],
  ])("tells %s", (_case, fields, long, short) => {
    const row = taskRow(makeState(), taskWith({ stage: "plan", ...working, ...fields }), NOW);

    expect(row.line3).toEqual({ long, short, contextPercent: 42 });
  });

  it("follows the session in the oldest turn, with its clock", () => {
    const task = taskWith({
      ...working,
      actionLabel: "Reading",
      actionTarget: "a.go",
      steps: STEPS.map((step) =>
        step.number === 3
          ? {
              ...step,
              status: "agent_review",
              reviewer: makeStepReviewer({
                sessionStatus: "working",
                turnRunning: true,
                turnStartedAt: TWO_HOURS_AGO,
                actionLabel: "Running",
                actionTarget: "go test ./internal/api/ratelimit",
                contextPercent: 10,
              }),
            }
          : step,
      ),
    });

    expect(taskRow(makeState(), task, NOW)).toMatchObject({
      line3: {
        long: "Running go test ./internal/api/ratelimit",
        short: "Running go test …/ratelimit",
        contextPercent: 10,
      },
      clock: { kind: "turn", time: "2h", tooltip: "Agent working on this turn for 2 hours" },
    });
  });

  it("reads the action of an item that is not open from its summary", () => {
    const row = taskRow(
      makeState(),
      makeTask({ stage: "prd", ...working, actionLabel: "Writing", actionTarget: "PRD.md" }),
      NOW,
    );

    expect(row.line3).toEqual({
      long: "Writing PRD.md",
      short: "Writing PRD.md",
      contextPercent: 42,
    });
  });

  it("is null while the agent does not work", () => {
    expect(taskRow(makeState(), taskWith({ stage: "prd" }), NOW).line3).toBeNull();
  });
});

describe("the accessible name", () => {
  it("tells a task with situations, each with its time, then the position and the meta", () => {
    const task = taskWith({
      card: makeTaskCard({ number: 42 }),
      situations: [
        situation({ kind: "question", place: STEP_PLACE }),
        situation({ kind: "draft", place: PR_PLACE, startedAt: THREE_MINUTES_AGO }),
      ],
    });

    expect(taskRow(makeState(), task, NOW).label).toBe(
      "task add-login. waiting for you: Question · Implementer · Step 3/7, for 2 hours; waiting for you: Draft to approve · PR, for 3 minutes. Step 3/7. web#42.",
    );
  });

  it("tells a One-Shot task with its agent working", () => {
    const task = makeTask({
      mode: "one_shot",
      stage: "one_shot",
      sessionStatus: "working",
      turnRunning: true,
      turnStartedAt: THREE_MINUTES_AGO,
      contextPercent: 30,
      actionLabel: "Reading",
      actionTarget: "go.mod",
    });

    expect(taskRow(makeState(), task, NOW)).toMatchObject({
      itemKind: "one-shot",
      meta: "web · One-Shot",
      label:
        "One-Shot task add-login. agent working, Planning. Planning agent working for 3 minutes: Reading go.mod. context 30% used. web · One-Shot.",
    });
  });

  it("tells a review waiting on GitHub", () => {
    expect(reviewRow(reviewWith({ status: "waiting_checks" }), NOW).label).toBe(
      "pull request review Add the login screen. waiting on GitHub, Pass 2 · waiting for checks. web#31.",
    );
  });

  it("tells a discussion thinking", () => {
    const discussion = discussionWith({
      sessionStatus: "working",
      turnRunning: true,
      turnStartedAt: "2026-09-05T11:59:40Z",
      cards: [makeDiscussionCard({ number: 12 }), makeDiscussionCard({ number: 14 })],
    });

    expect(discussionRow(discussion, NOW).label).toBe(
      "discussion Invoices. agent working, Discussing. Discussion agent working for less than a minute: thinking. context 0% used. #12 #14.",
    );
  });

  it("tells a published discussion as ready to close", () => {
    expect(discussionRow(discussionWith({ status: "published", cards: [] }), NOW).label).toBe(
      "discussion Invoices. ready to close, Ready to archive.",
    );
  });
});

describe("shortAction", () => {
  it.each([
    ["Running", "go test ./internal/api/ratelimit", "go test …/ratelimit"],
    ["Running", "pnpm vitest run src/lib/a.test.ts", "pnpm vitest …/a.test.ts"],
    ["Running", "ls -la /tmp/x", "ls …/x"],
    ["Running", "make", "make"],
    ["Editing", "frontend/src/app.tsx", "…/app.tsx"],
    ["Searching", "TODO", "TODO"],
  ])("cuts %s %s to %s", (label, target, expected) => {
    expect(shortAction(label, target)).toBe(expected);
  });
});

describe("the severity", () => {
  it("ranks the tones from the error to the idle", () => {
    const tones: RowTone[] = ["idle", "github", "wait", "paused", "error", "agent", "close"];

    expect(tones.sort((a, b) => TONE_RANK[a] - TONE_RANK[b])).toEqual([
      "error",
      "wait",
      "close",
      "agent",
      "github",
      "paused",
      "idle",
    ]);
    expect(TONE_RANK.app).toBe(TONE_RANK.agent);
    expect(TONE_RANK.archive).toBe(TONE_RANK.idle);
  });
});

describe("nodeSummary", () => {
  const row = (tone: RowTone, id: string) => ({ tone, situationIds: [id] }) as ItemRow;

  it("counts each state from the most severe, the agent and the app together", () => {
    const rows = [
      row("wait", "a"),
      row("agent", "b"),
      row("error", "c"),
      row("wait", "d"),
      row("app", "e"),
      row("github", "f"),
      row("paused", "g"),
      row("close", "h"),
      row("idle", "i"),
      row("archive", "j"),
    ];

    expect(nodeSummary(rows)).toEqual({
      parts: [
        { tone: "error", count: 1 },
        { tone: "wait", count: 2 },
        { tone: "close", count: 1 },
        { tone: "agent", count: 2 },
        { tone: "github", count: 1 },
        { tone: "paused", count: 1 },
      ],
      word: "error",
      label: "1 error, 2 waiting, 1 ready to close, 2 working, 1 on GitHub, 1 paused",
      situationIds: ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j"],
    });
  });

  it.each<[RowTone[], string, string]>([
    [["error", "error"], "errors", "2 errors"],
    [["wait"], "waiting", "1 waiting"],
    [["close"], "to close", "1 ready to close"],
    [["app"], "working", "1 working"],
    [["github"], "checks", "1 on GitHub"],
    [["paused"], "paused", "1 paused"],
  ])("names %o by %s", (tones, word, label) => {
    expect(nodeSummary(tones.map((tone, index) => row(tone, `${index}`)))).toMatchObject({
      word,
      label,
    });
  });

  it("is null when nothing counts", () => {
    expect(nodeSummary([row("idle", "a"), row("archive", "b")])).toBeNull();
  });
});

describe("the tree", () => {
  const app = makeState({
    repositories: [
      makeRepository({ id: "repo-1", name: "web", fullName: "dev/web", boardId: "board-1" }),
      makeRepository({
        id: "repo-2",
        name: "api",
        fullName: "dev/api",
        boardId: "board-1",
        missing: true,
        path: "/src/api",
      }),
      makeRepository({
        id: "repo-3",
        name: "cli",
        fullName: "dev/cli",
        missing: true,
        path: "/src/cli",
      }),
      makeRepository({ id: "repo-4", name: "docs", fullName: "dev/docs" }),
    ],
    boards: [makeBoard({ id: "board-1", title: "Roadmap" })],
    tasks: [
      makeTask({ id: "loose", repositoryId: "repo-4", repository: "dev/docs" }),
      makeTask({
        id: "epic-a",
        card: makeTaskCard({
          epic: {
            key: "e1",
            repository: "dev/web",
            number: 9,
            title: "Billing",
            url: "",
            state: "open",
          },
        }),
      }),
      makeTask({ id: "plain" }),
      makeTask({ id: "api", repositoryId: "repo-2", repository: "dev/api" }),
    ],
    reviews: [reviewWith({ id: "review-1" })],
    discussions: [
      discussionWith({ id: "on-board", boardId: "board-1" }),
      discussionWith({ id: "orphan", boardId: "gone" }),
    ],
  });
  app.reviewCenter.pendingCount = 4;

  const shape = (filter: string) =>
    sidebarTree(app, filter, NOW).map((node) => ({
      id: node.id,
      notices: node.kind === "reviews" ? [] : node.notices.map((notice) => notice.id),
      epics:
        node.kind === "board"
          ? node.epics.map((epic) => [epic.id, epic.rows.map((row) => row.id)])
          : [],
      rows: node.rows.map((row) => row.id),
    }));

  it("orders Reviews, each board, then No board", () => {
    expect(shape(ALL_REPOSITORIES)).toEqual([
      { id: "reviews", notices: [], epics: [], rows: ["review-1"] },
      {
        id: "board:board-1",
        notices: ["notice:repo-2"],
        epics: [["epic:board-1:e1", ["epic-a"]]],
        rows: ["plain", "api", "on-board"],
      },
      { id: "no-board", notices: ["notice:repo-3"], epics: [], rows: ["loose", "orphan"] },
    ]);
  });

  it("keeps the tasks and the notices of the filter, and every review and discussion", () => {
    expect(shape("repo-2")).toEqual([
      { id: "reviews", notices: [], epics: [], rows: ["review-1"] },
      { id: "board:board-1", notices: ["notice:repo-2"], epics: [], rows: ["api", "on-board"] },
      { id: "no-board", notices: [], epics: [], rows: ["orphan"] },
    ]);
  });

  it("leaves No board out with nothing in it", () => {
    const quiet = { ...app, discussions: [], repositories: (app.repositories ?? []).slice(0, 2) };

    expect(sidebarTree(quiet, "repo-1", NOW).map((node) => node.id)).toEqual([
      "reviews",
      "board:board-1",
    ]);
  });

  it("tells the pending reviews and a missing clone", () => {
    const [reviews, board] = sidebarTree(app, ALL_REPOSITORIES, NOW);

    expect(reviews).toMatchObject({ pending: 4, reading: false, failures: [] });
    expect(board?.kind === "board" && board.notices[0]).toEqual({
      kind: "notice",
      id: "notice:repo-2",
      repositoryId: "repo-2",
      text: "api · clone missing",
      label: "dev/api: the clone at /src/api is missing. Enter to change the path.",
      tooltip: "The clone at /src/api is missing",
    });
  });

  it("walks the visible lines, skipping what collapsed nodes hold", () => {
    const nodes = sidebarTree(app, ALL_REPOSITORIES, NOW);
    const lines = (collapsed: string[]) =>
      visibleEntries(nodes, new Set(collapsed)).map((entry) => [
        entry.id,
        entry.level,
        entry.parentId,
      ]);

    expect(lines(["reviews", "epic:board-1:e1", "no-board"])).toEqual([
      ["reviews", 1, null],
      ["board:board-1", 1, null],
      ["notice:repo-2", 2, "board:board-1"],
      ["epic:board-1:e1", 2, "board:board-1"],
      ["plain", 2, "board:board-1"],
      ["api", 2, "board:board-1"],
      ["on-board", 2, "board:board-1"],
      ["no-board", 1, null],
    ]);
    expect(lines(["board:board-1"]).slice(1, 3)).toEqual([
      ["review-1", 2, "reviews"],
      ["board:board-1", 1, null],
    ]);
    expect(lines([]).find((line) => line[0] === "epic-a")).toEqual([
      "epic-a",
      3,
      "epic:board-1:e1",
    ]);
  });

  it("lists every row in tree order, collapsed or not", () => {
    expect(allRows(sidebarTree(app, ALL_REPOSITORIES, NOW)).map((row) => row.id)).toEqual([
      "review-1",
      "epic-a",
      "plain",
      "api",
      "on-board",
      "loose",
      "orphan",
    ]);
  });

  it.each([
    ["epic-a", ["board:board-1", "epic:board-1:e1"]],
    ["on-board", ["board:board-1"]],
    ["review-1", ["reviews"]],
    ["orphan", ["no-board"]],
    ["nothing", []],
  ])("finds the nodes holding %s", (id, expected) => {
    expect(nodesOfItem(sidebarTree(app, ALL_REPOSITORIES, NOW), id)).toEqual(expected);
  });

  it.each([
    [ALL_REPOSITORIES, null],
    ["repo-1", null],
    ["repo-3", "No tasks in cli."],
  ])("says of the filter %s: %s", (filter, expected) => {
    expect(emptyTreeText(app, filter)).toBe(expected);
  });
});

describe("flashOf", () => {
  const waiting = situation({ id: "reply", group: "waiting" });
  const closing = situation({ id: "close", group: "closing", kind: "close" });
  const failed = situation({ id: "failed", group: "error", kind: "session_error" });
  const row = (situations: Situation[]) => taskRow(makeState(), taskWith({ situations }), NOW);

  it.each([
    ["nothing when none of the situations blinks", [waiting], [], null],
    ["the wait veil for a waiting situation", [waiting], ["reply"], "wait"],
    ["the wait veil for a closing situation", [closing], ["close"], "wait"],
    [
      "the error veil when an error blinks among others",
      [waiting, failed],
      ["reply", "failed"],
      "error",
    ],
    ["only the veil of what blinks", [waiting, failed], ["reply"], "wait"],
  ] as const)("gives %s", (_, situations, flashing, flash) => {
    expect(flashOf([row([...situations])], new Set(flashing))).toBe(flash);
  });
});
