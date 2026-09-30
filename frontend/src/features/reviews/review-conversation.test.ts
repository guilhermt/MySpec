import { describe, expect, it } from "vitest";
import {
  currentCardPass,
  decidedMarkerPasses,
  derivedDecidedPasses,
  disabledFindingNote,
  findingViews,
  reportMarkerIds,
  reviewFixedCard,
  waitingChecksFoot,
} from "@/features/reviews/review-conversation";
import type { Entry, MarkerEntry } from "@/lib/wails";
import { clockTime } from "@/lib/when";
import {
  makeEntry,
  makePRCheck,
  makeReviewFinding,
  makeReviewPass,
  makeReviewSummary,
} from "@/test/wails-mock";

const NOW = Date.parse("2026-09-30T15:00:00Z");
const WHEN = "2026-09-30T13:41:00Z";
const CLOCK = clockTime(WHEN, NOW);

function marked(fields: Partial<MarkerEntry>, id: string): Entry {
  const entry = makeEntry("marker");
  return entry.marker === null ? entry : { ...entry, id, marker: { ...entry.marker, ...fields } };
}

describe("reportMarkerIds", () => {
  it("keeps the latest marker of each pass, written or revised", () => {
    const entries = [
      marked({ type: "pr_review_written", pass: 1 }, "a"),
      marked({ type: "pr_review_revised", pass: 1 }, "b"),
      marked({ type: "pr_review_written", pass: 2 }, "c"),
      marked({ type: "checks_read", pass: 2 }, "d"),
    ];

    expect([...reportMarkerIds(entries)]).toEqual([
      [1, "b"],
      [2, "c"],
    ]);
  });
});

describe("derivedDecidedPasses", () => {
  const finding = makeReviewFinding({ decision: "approved" });
  const published = makeReviewPass({ pass: 1, published: true, findings: [finding] });
  const sent = makeReviewPass({ pass: 2, sent: true, findings: [finding] });
  const open = makeReviewPass({ pass: 3, findings: [finding] });
  const clean = makeReviewPass({ pass: 4, published: true, clean: true, findings: [] });
  const review = makeReviewSummary({ passes: [published, sent, open, clean] });

  it("are the passes published or sent with findings, which the conversation has no decision marker for", () => {
    expect(derivedDecidedPasses(review, []).map((pass) => pass.pass)).toEqual([1, 2]);
  });

  it("leave out the pass whose decisions the conversation recorded", () => {
    const entries = [marked({ type: "findings_decided", pass: 1 }, "x")];

    expect(decidedMarkerPasses(entries)).toEqual(new Set([1]));
    expect(derivedDecidedPasses(review, entries).map((pass) => pass.pass)).toEqual([2]);
  });
});

describe("disabledFindingNote", () => {
  const pass = makeReviewPass({ publishedAt: WHEN, sentAt: WHEN });

  it.each([
    {
      name: "an inline comment",
      mode: "publish",
      decision: "approved",
      placement: "inline",
      want: `Inline comment · published ${CLOCK}`,
    },
    {
      name: "a finding in the body",
      mode: "publish",
      decision: "approved",
      placement: "body",
      want: `In the review body · published ${CLOCK}`,
    },
    {
      name: "a discarded finding",
      mode: "publish",
      decision: "discarded",
      placement: "",
      want: "Not published",
    },
    {
      name: "an approved finding sent",
      mode: "apply",
      decision: "approved",
      placement: "",
      want: `Sent to the agent · ${CLOCK}`,
    },
    {
      name: "a discarded finding in apply",
      mode: "apply",
      decision: "discarded",
      placement: "",
      want: "Not sent",
    },
  ])("says $name", ({ mode, decision, placement, want }) => {
    const review = makeReviewSummary({ mode });
    const finding = makeReviewFinding({ decision, placement });

    expect(disabledFindingNote(review, pass, finding, NOW)).toBe(want);
  });

  it("drops the hour it does not have", () => {
    const apply = makeReviewSummary({ mode: "apply" });
    const finding = makeReviewFinding({ decision: "approved" });

    expect(disabledFindingNote(apply, makeReviewPass({ sentAt: "" }), finding, NOW)).toBe(
      "Sent to the agent",
    );
  });
});

describe("findingViews", () => {
  const review = makeReviewSummary();
  const pass = makeReviewPass({
    publishedAt: WHEN,
    findings: [
      makeReviewFinding({ number: 1, title: "", decision: "approved", placement: "inline" }),
      makeReviewFinding({
        number: 2,
        title: "No test",
        path: "",
        line: 0,
        lineUrl: "",
        decision: "",
      }),
    ],
  });

  it("draws each finding with its name, location and the decision", () => {
    const [first, second] = findingViews(review, pass, NOW);

    expect(first).toMatchObject({
      id: "1",
      number: 1,
      name: "Finding 1 of 2: src/login.ts, line 12. Approved.",
      title: "src/login.ts:12",
      locationAsTitle: true,
      location: { kind: "anchored", text: "src/login.ts:12", line: 12, fileName: "login.ts" },
      decision: "approved",
      disabled: null,
    });
    expect(second).toMatchObject({
      name: "Finding 2 of 2: No test. General. Not decided.",
      title: "No test",
      locationAsTitle: false,
      location: { kind: "general", text: "General · not on a line of the diff" },
      decision: "",
    });
  });

  it("says where each went when asked for the disabled form", () => {
    expect(findingViews(review, pass, NOW, true).map((view) => view.disabled)).toEqual([
      `Inline comment · published ${CLOCK}`,
      "Not published",
    ]);
  });
});

describe("currentCardPass", () => {
  const recorded = makeReviewPass({ pass: 1 });

  it("is the last pass, recorded with findings and neither published nor sent", () => {
    const review = makeReviewSummary({ status: "awaiting_decision", passes: [recorded] });

    expect(currentCardPass(review)).toBe(recorded);
  });

  it.each([
    { name: "without a pass", passes: [], status: "reviewing" },
    {
      name: "before the report",
      passes: [makeReviewPass({ recorded: false })],
      status: "reviewing",
    },
    {
      name: "on a clean pass",
      passes: [makeReviewPass({ clean: true, findings: [] })],
      status: "ready_to_publish",
    },
    {
      name: "without findings",
      passes: [makeReviewPass({ findings: [] })],
      status: "ready_to_publish",
    },
    { name: "once published", passes: [makeReviewPass({ published: true })], status: "published" },
    { name: "once sent", passes: [makeReviewPass({ sent: true })], status: "in_review" },
    {
      name: "while the next pass waits for the checks",
      passes: [recorded],
      status: "waiting_checks",
    },
    { name: "while the next pass is blocked", passes: [recorded], status: "pass_blocked" },
    {
      name: "once a later pass was asked for",
      passes: [recorded, makeReviewPass({ pass: 2, recorded: false })],
      status: "reviewing",
    },
  ])("is none $name", ({ passes, status }) => {
    expect(currentCardPass(makeReviewSummary({ status, passes }))).toBeNull();
  });
});

describe("waitingChecksFoot", () => {
  const running = (name: string) => makePRCheck({ name, state: "running" });
  const LEAVE = "MySpec reads web#2291 every minute; you can leave meanwhile.";

  it.each([
    {
      name: "the checks the first pass waits on",
      checks: [
        makePRCheck(),
        running("e2e / chromium"),
        makePRCheck({ name: "preview-deploy", state: "queued" }),
      ],
      mergeable: "mergeable",
      passes: [makeReviewPass({ recorded: false })],
      want: `The first pass starts when e2e / chromium and preview-deploy finish. ${LEAVE}`,
    },
    {
      name: "a single check",
      checks: [running("lint")],
      mergeable: "conflicting",
      passes: [],
      want: `The first pass starts when lint finishes. ${LEAVE}`,
    },
    {
      name: "three names, then how many more",
      checks: ["a", "b", "c", "d", "e"].map(running),
      mergeable: "mergeable",
      passes: [],
      want: `The first pass starts when a, b, c and 2 more finish. ${LEAVE}`,
    },
    {
      name: "the checks and the merge",
      checks: [running("lint"), running("test")],
      mergeable: "unknown",
      passes: [],
      want: `The first pass starts when lint and test finish and GitHub says whether it merges clean. ${LEAVE}`,
    },
    {
      name: "the merge alone",
      checks: [makePRCheck()],
      mergeable: "",
      passes: [],
      want: `The first pass starts when GitHub says whether web#2291 merges clean. ${LEAVE}`,
    },
    {
      name: "the checks, when the reading knows nothing it waits on",
      checks: [],
      mergeable: "mergeable",
      passes: [],
      want: `The first pass starts when the checks finish. ${LEAVE}`,
    },
    {
      name: "a later pass",
      checks: [running("lint")],
      mergeable: "mergeable",
      passes: [
        makeReviewPass({ pass: 1, published: true }),
        makeReviewPass({ pass: 2, recorded: false }),
      ],
      want: `Pass 2 starts when lint finishes. ${LEAVE}`,
    },
    {
      name: "the pass after the last report, before it is listed",
      checks: [running("lint")],
      mergeable: "mergeable",
      passes: [makeReviewPass({ pass: 1, published: true })],
      want: `Pass 2 starts when lint finishes. ${LEAVE}`,
    },
  ])("names $name", ({ checks, mergeable, passes, want }) => {
    const review = makeReviewSummary({
      repository: "acme/web",
      number: 2291,
      status: "waiting_checks",
      checks,
      mergeable,
      checkedAt: WHEN,
      passes,
    });

    expect(waitingChecksFoot(review)).toBe(want);
  });
});

describe("reviewFixedCard", () => {
  it.each([
    ["waiting_checks", "checks"],
    ["in_review", "files"],
    ["ready_to_approve", "files"],
    ["committing", "files"],
    ["reviewing", null],
    ["awaiting_decision", null],
    ["ready_to_apply", null],
    ["applying", null],
    ["published", null],
    ["trouble", null],
  ])("is the card of %s", (status, want) => {
    expect(reviewFixedCard(makeReviewSummary({ status }))).toBe(want);
  });
});
