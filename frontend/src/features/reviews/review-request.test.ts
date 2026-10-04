import { describe, expect, it } from "vitest";
import {
  hasReviewComposer,
  type ReviewRequestModel,
  reviewAnnouncement,
  reviewChecks,
  reviewComposerContext,
  reviewRequestOf,
} from "@/features/reviews/review-request";
import type { ReviewSummary, Situation } from "@/lib/wails";
import {
  makePRCheck,
  makeReview,
  makeReviewFinding,
  makeReviewPass,
  makeReviewSummary,
  makeSituation,
} from "@/test/wails-mock";

const NOW = Date.parse("2026-09-27T15:00:00Z");
const NINE_MINUTES_AGO = new Date(NOW - 9 * 60_000).toISOString();
const REVIEW_PLACE = { kind: "review", stage: "review", step: 0 };

function situation(kind: string, group = "waiting", form = ""): Situation {
  return makeSituation({
    id: `s-${kind}`,
    taskId: "review-1",
    kind,
    group,
    form,
    place: REVIEW_PLACE,
    startedAt: NINE_MINUTES_AGO,
  });
}

// A review at rest on its first pass, recorded with three findings.
function review(overrides: Partial<ReviewSummary> = {}): ReviewSummary {
  return makeReviewSummary({
    sessionStatus: "waiting",
    turnRunning: false,
    processRunning: false,
    passes: [
      makeReviewPass({
        findings: [
          makeReviewFinding({ number: 1, decision: "approved" }),
          makeReviewFinding({ number: 2 }),
          makeReviewFinding({ number: 3 }),
        ],
      }),
    ],
    ...overrides,
  });
}

// waiting is a review waiting on its situation.
function waiting(found: Situation, overrides: Partial<ReviewSummary> = {}): ReviewSummary {
  return review({ situations: [found], ...overrides });
}

const decided = (decisions: string[]) =>
  makeReviewPass({
    findings: decisions.map((decision, index) =>
      makeReviewFinding({ number: index + 1, decision }),
    ),
  });

const WAIT = { short: "9m", long: "9 minutes", tone: "wait" } as const;
const ERROR = { short: "9m", long: "9 minutes", tone: "error" } as const;

const NEXT_TO_DECIDE = {
  action: "nextToDecide",
  label: "Next to decide",
  variant: "secondary",
  shortcut: "Alt ↓",
  tooltip: "The next finding to decide",
  loadingLabel: "",
} as const;

// The pass of these cases has 1 of 3 findings decided.
const APPROVE_REST = {
  action: "approveRest",
  label: "Approve the rest",
  variant: "secondary",
  tooltip: "Approve the 2 findings not decided yet",
  loadingLabel: "Approving…",
} as const;

const PUBLISH = {
  action: "publish",
  label: "Publish review…",
  variant: "primary",
  shortcut: "Ctrl ↵",
  loadingLabel: "",
} as const;

const REVIEW_AGAIN = {
  action: "reviewAgain",
  label: "Review again…",
  variant: "primary",
  loadingLabel: "",
} as const;

describe("reviewRequestOf, the situations of the review", () => {
  it.each<[string, ReviewSummary, ReviewRequestModel]>([
    [
      "findings to decide",
      waiting(situation("review_report", "waiting", "decide")),
      {
        form: "decision",
        glyph: "wait",
        label: "Decide findings",
        place: "pass 1",
        time: WAIT,
        progress: "1 of 3 decided",
        status: "Decide findings · pass 1",
        actions: [
          NEXT_TO_DECIDE,
          APPROVE_REST,
          {
            action: "publish",
            label: "Publish review…",
            variant: "primary",
            loadingLabel: "",
            shortcut: "Ctrl ↵",
            disabledReason: "Decide 2 more",
          },
        ],
        situationId: "s-review_report",
        focus: "finding",
      },
    ],
    [
      "findings to decide in apply mode, after new commits",
      waiting(situation("review_report", "waiting", "decide"), {
        mode: "apply",
        stalePass: true,
        staleCommits: 2,
      }),
      {
        form: "decision",
        glyph: "wait",
        label: "Decide findings",
        place: "pass 1",
        time: WAIT,
        progress: "1 of 3 decided · 2 commits arrived after this pass",
        status: "Decide findings · pass 1",
        actions: [
          NEXT_TO_DECIDE,
          APPROVE_REST,
          {
            action: "apply",
            label: "Apply approved",
            variant: "primary",
            loadingLabel: "Sending…",
            disabledReason: "Decide 2 more",
          },
        ],
        situationId: "s-review_report",
        focus: "finding",
      },
    ],
    [
      "a report ready to publish, after commits it can't count",
      waiting(situation("review_report", "waiting", "publish"), {
        passes: [decided(["approved", "approved", "discarded"])],
        stalePass: true,
        staleCommits: -1,
      }),
      {
        form: "decision",
        glyph: "wait",
        label: "Ready to publish",
        place: "pass 1",
        time: WAIT,
        progress: "2 approved · 1 discarded · commits arrived after this pass",
        status: "Ready to publish · pass 1",
        actions: [PUBLISH],
        situationId: "s-review_report",
        focus: "primary",
      },
    ],
    [
      "a clean pass ready to publish",
      waiting(situation("review_report", "waiting", "publish"), {
        passes: [makeReviewPass({ clean: true, findings: [] })],
      }),
      {
        form: "decision",
        glyph: "wait",
        label: "Ready to publish",
        place: "pass 1",
        time: WAIT,
        progress: "A clean pass",
        status: "Ready to publish · pass 1",
        actions: [PUBLISH],
        situationId: "s-review_report",
        focus: "primary",
      },
    ],
    [
      "a publication that failed",
      waiting(situation("publish_failed", "error"), {
        publishError: "Couldn't publish to GitHub: the review has no body.",
      }),
      {
        form: "error",
        glyph: "error",
        label: "Publish failed",
        place: "pass 1",
        time: ERROR,
        progress: "Couldn't publish to GitHub: the review has no body.",
        status: "Publish failed · pass 1",
        actions: [PUBLISH],
        situationId: "s-publish_failed",
        focus: "primary",
      },
    ],
    [
      "a report ready to apply",
      waiting(situation("review_report", "waiting", "apply"), {
        mode: "apply",
        passes: [decided(["approved", "approved", "discarded"])],
      }),
      {
        form: "decision",
        glyph: "wait",
        label: "Ready to apply",
        place: "pass 1",
        time: WAIT,
        progress: "2 approved findings go to the agent",
        status: "Ready to apply · pass 1",
        actions: [
          {
            action: "apply",
            label: "Apply approved",
            variant: "primary",
            loadingLabel: "Sending…",
          },
        ],
        situationId: "s-review_report",
        focus: "primary",
      },
    ],
    [
      "changes to review, the last approval without a commit",
      waiting(situation("changes_review", "waiting", "staged"), {
        mode: "apply",
        review: makeReview({ staged: 3, total: 5, percent: 60 }),
        commitFailed: true,
      }),
      {
        form: "tinted",
        glyph: "wait",
        label: "Review changes",
        place: "pass 1",
        time: WAIT,
        progress: "3 of 5 files staged · the last approval didn't produce a commit",
        status: "Review changes · pass 1",
        actions: [
          {
            action: "openInEditor",
            label: "Open in VS Code",
            variant: "secondary",
            shortcut: "Ctrl E",
            loadingLabel: "",
          },
          {
            action: "approve",
            label: "Approve",
            variant: "primary",
            loadingLabel: "Approving…",
            disabledReason: "Stage 2 more files",
          },
        ],
        situationId: "s-changes_review",
        focus: "primary",
      },
    ],
    [
      "changes to approve",
      waiting(situation("changes_review", "waiting", "approve"), {
        mode: "apply",
        review: makeReview({ staged: 2, total: 2, percent: 100 }),
      }),
      {
        form: "tinted",
        glyph: "wait",
        label: "Approve changes",
        place: "pass 1",
        time: WAIT,
        progress: "2 of 2 files staged",
        status: "Approve changes · pass 1",
        actions: [
          {
            action: "openInEditor",
            label: "Open in VS Code",
            variant: "secondary",
            shortcut: "Ctrl E",
            loadingLabel: "",
          },
          { action: "approve", label: "Approve", variant: "primary", loadingLabel: "Approving…" },
        ],
        situationId: "s-changes_review",
        focus: "primary",
      },
    ],
    [
      "a pull request ready to merge",
      waiting(situation("merge", "closing", "merge"), {
        mode: "apply",
        number: 2288,
        passes: [decided(["discarded"])],
      }),
      {
        form: "tinted",
        glyph: "close",
        label: "Ready to merge",
        place: "web#2288",
        time: { short: "9m", long: "9 minutes", tone: "close" },
        progress: "Nothing approved in pass 1",
        status: "Ready to merge · web#2288",
        actions: [{ action: "openPR", label: "Open PR", variant: "secondary", loadingLabel: "" }],
        situationId: "s-merge",
        focus: "primary",
      },
    ],
    [
      "new commits after the publication",
      waiting(situation("new_commits"), {
        newCommits: 3,
        checks: [makePRCheck({ name: "lint" }), makePRCheck({ name: "unit" })],
        mergeable: "mergeable",
        checkedAt: NINE_MINUTES_AGO,
      }),
      {
        form: "tinted",
        glyph: "wait",
        label: "New commits",
        place: "3 since pass 1",
        time: WAIT,
        progress: "Checks 2 of 2 passed · merges clean",
        status: "New commits · 3 since pass 1",
        actions: [REVIEW_AGAIN],
        situationId: "s-new_commits",
        focus: "primary",
      },
    ],
    [
      "new commits it can't count",
      waiting(situation("new_commits"), { newCommits: -1 }),
      {
        form: "tinted",
        glyph: "wait",
        label: "New commits since pass 1",
        time: WAIT,
        progress: "Checks not read yet",
        status: "New commits since pass 1",
        actions: [REVIEW_AGAIN],
        situationId: "s-new_commits",
        focus: "primary",
      },
    ],
    [
      "checks that failed and a conflict",
      waiting(situation("pr_trouble", "error", "checks_conflict"), {
        trouble: { failedChecks: ["e2e"], conflict: true },
      }),
      {
        form: "error",
        glyph: "error",
        label: "Checks failed · conflict",
        place: "pass 1",
        time: ERROR,
        progress: "Checks failed: e2e · conflict with dev",
        status: "Checks failed · conflict · pass 1",
        actions: [
          {
            ...REVIEW_AGAIN,
            tooltip: "Review again reads GitHub and turns this into findings of a new pass.",
          },
        ],
        situationId: "s-pr_trouble",
        focus: "primary",
      },
    ],
    [
      "a pass blocked",
      waiting(situation("pass_blocked", "error"), {
        status: "pass_blocked",
        passes: [makeReviewPass(), makeReviewPass({ pass: 2, recorded: false, findings: [] })],
        passBlocked: "GitHub didn't answer.",
      }),
      {
        form: "error",
        glyph: "error",
        label: "Pass blocked",
        place: "pass 2",
        time: ERROR,
        progress: "GitHub didn't answer.",
        status: "Pass blocked · pass 2",
        actions: [REVIEW_AGAIN],
        situationId: "s-pass_blocked",
        focus: "primary",
      },
    ],
  ])("draws %s", (_, found, bar) => {
    expect(reviewRequestOf(found, NOW, null)).toEqual(bar);
  });
});

describe("reviewRequestOf, Approve the rest", () => {
  const actionsOf = (found: ReviewSummary) =>
    reviewRequestOf(found, NOW, null)?.actions.map((button) => button.action);

  it("is on the bar of the findings to decide, in either mode, before the primary", () => {
    const decide = situation("review_report", "waiting", "decide");

    expect(actionsOf(waiting(decide))).toEqual(["nextToDecide", "approveRest", "publish"]);
    expect(actionsOf(waiting(decide, { mode: "apply" }))).toEqual([
      "nextToDecide",
      "approveRest",
      "apply",
    ]);
  });

  it("says the one finding it approves in the singular", () => {
    const found = waiting(situation("review_report", "waiting", "decide"), {
      passes: [decided(["approved", "discarded", ""])],
    });

    expect(reviewRequestOf(found, NOW, null)?.actions[1]?.tooltip).toBe(
      "Approve the 1 finding not decided yet",
    );
  });

  it.each([
    [
      "ready to publish",
      waiting(situation("review_report", "closing", "publish"), {
        passes: [decided(["approved"])],
      }),
    ],
    [
      "ready to apply",
      waiting(situation("review_report", "waiting", "apply"), {
        mode: "apply",
        passes: [decided(["approved"])],
      }),
    ],
    ["the changes to approve", waiting(situation("changes_review", "waiting", "approve"))],
    [
      "the findings to decide with every finding decided",
      waiting(situation("review_report", "waiting", "decide"), {
        passes: [decided(["approved", "discarded"])],
      }),
    ],
  ])("is not on the bar of %s", (_, found) => {
    expect(actionsOf(found)).not.toContain("approveRest");
  });
});

describe("reviewRequestOf, the situations of the conversation", () => {
  const asked = { status: "awaiting_reply", passes: [makeReviewPass({ recorded: false })] };

  it.each<[string, ReviewSummary, ReviewRequestModel]>([
    [
      "the report it waits for, with why it can't be read",
      waiting(situation("reply"), {
        ...asked,
        unreadableReport: "The report can't be read: finding 2 does not open with its location.",
      }),
      {
        form: "tinted",
        glyph: "wait",
        label: "Waiting for the report",
        place: "pass 1",
        time: WAIT,
        progress: "The report can't be read: finding 2 does not open with its location.",
        progressTooltip: "The report can't be read: finding 2 does not open with its location.",
        status: "Waiting for the report · pass 1",
        actions: [],
        situationId: "s-reply",
        focus: "composer",
      },
    ],
    [
      "a question",
      waiting(situation("question"), asked),
      {
        form: "quiet",
        glyph: "wait",
        label: "Question",
        place: "pass 1",
        time: WAIT,
        progress: "2 questions",
        status: "Question · pass 1",
        actions: [{ action: "show", label: "Show", variant: "secondary", loadingLabel: "" }],
        situationId: "s-question",
        focus: "question",
      },
    ],
    [
      "a session that stopped",
      waiting(situation("session_error", "error"), { lastError: "claude exited with status 1" }),
      {
        form: "error",
        glyph: "error",
        label: "Session error",
        place: "pass 1",
        time: ERROR,
        status: "Session error · pass 1",
        actions: [
          {
            action: "retrySession",
            label: "Retry reviewer",
            variant: "primary",
            loadingLabel: "Retrying…",
            stage: "review",
          },
        ],
        situationId: "s-session_error",
        focus: "primary",
      },
    ],
  ])("draws %s", (_, found, bar) => {
    expect(reviewRequestOf(found, NOW, { kind: "question", questions: 2 })).toEqual(bar);
  });
});

describe("reviewRequestOf, paused and at rest", () => {
  it("draws the bar of the state, quiet, without a chip, while paused", () => {
    const paused = review({
      status: "awaiting_decision",
      sessionStatus: "paused",
      situations: [situation("question")],
    });

    expect(reviewRequestOf(paused, NOW, null)).toEqual({
      form: "quiet",
      glyph: "paused",
      label: "Decide findings",
      place: "pass 1",
      progress: "1 of 3 decided",
      status: "Decide findings · pass 1",
      actions: [
        NEXT_TO_DECIDE,
        APPROVE_REST,
        {
          action: "publish",
          label: "Publish review…",
          variant: "primary",
          loadingLabel: "",
          shortcut: "Ctrl ↵",
          disabledReason: "Decide 2 more",
        },
      ],
      situationId: null,
      focus: "finding",
    });
  });

  it.each<[string, Partial<ReviewSummary>]>([
    ["paused while the pass runs", { status: "reviewing", sessionStatus: "paused" }],
    ["waiting for the checks", { status: "waiting_checks" }],
    ["published", { status: "published" }],
  ])("draws nothing %s", (_, overrides) => {
    expect(reviewRequestOf(review(overrides), NOW, null)).toBeNull();
  });
});

describe("reviewAnnouncement", () => {
  it.each<[string, ReviewSummary, string]>([
    [
      "findings to decide",
      waiting(situation("review_report", "waiting", "decide"), { number: 2291 }),
      "web#2291: waiting for you: decide findings in pass 1",
    ],
    [
      "a publication that failed",
      waiting(situation("publish_failed", "error"), { number: 2291 }),
      "web#2291: error: publish failed in pass 1",
    ],
    [
      "new commits it can't count, whose label names the pass",
      waiting(situation("new_commits"), { number: 2291, newCommits: -1 }),
      "web#2291: waiting for you: new commits since pass 1",
    ],
  ])("says %s", (_, found, text) => {
    const request = reviewRequestOf(found, NOW, null);

    expect(request).not.toBeNull();
    expect(request === null ? "" : reviewAnnouncement(found, request)).toBe(text);
  });
});

describe("reviewComposerContext", () => {
  it.each<[string, Partial<ReviewSummary>, { askForChange: boolean; reviseFindings: boolean }]>([
    ["a pass with findings to revise", {}, { askForChange: false, reviseFindings: true }],
    [
      "a published pass",
      { passes: [makeReviewPass({ published: true })] },
      { askForChange: false, reviseFindings: false },
    ],
    [
      "a pass sent to the agent",
      { passes: [makeReviewPass({ sent: true })] },
      { askForChange: false, reviseFindings: false },
    ],
    [
      "a clean pass",
      { passes: [makeReviewPass({ clean: true, findings: [] })] },
      { askForChange: false, reviseFindings: false },
    ],
    [
      "a pass not recorded yet",
      { passes: [makeReviewPass({ recorded: false })] },
      { askForChange: false, reviseFindings: false },
    ],
    [
      "the changes of the agent in review",
      { status: "in_review", passes: [makeReviewPass({ sent: true })] },
      { askForChange: true, reviseFindings: false },
    ],
    [
      "the changes of the agent to approve",
      { status: "ready_to_approve", passes: [makeReviewPass({ sent: true })] },
      { askForChange: true, reviseFindings: false },
    ],
  ])("knows %s", (_, overrides, want) => {
    expect(reviewComposerContext(review(overrides))).toEqual({
      findings: false,
      item: "review",
      ...want,
    });
  });
});

describe("hasReviewComposer", () => {
  it.each<[string, Partial<ReviewSummary>, boolean]>([
    ["a review with its session", {}, true],
    ["a review without a session", { sessionStage: "" }, false],
    ["the first pass waiting for the checks", { status: "waiting_checks", passes: [] }, false],
    [
      "a later pass waiting for the checks",
      {
        status: "waiting_checks",
        passes: [makeReviewPass(), makeReviewPass({ pass: 2, recorded: false })],
      },
      true,
    ],
  ])("says whether %s has one", (_, overrides, has) => {
    expect(hasReviewComposer(review(overrides))).toBe(has);
  });
});

describe("reviewChecks", () => {
  it("is the live reading of the pull request, against its base", () => {
    const checks = [makePRCheck()];

    expect(
      reviewChecks(review({ checks, mergeable: "conflicting", checkedAt: NINE_MINUTES_AGO })),
    ).toEqual({ checks, mergeable: "conflicting", checkedAt: NINE_MINUTES_AGO, base: "dev" });
  });
});
