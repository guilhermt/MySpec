import { describe, expect, it } from "vitest";
import { gonePassLines, goneReviewText } from "@/features/navigation/gone-passes";
import type { ArchivedReview, ReviewPass } from "@/lib/wails";
import { atMoment, clockTime } from "@/lib/when";
import { makeArchivedReview, makeReviewFinding, makeReviewPass } from "@/test/wails-mock";

const NOW = Date.parse("2026-09-30T18:00:00Z");
const WHEN = "2026-09-30T16:20:00Z";
const CLOCK = clockTime(WHEN, NOW);
const MOMENT = atMoment(WHEN, NOW).trim();
const TAIL =
  "MySpec stopped the session and removed the worktree. The reports and the verdicts are in History; the conversation isn't kept.";

describe("goneReviewText", () => {
  it.each<{ name: string; archived: Partial<ArchivedReview>; want: string }>([
    {
      name: "who merged it, into what and when",
      archived: { outcome: "merged", mergedBy: "rsouza", mergedAt: WHEN },
      want: `rsouza merged it into dev at ${CLOCK}. ${TAIL}`,
    },
    {
      name: "a merge without who",
      archived: { outcome: "merged", mergedBy: "", mergedAt: WHEN },
      want: `It was merged into dev at ${CLOCK}. ${TAIL}`,
    },
    {
      name: "a merge without when",
      archived: { outcome: "merged", mergedBy: "rsouza", mergedAt: "" },
      want: `rsouza merged it into dev. ${TAIL}`,
    },
    {
      name: "a close and when",
      archived: { outcome: "closed", closedAt: WHEN },
      want: `It was closed at ${CLOCK}. ${TAIL}`,
    },
    {
      name: "a close without when",
      archived: { outcome: "closed", closedAt: "" },
      want: `It was closed. ${TAIL}`,
    },
    {
      name: "a merge of another day, with the day once",
      archived: {
        outcome: "merged",
        mergedBy: "rsouza",
        mergedAt: new Date(2026, 8, 29, 16, 20).toISOString(),
      },
      want: `rsouza merged it into dev on Sep 29 at 16:20. ${TAIL}`,
    },
    {
      name: "a close of another day",
      archived: { outcome: "closed", closedAt: new Date(2026, 8, 23, 9, 5).toISOString() },
      want: `It was closed on Sep 23 at 09:05. ${TAIL}`,
    },
  ])("says $name", ({ archived, want }) => {
    expect(goneReviewText(makeArchivedReview(archived), NOW)).toBe(want);
  });
});

describe("gonePassLines", () => {
  // placed is a finding approved and published inline or in the body, or discarded with "".
  const placed = (placement: string) =>
    makeReviewFinding({ placement, decision: placement === "" ? "discarded" : "approved" });
  const published = (overrides: Partial<ReviewPass>) =>
    makeReviewPass({
      published: true,
      publishedAt: WHEN,
      verdict: "request_changes",
      ...overrides,
    });

  it.each<{ name: string; pass: ReviewPass; want: { text: string; time: string } }>([
    {
      name: "inline comments",
      pass: published({ findings: [placed("inline"), placed("inline"), placed("")] }),
      want: { text: "Pass 1 · Request changes · 2 inline comments", time: MOMENT },
    },
    {
      name: "inline comments and the body",
      pass: published({ findings: [placed("inline"), placed("body")], summaryPublished: true }),
      want: { text: "Pass 1 · Request changes · 1 inline comment, 1 in the body", time: MOMENT },
    },
    {
      name: "findings in the body",
      pass: published({ verdict: "comment", findings: [placed("body"), placed("body")] }),
      want: { text: "Pass 1 · Comment · 2 findings in the body", time: MOMENT },
    },
    {
      name: "the summary",
      pass: published({ verdict: "approve", findings: [placed("")], summaryPublished: true }),
      want: { text: "Pass 1 · Approve · the summary", time: MOMENT },
    },
    {
      name: "the verdict only",
      pass: published({ verdict: "approve", findings: [placed("")] }),
      want: { text: "Pass 1 · Approve · the verdict only", time: MOMENT },
    },
    {
      name: "a clean pass",
      pass: published({
        pass: 2,
        verdict: "approve",
        clean: true,
        findings: [],
        summaryPublished: true,
      }),
      want: { text: "Pass 2 · Approve · a clean pass", time: MOMENT },
    },
    {
      name: "a pass not published",
      pass: makeReviewPass({ pass: 2 }),
      want: { text: "Pass 2 · not published", time: "" },
    },
  ])("says $name in publish mode", ({ pass, want }) => {
    expect(gonePassLines(makeArchivedReview({ mode: "publish", passes: [pass] }), NOW)).toEqual([
      want,
    ]);
  });

  it.each<{ name: string; pass: ReviewPass; want: { text: string; time: string } }>([
    {
      name: "the findings sent to the agent",
      pass: makeReviewPass({
        sent: true,
        sentAt: WHEN,
        findings: [placed("inline"), placed("body"), placed("")],
      }),
      want: { text: "Pass 1 · 2 findings sent to the agent", time: MOMENT },
    },
    {
      name: "a sending whose hour wasn't kept",
      pass: makeReviewPass({ sent: true, sentAt: "", findings: [placed("inline")] }),
      want: { text: "Pass 1 · 1 finding sent to the agent", time: "" },
    },
    {
      name: "nothing approved",
      pass: makeReviewPass({ pass: 2, findings: [placed("")] }),
      want: { text: "Pass 2 · nothing approved", time: "" },
    },
    {
      name: "a clean pass",
      pass: makeReviewPass({ pass: 2, clean: true, findings: [] }),
      want: { text: "Pass 2 · a clean pass", time: "" },
    },
    {
      name: "approved findings never sent",
      pass: makeReviewPass({ findings: [placed("inline")] }),
      want: { text: "Pass 1 · not sent", time: "" },
    },
  ])("says $name in apply mode", ({ pass, want }) => {
    expect(gonePassLines(makeArchivedReview({ mode: "apply", passes: [pass] }), NOW)).toEqual([
      want,
    ]);
  });

  it("leaves out a pass without a report, and keeps the order", () => {
    const passes = [
      published({ pass: 1, findings: [placed("inline")] }),
      makeReviewPass({ pass: 2, recorded: false }),
    ];

    expect(gonePassLines(makeArchivedReview({ passes }), NOW).map((line) => line.text)).toEqual([
      "Pass 1 · Request changes · 1 inline comment",
    ]);
  });
});
