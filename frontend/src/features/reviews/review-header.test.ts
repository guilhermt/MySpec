import { describe, expect, it } from "vitest";
import {
  checkStrip,
  type ReviewMenuGroup,
  reviewAgainRefusal,
  reviewContextDetail,
  reviewDetails,
  reviewMenu,
  reviewPass,
  reviewPauseRefusal,
  reviewStepper,
} from "@/features/reviews/review-header";
import type { ReviewSummary } from "@/lib/wails";
import {
  makeModelCatalog,
  makePRCheck,
  makePullRequestRow,
  makeReviewFinding,
  makeReviewPass,
  makeReviewSummary,
  makeSituation,
} from "@/test/wails-mock";

// The times are local, as the screen writes them.
const NOW = new Date(2026, 8, 27, 15, 0).getTime();
const at = (hour: number, minute: number) => new Date(2026, 8, 27, hour, minute).toISOString();
const REVIEW_PLACE = { kind: "review", stage: "review", step: 0 };
const WORKTREE = "/home/dev/.local/share/myspec/worktrees/dev/web/pr_31";

// At rest: no session at work, nothing asked.
function review(overrides: Partial<ReviewSummary> = {}): ReviewSummary {
  return makeReviewSummary({
    sessionStatus: "waiting",
    turnRunning: false,
    processRunning: false,
    ...overrides,
  });
}

const recorded = (pass: number) => makeReviewPass({ pass, file: `review-${pass}.md` });
const asked = (pass: number) =>
  makeReviewPass({ pass, file: `review-${pass}.md`, recorded: false, findings: [] });

const CHECKS = [
  makePRCheck({ name: "lint" }),
  makePRCheck({ name: "unit" }),
  makePRCheck({ name: "e2e", state: "running" }),
];

describe("reviewPass", () => {
  it.each<[string, Partial<ReviewSummary>, number]>([
    ["1 before any pass", { status: "waiting_checks" }, 1],
    [
      "the pass waiting for the checks",
      { status: "waiting_checks", passes: [recorded(1), asked(2)] },
      2,
    ],
    ["the pass running", { status: "reviewing", passes: [recorded(1), asked(2)] }, 2],
    ["the pass waiting for its report", { status: "awaiting_reply", passes: [asked(1)] }, 1],
    ["the pass blocked", { status: "pass_blocked", passes: [recorded(1), asked(2)] }, 2],
    [
      "the last with a report, once decided",
      { status: "awaiting_decision", passes: [recorded(1), recorded(2)] },
      2,
    ],
    [
      "the last with a report, past one left behind",
      { status: "published", passes: [recorded(1), asked(2)] },
      1,
    ],
  ])("is %s", (_, overrides, pass) => {
    expect(reviewPass(review(overrides))).toBe(pass);
  });
});

describe("reviewStepper", () => {
  it.each<[string, Partial<ReviewSummary>, string, string, string]>([
    [
      "checking GitHub before the first reading",
      { status: "waiting_checks" },
      "github",
      "checking GitHub",
      "Progress · Pass 1 · checking GitHub",
    ],
    [
      "the checks of the reading",
      { status: "waiting_checks", checks: CHECKS, checkedAt: at(14, 59) },
      "github",
      "checks 2/3",
      "Progress · Pass 1 · waiting for the checks, 2 of 3 passed",
    ],
    [
      "the pass running",
      { status: "reviewing", sessionStatus: "working", passes: [asked(1)] },
      "work",
      "working",
      "Progress · Pass 1 · Reviewer working",
    ],
    [
      "applying the findings",
      { status: "applying", mode: "apply", passes: [recorded(1)] },
      "work",
      "applying",
      "Progress · Pass 1 · applying the findings",
    ],
    [
      "committing the changes",
      { status: "committing", mode: "apply", passes: [recorded(1)] },
      "work",
      "committing",
      "Progress · Pass 1 · committing the changes",
    ],
    [
      "published, at rest",
      {
        status: "published",
        passes: [makeReviewPass({ published: true, verdict: "request_changes" })],
      },
      "idle",
      "published",
      "Progress · Pass 1 · published, changes requested",
    ],
    [
      "findings to decide",
      {
        status: "awaiting_decision",
        passes: [recorded(1)],
        situations: [makeSituation({ kind: "review_report", form: "decide", place: REVIEW_PLACE })],
      },
      "wait",
      "",
      "Progress · Pass 1 · waiting for you: decide findings",
    ],
    [
      "a publication that failed",
      {
        status: "publish_failed",
        passes: [recorded(1)],
        situations: [
          makeSituation({ kind: "publish_failed", group: "error", place: REVIEW_PLACE }),
        ],
      },
      "error",
      "",
      "Progress · Pass 1 · error: publish failed",
    ],
    [
      "ready to merge",
      {
        status: "ready_to_merge",
        mode: "apply",
        passes: [recorded(1)],
        situations: [
          makeSituation({ kind: "merge", group: "closing", form: "merge", place: REVIEW_PLACE }),
        ],
      },
      "close",
      "",
      "Progress · Pass 1 · ready to merge",
    ],
  ])("draws %s", (_, overrides, glyph, word, label) => {
    const model = reviewStepper(review(overrides), NOW);

    expect(model.pill).toMatchObject({ glyph, word, paused: false, position: "", qualifier: "" });
    expect(model.label).toBe(label);
    expect(model.tooltip).toEqual([label]);
    expect(model.steps).toEqual([{ id: "pass", name: "Pass 1", state: "current" }]);
  });

  it("glows over checking GitHub", () => {
    expect(reviewStepper(review({ status: "waiting_checks" }), NOW).pill.shimmer).toBe(true);
  });

  it("draws the neutral pill while paused, whatever the situation", () => {
    const model = reviewStepper(
      review({
        status: "awaiting_decision",
        sessionStatus: "paused",
        pausedAt: at(14, 52),
        passes: [recorded(1), recorded(2)],
        situations: [makeSituation({ kind: "review_report", form: "decide", place: REVIEW_PLACE })],
      }),
      NOW,
    );

    expect(model.pill).toMatchObject({
      name: "Pass 2",
      glyph: "paused",
      word: "paused",
      paused: true,
    });
    expect(model.label).toBe("Progress · Pass 2 · paused since 14:52");
  });
});

describe("reviewAgainRefusal", () => {
  it.each<[string, Partial<ReviewSummary>, string | null]>([
    ["nothing when it can", { status: "published", canReviewAgain: true }, null],
    ["a pass waiting for the checks", { status: "waiting_checks" }, "a pass waits for the checks"],
    [
      "a pass running",
      { status: "reviewing", turnRunning: true, passes: [recorded(1), asked(2)] },
      "a pass is running",
    ],
    [
      "a report not in yet",
      { status: "awaiting_reply", passes: [recorded(1), asked(2)] },
      "the report of pass 2 isn't in yet",
    ],
    [
      "a turn outside a pass",
      { status: "awaiting_decision", turnRunning: true, passes: [recorded(1)] },
      "the reviewer is working",
    ],
    ["the agent applying", { status: "applying" }, "the agent is applying the findings"],
    ["a commit", { status: "committing" }, "the changes are being committed"],
  ])("says %s", (_, overrides, reason) => {
    expect(reviewAgainRefusal(review(overrides))).toBe(reason);
  });
});

describe("reviewPauseRefusal", () => {
  it.each<[string, string, string | null]>([
    [
      "a session stopped on an error",
      "error",
      "Nothing is running to pause: the reviewer's session stopped with an error. Retry it.",
    ],
    ["a working session", "working", null],
    ["a paused session", "paused", null],
  ])("refuses %s as it should", (_, sessionStatus, refusal) => {
    expect(reviewPauseRefusal(review({ sessionStatus }))).toBe(refusal);
  });
});

/** outline is the menu as a list of lines: the legend, then each label with its disabled reason. */
function outline(groups: ReviewMenuGroup[]): string[] {
  return groups.map(
    (group) =>
      `${group.label ?? "—"}: ${group.items
        .map((item) =>
          item.disabledReason === undefined ? item.label : `${item.label} [${item.disabledReason}]`,
        )
        .join(", ")}`,
  );
}

describe("reviewMenu", () => {
  it("groups the pull request, the review and the deletion", () => {
    expect(outline(reviewMenu(review({ canReviewAgain: true }), NOW))).toEqual([
      "Pull request web#31: Open PR, Refresh PR, Open in VS Code",
      "Review: Review again…",
      "—: Delete review…",
    ]);
  });

  it("disables what can't be done yet, with the reason", () => {
    expect(
      outline(reviewMenu(review({ status: "waiting_checks", worktreePath: "" }), NOW)),
    ).toEqual([
      "Pull request web#31: Open PR, Refresh PR, Open in VS Code [the worktree doesn't exist yet]",
      "Review: Review again… [a pass waits for the checks]",
      "—: Delete review…",
    ]);
  });

  it.each<[string, string, string]>([
    ["before the first reading", "", "Read the pull request now"],
    ["after a reading", at(14, 58), "Read the pull request now · checked 2m ago"],
  ])("says when the pull request was read %s", (_, checkedAt, tooltip) => {
    const [pr] = reviewMenu(review({ checkedAt, worktreePath: WORKTREE }), NOW);

    expect(pr?.items.find((item) => item.action === "refreshPR")?.tooltip).toBe(tooltip);
    expect(pr?.items.find((item) => item.action === "openPR")?.tooltip).toBe(
      "Open web#31 on GitHub",
    );
    expect(pr?.items.find((item) => item.action === "openInEditor")?.shortcut).toBe("Ctrl+E");
  });

  it("marks Delete review… destructive", () => {
    const tail = reviewMenu(review(), NOW).at(-1);

    expect(tail?.items).toEqual([
      { id: "review.delete", label: "Delete review…", action: "deleteReview", destructive: true },
    ]);
  });
});

describe("reviewDetails", () => {
  const catalog = makeModelCatalog();
  const passes = [
    makeReviewPass({
      pass: 1,
      file: "review-1.md",
      findings: [makeReviewFinding(), makeReviewFinding({ number: 2 })],
      published: true,
      checks: CHECKS,
      mergeable: "mergeable",
      checksReadAt: at(13, 5),
      recordedAt: at(13, 20),
    }),
    makeReviewPass({
      pass: 2,
      file: "review-2.md",
      clean: true,
      findings: [],
      recordedAt: at(14, 10),
    }),
    makeReviewPass({
      pass: 3,
      file: "review-3.md",
      checks: [],
      checksReadAt: at(14, 40),
      sent: true,
      findings: [makeReviewFinding()],
    }),
    makeReviewPass({ pass: 4, file: "review-4.md", recorded: false, findings: [] }),
  ];

  it("lists the passes, what became of each, and the file that opens it", () => {
    const model = reviewDetails(review({ passes }), NOW, catalog, null);

    expect(model.passes).toEqual([
      { pass: 1, text: "Pass 1 · changes · 2 findings", meta: "published", file: "review-1.md" },
      { pass: 2, text: "Pass 2 · clean", meta: "14:10", file: "review-2.md" },
      {
        pass: 3,
        text: "Pass 3 · changes · 1 finding",
        meta: "sent to the agent",
        file: "review-3.md",
      },
      { pass: 4, text: "Pass 4 · no report yet", meta: "", file: "review-4.md" },
    ]);
  });

  it("says the report of the pass asked for can't be read", () => {
    const model = reviewDetails(
      review({ status: "awaiting_reply", passes, unreadableReport: "The report can't be read." }),
      NOW,
      catalog,
      null,
    );

    expect(model.passes.at(-1)?.text).toBe("Pass 4 · unreadable");
  });

  it("keeps the checks read before each pass that has them, the most recent first", () => {
    const model = reviewDetails(review({ passes }), NOW, catalog, null);

    expect(model.checks.map(({ pass, title, summary }) => ({ pass, title, summary }))).toEqual([
      { pass: 3, title: "Checks read before pass 3 · 14:40", summary: "No checks" },
      {
        pass: 1,
        title: "Checks read before pass 1 · 13:05",
        summary: "2 of 3 passed · 1 not finished · merges clean",
      },
    ]);
    expect(model.checks[1]?.reading).toEqual({
      checks: CHECKS,
      mergeable: "mergeable",
      checkedAt: at(13, 5),
      base: "dev",
    });
  });

  it("says the pull request, with the labels of its line in the list", () => {
    const row = makePullRequestRow({
      labels: [
        { name: "bug", color: "d73a4a" },
        { name: "auth", color: "0e8a16" },
      ],
    });

    expect(reviewDetails(review(), NOW, catalog, row).pullRequest).toEqual({
      reference: "dev/web#31",
      url: "https://github.com/dev/web/pull/31",
      author: "alice",
      branch: "add-login → dev",
      card: null,
      labels: "bug, auth",
    });
    expect(reviewDetails(review(), NOW, catalog, null).pullRequest.labels).toBe("");
  });

  it.each<[string, Partial<ReviewSummary>, { mode: string; model: string }]>([
    ["a review that publishes", {}, { mode: "Publish · fixed", model: "Opus 5.5 (1M) · high" }],
    [
      "a review that applies",
      { mode: "apply", sessionModel: "claude-haiku-4-5-20251001", sessionEffort: "" },
      { mode: "Apply · fixed", model: "Haiku 4.5" },
    ],
    [
      "a review without a session",
      { sessionModel: "", sessionEffort: "" },
      { mode: "Publish · fixed", model: "" },
    ],
  ])("says the review of %s", (_, overrides, want) => {
    const model = reviewDetails(review({ createdAt: at(13, 8), ...overrides }), NOW, catalog, null);

    expect(model.review).toEqual({ ...want, worktree: WORKTREE, started: "Today 13:08" });
  });
});

describe("checkStrip", () => {
  const failure = "GitHub didn't answer.";

  it.each<[string, Partial<ReviewSummary>, { title: string; reason: string } | null]>([
    ["nothing without a failure", {}, null],
    [
      "the failure and when the run began",
      { checkError: failure, checkErrorAt: at(14, 57) },
      {
        title: "Couldn't check GitHub · 3m ago",
        reason: `${failure} New commits, checks and the merge show after the next reading.`,
      },
    ],
    [
      "nothing while the bar of the blocked pass says it",
      { status: "pass_blocked", checkError: failure, checkErrorAt: at(14, 57) },
      null,
    ],
  ])("draws %s", (_, overrides, strip) => {
    expect(checkStrip(review(overrides), NOW)).toEqual(strip);
  });
});

describe("reviewContextDetail", () => {
  it.each<[string, number, string]>([
    ["the percent used", 44, "Context used by the reviewer: 44%"],
    ["a rounded percent", 43.6, "Context used by the reviewer: 44%"],
    ["… before the first reading", 0, "Context used by the reviewer: …"],
  ])("says %s", (_, contextPercent, detail) => {
    expect(reviewContextDetail(review({ contextPercent }))).toBe(detail);
  });
});
