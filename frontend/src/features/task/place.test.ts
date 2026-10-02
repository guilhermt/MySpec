import { describe, expect, it } from "vitest";
import type { MarkerView } from "@/features/chat/markers";
import {
  type FixedCard,
  hasComposer,
  hasReviewConversation,
  type PlaceView,
  prFixedCardOf,
  prPlaceOf,
  stepFixedCardOf,
  stepPlaceOf,
} from "@/features/task/place";
import type { PullRequest, Step, TaskSummary } from "@/lib/wails";
import {
  makePRCheck,
  makePRReport,
  makePullRequest,
  makeReviewFinding,
  makeStep,
  makeTask,
  makeTaskConversation,
} from "@/test/wails-mock";

/** inStep is a task of seven steps whose fifth runs, in the given state. */
function inStep(step: Partial<Step>, task: Partial<TaskSummary> = {}): TaskSummary {
  return makeTask({
    repository: "acme/api",
    stage: "implementation",
    currentStep: 5,
    steps: Array.from({ length: 7 }, (_, index) =>
      index === 4
        ? makeStep({ number: 5, title: "Throttle the metrics endpoint", ...step })
        : makeStep({ number: index + 1, status: index < 4 ? "done" : "not_started" }),
    ),
    ...task,
  });
}

/** oneShot is a One-Shot task whose implementation is in the given state. */
function oneShot(step: Partial<Step>): TaskSummary {
  return makeTask({
    name: "rate-limit-per-api-key",
    repository: "acme/api",
    mode: "one_shot",
    stage: "implementation",
    currentStep: 1,
    steps: [makeStep({ number: 1, ...step })],
  });
}

/** empty is the expected empty place: its title and body, and whatever else differs from a bare one. */
function empty(
  title: string,
  body: string,
  rest: {
    checks?: boolean;
    endLine?: MarkerView | null;
    error?: { explanation: string; detail: string };
  } = {},
): PlaceView {
  return { kind: "empty", title, body, checks: false, endLine: null, ...rest };
}

const nextLine = (text: string, complement: string): MarkerView => ({
  icon: "start",
  text,
  complement,
  body: { kind: "none" },
  timeHidden: false,
});

const DIRTY = { reason: "dirty_worktree", detail: " M go.mod\n?? tmp/", files: 2 };

describe("stepPlaceOf", () => {
  it.each<[string, TaskSummary, PlaceView]>([
    [
      "a step not started",
      inStep({ status: "not_started" }),
      { kind: "activity", text: "Starting step 5…" },
    ],
    [
      "the implementation of a One-Shot task not started",
      oneShot({ status: "not_started" }),
      { kind: "activity", text: "Starting the implementation…" },
    ],
    [
      "a step fetching origin",
      inStep({ status: "preparing", phase: "fetching" }),
      { kind: "activity", text: "Fetching origin…" },
    ],
    [
      "a step creating its worktree",
      inStep({ status: "preparing", phase: "creating" }),
      { kind: "activity", text: "Creating the worktree…" },
    ],
    [
      "a step checking its worktree",
      inStep({ status: "preparing", phase: "checking" }),
      { kind: "activity", text: "Checking the worktree…" },
    ],
    [
      "a step preparing without a phase",
      inStep({ status: "preparing" }),
      { kind: "activity", text: "Preparing the worktree…" },
    ],
    [
      "a step done before the next",
      inStep({ status: "done" }),
      { kind: "activity", text: "Starting the next step…" },
    ],
    [
      "a step blocked",
      inStep({ status: "blocked", block: DIRTY }),
      {
        kind: "blocked",
        line: nextLine("Step 5 is next", "Throttle the metrics endpoint"),
        explanation:
          "2 changed files in the worktree. Clean it yourself and try again, or let the app discard every change and start the step.",
        detail: " M go.mod\n?? tmp/",
      },
    ],
    [
      "the implementation of a One-Shot task blocked",
      oneShot({ status: "blocked", block: DIRTY }),
      {
        kind: "blocked",
        line: nextLine("Implementation is next", "rate-limit-per-api-key"),
        explanation:
          "2 changed files in the worktree. Clean it yourself and try again, or let the app discard every change and start the step.",
        detail: " M go.mod\n?? tmp/",
      },
    ],
    [
      "every step committed, before the PR",
      inStep({ status: "done" }, { currentStep: 0 }),
      empty("Every step is committed", "7 steps in acme/api. The pull request stage starts next."),
    ],
    [
      "the implementation of a One-Shot task committed",
      { ...oneShot({ status: "done" }), currentStep: 0 },
      empty("The implementation is committed", "acme/api. The pull request stage starts next."),
    ],
    [
      "an implementation without steps",
      makeTask({ stage: "implementation", steps: [] }),
      empty("No steps were found", "The plan has no step files."),
    ],
    ["a step with its conversation", inStep({ status: "implementing" }), { kind: "conversation" }],
  ])("shows %s", (_, task, expected) => {
    expect(stepPlaceOf(task)).toEqual(expected);
  });
});

describe("prPlaceOf", () => {
  const task = makeTask({ repository: "acme/api", stage: "pr" });
  const pr = (fields: Partial<PullRequest>) =>
    makePullRequest({ prNumber: 1284, prBase: "dev", ...fields });
  const merged: MarkerView = {
    icon: "merge",
    text: "Merged #1284 into dev",
    complement: "by lnakamura",
    body: { kind: "none" },
    timeHidden: false,
  };
  const closed: MarkerView = { ...merged, text: "Closed #1284 without a merge", complement: "" };
  const checks = [
    makePRCheck({ name: "unit", state: "passed" }),
    makePRCheck({ name: "e2e / chromium", state: "running" }),
    makePRCheck({ name: "preview-deploy", state: "queued" }),
  ];

  it.each<[string, PullRequest, boolean, PlaceView]>([
    [
      "the PR preparing",
      pr({ status: "preparing", prNumber: 0 }),
      false,
      { kind: "activity", text: "Preparing the pull request…" },
    ],
    [
      "the PR blocked",
      pr({ status: "blocked", block: { reason: "gh_unauthenticated", detail: "not logged in" } }),
      false,
      empty("The pull request stage stopped", "", {
        error: {
          explanation: "Run `gh auth login` in a terminal, then try again.",
          detail: "not logged in",
        },
      }),
    ],
    ["the PR opening", pr({ status: "opening", prNumber: 0 }), false, { kind: "conversation" }],
    [
      "the checks before the first pass",
      pr({ status: "waiting_checks", checks, checkedAt: "2026-09-28T17:30:00Z" }),
      false,
      empty(
        "The review starts when the checks finish.",
        "MySpec reads #1284 every minute. The first pass begins once e2e / chromium and preview-deploy are done.",
        { checks: true },
      ),
    ],
    [
      "the checks before the first pass, one left",
      pr({
        status: "waiting_checks",
        checks: checks.slice(0, 2),
        checkedAt: "2026-09-28T17:30:00Z",
      }),
      false,
      empty(
        "The review starts when the checks finish.",
        "MySpec reads #1284 every minute. The first pass begins once e2e / chromium is done.",
        { checks: true },
      ),
    ],
    [
      "the checks before the first reading",
      pr({ status: "waiting_checks" }),
      false,
      empty("The review starts when the checks finish.", "MySpec reads #1284 every minute.", {
        checks: true,
      }),
    ],
    [
      "the checks from the second pass on",
      pr({ status: "waiting_checks", checks }),
      true,
      { kind: "conversation" },
    ],
    [
      "the review done",
      pr({ status: "done", prState: "open" }),
      true,
      { kind: "closedReview", endLine: null },
    ],
    [
      "the review in trouble",
      pr({ status: "trouble", prState: "open" }),
      true,
      { kind: "closedReview", endLine: null },
    ],
    [
      "the pull request merged",
      pr({ status: "merged", prState: "merged", mergedBy: "lnakamura" }),
      true,
      { kind: "closedReview", endLine: merged },
    ],
    [
      "the pull request closed without a merge",
      pr({ status: "pr_closed", prState: "closed" }),
      true,
      { kind: "closedReview", endLine: closed },
    ],
    [
      "the pull request merged before the first pass",
      pr({ status: "merged", prState: "merged", mergedBy: "lnakamura" }),
      false,
      empty("The pull request was merged before the first review pass.", "", { endLine: merged }),
    ],
    [
      "the pull request closed before the first pass",
      pr({ status: "pr_closed", prState: "closed" }),
      false,
      empty("The pull request was closed without a merge before the first review pass.", "", {
        endLine: closed,
      }),
    ],
    [
      "the task closing",
      pr({ status: "closing", prState: "merged" }),
      true,
      { kind: "activity", text: "Closing the task…" },
    ],
    [
      "the task closed",
      pr({ status: "closed", prState: "merged", mergedBy: "lnakamura" }),
      true,
      { kind: "closedReview", endLine: merged },
    ],
    [
      "the review done with every finding discarded",
      pr({
        status: "done",
        prState: "open",
        currentPass: 1,
        reports: [makePRReport({ findings: [makeReviewFinding({ decision: "discarded" })] })],
      }),
      true,
      { kind: "conversation" },
    ],
    [
      "the review in trouble with every finding discarded",
      pr({
        status: "trouble",
        prState: "open",
        currentPass: 1,
        reports: [makePRReport({ findings: [makeReviewFinding({ decision: "discarded" })] })],
      }),
      true,
      { kind: "conversation" },
    ],
    ["the draft", pr({ status: "draft_ready", prNumber: 0 }), false, { kind: "conversation" }],
    ["a pass of the review", pr({ status: "reviewing" }), true, { kind: "conversation" }],
  ])("shows %s", (_, pullRequest, hasReviewConversation, expected) => {
    expect(prPlaceOf(task, pullRequest, hasReviewConversation)).toEqual(expected);
  });
});

describe("hasComposer", () => {
  it.each<[string, PlaceView, boolean]>([
    ["a conversation", { kind: "conversation" }, true],
    ["an activity", { kind: "activity", text: "Starting step 5…" }, false],
    [
      "a step blocked",
      {
        kind: "blocked",
        line: {
          icon: "start",
          text: "Step 5 is next",
          complement: "",
          body: { kind: "none" },
          timeHidden: false,
        },
        explanation: "",
        detail: "",
      },
      false,
    ],
    ["an empty place", empty("No steps were found", "The plan has no step files."), false],
    ["the closed review", { kind: "closedReview", endLine: null }, false],
  ])("answers for %s", (_, view, expected) => {
    expect(hasComposer(view)).toBe(expected);
  });
});

describe("hasReviewConversation", () => {
  it("is the conversation of the review listed among the conversations of the task", () => {
    const listed = makeTask({
      conversations: [
        makeTaskConversation({ stage: "pr" }),
        makeTaskConversation({ stage: "pr_review" }),
      ],
    });
    const unlisted = makeTask({ conversations: [makeTaskConversation({ stage: "pr" })] });

    expect(hasReviewConversation(listed)).toBe(true);
    expect(hasReviewConversation(unlisted)).toBe(false);
    expect(hasReviewConversation(makeTask({ conversations: null }))).toBe(false);
  });
});

describe("stepFixedCardOf", () => {
  it.each<[string, FixedCard | null]>([
    ["implementing", null],
    ["agent_review", null],
    ["addressing_review", null],
    ["awaiting_review", "files"],
    ["in_review", "files"],
    ["ready_to_approve", "files"],
    ["review_failed", "files"],
    ["committing", "files"],
    ["nothing_to_commit", null],
  ])("gives a step %s the card %s", (status, expected) => {
    expect(stepFixedCardOf(makeStep({ status }))).toBe(expected);
  });
});

describe("prFixedCardOf", () => {
  const DRAFT = { title: "Add login", body: "The login page.", file: "draft.md" };

  it.each<[string, Partial<PullRequest>, FixedCard | null]>([
    ["the draft being written", { status: "drafting", draft: null }, null],
    ["the draft ready", { status: "draft_ready", draft: DRAFT }, "draft"],
    ["the draft an opening that failed left", { status: "awaiting_reply", draft: DRAFT }, "draft"],
    [
      "a reply the review waits for",
      { status: "awaiting_reply", draft: DRAFT, prNumber: 12 },
      null,
    ],
    ["the opening", { status: "opening", draft: DRAFT }, null],
    ["a pass of the review", { status: "reviewing", prNumber: 12 }, null],
    ["the findings to decide", { status: "awaiting_decision", prNumber: 12 }, null],
    ["the changes to review", { status: "in_review", prNumber: 12 }, "files"],
    ["the changes ready to approve", { status: "ready_to_approve", prNumber: 12 }, "files"],
    ["the commit of the changes", { status: "committing", prNumber: 12 }, "files"],
    ["a later pass waiting for the checks", { status: "waiting_checks", prNumber: 12 }, "checks"],
  ])("gives %s its card", (_, fields, expected) => {
    expect(prFixedCardOf(makePullRequest(fields))).toBe(expected);
  });
});
