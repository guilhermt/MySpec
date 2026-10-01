import { describe, expect, it } from "vitest";
import {
  allowedVerdicts,
  goesLine,
  initialVerdict,
  publishedGoes,
  publishLabel,
  publishReason,
  suggestedVerdict,
  summaryStart,
  VERDICTS,
} from "@/features/reviews/publish";
import type { ReviewFinding, ReviewVerdict } from "@/lib/wails";
import { makeReviewFinding, makeReviewPass, makeReviewSummary } from "@/test/wails-mock";

// anchored and general are findings on a line of the diff and off it, with a decision.
function anchored(decision: string): ReviewFinding {
  return makeReviewFinding({ decision });
}

function general(decision: string): ReviewFinding {
  return makeReviewFinding({ decision, path: "", line: 0, lineUrl: "" });
}

describe("publishedGoes", () => {
  it.each([
    {
      name: "inline and the summary",
      marker: { inline: 2, body: 0, summary: true, minimal: false },
      want: "2 inline comments · the summary in the body",
    },
    {
      name: "one inline comment, nothing else",
      marker: { inline: 1, body: 0, summary: false, minimal: false },
      want: "1 inline comment · nothing in the body",
    },
    {
      name: "findings and the summary in the body",
      marker: { inline: 1, body: 2, summary: true, minimal: false },
      want: "1 inline comment · 2 findings and the summary in the body",
    },
    {
      name: "one finding in the body",
      marker: { inline: 0, body: 1, summary: false, minimal: false },
      want: "1 finding in the body",
    },
    {
      name: "the minimal body",
      marker: { inline: 2, body: 0, summary: false, minimal: true },
      want: '2 inline comments · "Review with 2 inline comments." in the body',
    },
    {
      name: "the minimal body of one comment",
      marker: { inline: 1, body: 0, summary: false, minimal: true },
      want: '1 inline comment · "Review with 1 inline comment." in the body',
    },
    {
      name: "the summary alone",
      marker: { inline: 0, body: 0, summary: true, minimal: false },
      want: "the summary in the body",
    },
    {
      name: "nothing but the verdict",
      marker: { inline: 0, body: 0, summary: false, minimal: false },
      want: "the verdict only",
    },
  ])("$name", ({ marker, want }) => {
    expect(publishedGoes(marker)).toBe(want);
  });
});

describe("VERDICTS", () => {
  it("are the three verdicts in the order of their keys, with what each means", () => {
    expect(VERDICTS.map(({ key, name, description }) => `${key} ${name} · ${description}`)).toEqual(
      [
        "1 Request changes · The author addresses the findings before the merge.",
        "2 Approve · It can be merged as it is.",
        "3 Comment · Feedback without a verdict.",
      ],
    );
  });
});

describe("suggestedVerdict", () => {
  it.each([
    {
      name: "approved findings suggest Request changes",
      findings: [anchored("approved"), general("approved"), anchored("discarded")],
      clean: false,
      want: {
        verdict: "request_changes",
        why: "Suggested by your decisions: 2 findings approved",
      },
    },
    {
      name: "one approved finding",
      findings: [anchored("approved")],
      clean: false,
      want: { verdict: "request_changes", why: "Suggested by your decisions: 1 finding approved" },
    },
    {
      name: "nothing approved suggests Approve",
      findings: [anchored("discarded")],
      clean: false,
      want: { verdict: "approve", why: "Suggested by your decisions: nothing approved" },
    },
    {
      name: "a clean pass suggests Approve",
      findings: [],
      clean: true,
      want: { verdict: "approve", why: "Suggested by your decisions: a clean pass" },
    },
  ])("$name", ({ findings, clean, want }) => {
    const pass = makeReviewPass({ findings, clean });

    expect(suggestedVerdict(makeReviewSummary(), pass)).toEqual(want);
  });

  it("suggests nothing on your own pull request", () => {
    const pass = makeReviewPass({ findings: [anchored("approved")] });

    expect(suggestedVerdict(makeReviewSummary({ own: true }), pass)).toBeNull();
  });
});

describe("allowedVerdicts", () => {
  it.each([
    {
      name: "a summary and an approved finding take the three",
      own: false,
      summary: "Two things.",
      withSummary: true,
      findings: [anchored("approved")],
      want: { allowed: ["request_changes", "approve", "comment"], reason: null },
    },
    {
      name: "the summary alone takes the three",
      own: false,
      summary: "Two things.",
      withSummary: true,
      findings: [anchored("discarded")],
      want: { allowed: ["request_changes", "approve", "comment"], reason: null },
    },
    {
      name: "an approved finding alone takes the three",
      own: false,
      summary: "Two things.",
      withSummary: false,
      findings: [general("approved")],
      want: { allowed: ["request_changes", "approve", "comment"], reason: null },
    },
    {
      name: "without the summary and an approved finding only Approve",
      own: false,
      summary: "Two things.",
      withSummary: false,
      findings: [anchored("discarded")],
      want: {
        allowed: ["approve"],
        reason: "Without a summary and an approved finding, GitHub takes only Approve.",
      },
    },
    {
      name: "an empty summary counts as none",
      own: false,
      summary: "  \n ",
      withSummary: true,
      findings: [],
      want: {
        allowed: ["approve"],
        reason: "Without a summary and an approved finding, GitHub takes only Approve.",
      },
    },
    {
      name: "your own pull request takes only Comment",
      own: true,
      summary: "Two things.",
      withSummary: true,
      findings: [],
      want: { allowed: ["comment"], reason: "Your own pull request: GitHub takes only Comment." },
    },
    {
      name: "your own pull request with nothing to comment takes none",
      own: true,
      summary: "Two things.",
      withSummary: false,
      findings: [anchored("discarded")],
      want: {
        allowed: [],
        reason:
          "Your own pull request takes only Comment, and a comment needs the summary or an approved finding.",
      },
    },
  ])("$name", ({ own, summary, withSummary, findings, want }) => {
    const pass = makeReviewPass({ summary, findings });

    expect(allowedVerdicts(makeReviewSummary({ own }), pass, withSummary)).toEqual(want);
  });
});

describe("goesLine", () => {
  it.each<{
    name: string;
    findings: ReviewFinding[];
    clean?: boolean;
    summary?: string;
    withSummary: boolean;
    verdict: ReviewVerdict | null;
    want: string;
  }>([
    {
      name: "inline comments, the summary and a discarded finding",
      findings: [anchored("approved"), anchored("approved"), anchored("discarded")],
      withSummary: true,
      verdict: "request_changes",
      want: "2 inline comments · the summary in the body · 1 finding discarded, not published",
    },
    {
      name: "one inline comment and nothing in the body under Approve",
      findings: [anchored("approved")],
      withSummary: false,
      verdict: "approve",
      want: "1 inline comment · nothing in the body",
    },
    {
      name: "nothing in the body before a verdict is chosen",
      findings: [anchored("approved"), anchored("approved")],
      withSummary: false,
      verdict: null,
      want: "2 inline comments · nothing in the body",
    },
    {
      name: "the minimal body of Request changes",
      findings: [anchored("approved"), anchored("approved")],
      withSummary: false,
      verdict: "request_changes",
      want: '2 inline comments · "Review with 2 inline comments." in the body',
    },
    {
      name: "the minimal body of Comment, with an empty summary",
      findings: [anchored("approved")],
      summary: " ",
      withSummary: true,
      verdict: "comment",
      want: '1 inline comment · "Review with 1 inline comment." in the body',
    },
    {
      name: "general findings and the summary in the body",
      findings: [anchored("approved"), general("approved"), general("approved")],
      withSummary: true,
      verdict: "request_changes",
      want: "1 inline comment · 2 findings and the summary in the body",
    },
    {
      name: "one finding in the body",
      findings: [general("approved"), general("discarded"), anchored("discarded")],
      withSummary: false,
      verdict: "comment",
      want: "1 finding in the body · 2 findings discarded, not published",
    },
    {
      name: "nothing approved, with the summary",
      findings: [anchored("discarded")],
      withSummary: true,
      verdict: "approve",
      want: "No finding approved · the summary and the verdict · 1 finding discarded, not published",
    },
    {
      name: "nothing approved, without the summary",
      findings: [anchored("discarded")],
      withSummary: false,
      verdict: "approve",
      want: "No finding approved · the verdict only · 1 finding discarded, not published",
    },
    {
      name: "a clean pass with the summary",
      findings: [],
      clean: true,
      withSummary: true,
      verdict: "approve",
      want: "A clean pass · the summary and the verdict",
    },
    {
      name: "a clean pass without the summary",
      findings: [],
      clean: true,
      withSummary: false,
      verdict: "approve",
      want: "A clean pass · the verdict only",
    },
  ])(
    "$name",
    ({ findings, clean = false, summary = "Two things.", withSummary, verdict, want }) => {
      const pass = makeReviewPass({ findings, clean, summary });

      expect(goesLine(pass, withSummary, verdict)).toBe(want);
    },
  );
});

describe("summaryStart", () => {
  // long has 145 characters of whole words, then a word across the 150th.
  const long = `${"word ".repeat(29)}wordier tail`;

  it.each([
    {
      name: "a short summary whole",
      summary: "Two **things** to fix.",
      want: "Two **things** to fix.",
    },
    { name: "an empty summary as nothing", summary: " \n ", want: "" },
    {
      name: "the line breaks as spaces",
      summary: "## Summary\n\nTwo things.",
      want: "## Summary Two things.",
    },
    {
      name: "a long one cut at the last whole word",
      summary: long,
      want: `${"word ".repeat(28)}word…`,
    },
    { name: "exactly 150 characters whole", summary: "a".repeat(150), want: "a".repeat(150) },
    {
      name: "a word longer than the start cut short",
      summary: "a".repeat(200),
      want: `${"a".repeat(150)}…`,
    },
  ])("keeps $name", ({ summary, want }) => {
    expect(summaryStart(summary)).toBe(want);
  });
});

describe("publishLabel", () => {
  it.each<[ReviewVerdict | null, string]>([
    [null, "Publish"],
    ["request_changes", "Publish · Request changes"],
    ["approve", "Publish · Approve"],
    ["comment", "Publish · Comment"],
  ])("labels %j as %j", (verdict, want) => {
    expect(publishLabel(verdict)).toBe(want);
  });
});

describe("publishReason", () => {
  it.each<[string, ReviewVerdict[], ReviewVerdict | null, string | null]>([
    ["nothing allowed", [], null, "Nothing GitHub takes yet"],
    ["no verdict chosen", ["approve", "comment"], null, "Choose a verdict"],
    ["a verdict chosen", ["approve", "comment"], "approve", null],
  ])("with %s", (_, allowed, verdict, want) => {
    expect(publishReason(allowed, verdict)).toBe(want);
  });
});

describe("initialVerdict", () => {
  const all: ReviewVerdict[] = ["request_changes", "approve", "comment"];

  it.each<[string, ReviewVerdict[], Parameters<typeof initialVerdict>[1], ReviewVerdict | null]>([
    ["the only one allowed", ["comment"], null, "comment"],
    [
      "the only one allowed over the attempt",
      ["approve"],
      { pass: 1, verdict: "comment", withSummary: true },
      "approve",
    ],
    ["none without an attempt", all, null, null],
    [
      "the verdict of an attempt on the same pass",
      all,
      { pass: 1, verdict: "comment", withSummary: false },
      "comment",
    ],
    [
      "none after an attempt on another pass",
      all,
      { pass: 2, verdict: "comment", withSummary: false },
      null,
    ],
    [
      "none when the attempt's verdict isn't allowed anymore",
      ["approve", "comment"],
      { pass: 1, verdict: "request_changes", withSummary: true },
      null,
    ],
    [
      "none when the attempt had no verdict",
      all,
      { pass: 1, verdict: null, withSummary: true },
      null,
    ],
    ["none when nothing is allowed", [], { pass: 1, verdict: "comment", withSummary: true }, null],
  ])("is %s", (_, allowed, attempt, want) => {
    expect(initialVerdict(allowed, attempt, 1)).toBe(want);
  });
});
