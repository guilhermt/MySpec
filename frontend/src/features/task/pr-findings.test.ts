import { describe, expect, it } from "vitest";
import { type ComposerContext, placeholderOf } from "@/features/chat/composer";
import {
  allDiscarded,
  cardOf,
  currentReport,
  disabledNote,
  discardedPass,
  findingsBar,
  findingsFormOf,
  findingsNotes,
  noFileChanged,
  passPlace,
  prComposerContext,
  reviewAgainTooltip,
} from "@/features/task/pr-findings";
import type { PRReport, PullRequest, SituationKind } from "@/lib/wails";
import { clockTime } from "@/lib/when";
import {
  makePRReport,
  makePullRequest,
  makeReview,
  makeReviewFinding,
  makeTask,
  makeTextPRReport,
} from "@/test/wails-mock";

const NOW = Date.parse("2026-09-27T18:00:00Z");
const SENT_AT = "2026-09-27T17:36:00Z";

/** report is a structured pass recorded with one finding per decision. */
function report(decisions: string[], rest: Partial<PRReport> = {}): PRReport {
  return makePRReport({
    findings: decisions.map((decision, index) =>
      makeReviewFinding({ number: index + 1, decision }),
    ),
    ...rest,
  });
}

/** pr is a pull request on its current pass 1, in the state given. */
function pr(status: string, reports: PRReport[], rest: Partial<PullRequest> = {}): PullRequest {
  return makePullRequest({ status, prState: "open", currentPass: 1, reports, ...rest });
}

describe("currentReport", () => {
  it.each<[string, PullRequest, number | null]>([
    ["the current structured pass", pr("awaiting_decision", [report([""])]), 1],
    [
      "the current pass among the earlier ones",
      pr("awaiting_decision", [makeTextPRReport(1, false), report([""], { pass: 2 })], {
        currentPass: 2,
      }),
      2,
    ],
    [
      "none while the review runs in text",
      pr("awaiting_decision", [makeTextPRReport(1, false)], { currentPass: 0 }),
      null,
    ],
    [
      "none when the pass of the number is in text",
      pr("awaiting_decision", [makeTextPRReport(1, false)]),
      null,
    ],
  ])("finds %s", (_name, request, pass) => {
    expect(currentReport(request)?.pass ?? null).toBe(pass);
  });
});

describe("allDiscarded and discardedPass", () => {
  it.each<[string, PRReport, boolean]>([
    ["every finding discarded", report(["discarded", "discarded"]), true],
    ["one still approved", report(["discarded", "approved"]), false],
    ["one not decided", report(["discarded", ""]), false],
    ["a clean pass", report([], { clean: true }), false],
    ["no findings", report([]), false],
    ["a pass already sent", report(["discarded"], { sentAt: SENT_AT }), false],
    ["a pass not recorded", report(["discarded"], { recorded: false }), false],
  ])("says %s", (_name, pass, expected) => {
    expect(allDiscarded(pass)).toBe(expected);
    expect(discardedPass(pr("done", [pass]))).toBe(expected);
  });
});

describe("cardOf", () => {
  const decided = report(["approved", ""]);

  it.each<[string, PullRequest, boolean | null]>([
    ["a pass being decided", pr("awaiting_decision", [decided]), false],
    ["the wait for the findings to be sent", pr("reviewing", [decided]), false],
    ["a changed worktree under review", pr("in_review", [decided]), false],
    ["a pass left to the merge", pr("done", [decided]), false],
    ["a pull request in trouble", pr("trouble", [decided]), false],
    [
      "the next pass asked for",
      pr("reviewing", [report([""], { pass: 2, recorded: false })], { currentPass: 2 }),
      null,
    ],
    ["the next pass waiting for the checks", pr("waiting_checks", [decided]), null],
    ["a pass sent", pr("in_review", [report(["approved"], { sentAt: SENT_AT })]), null],
    ["a clean pass", pr("done", [report([], { clean: true })]), null],
    ["a pass in text", pr("awaiting_decision", [makeTextPRReport(1, false)]), null],
    ["a pass not recorded", pr("awaiting_decision", [report([""], { recorded: false })]), null],
    ["a merged pull request", pr("done", [decided], { prState: "merged" }), null],
    ["a closed pull request", pr("done", [decided], { prState: "closed" }), null],
    [
      "a merged pull request with every finding discarded",
      pr("merged", [report(["discarded"])]),
      true,
    ],
    ["a closed task with every finding discarded", pr("closed", [report(["discarded"])]), true],
    ["a merged pull request with an approved finding", pr("merged", [decided]), null],
  ])("holds the card for %s", (_name, request, disabled) => {
    expect(cardOf(request)?.disabled ?? null).toBe(disabled);
  });
});

describe("findingsFormOf", () => {
  it.each<[string, PullRequest, string]>([
    ["no structured pass", pr("awaiting_decision", [makeTextPRReport(1, false)]), "text"],
    ["a pass not recorded", pr("awaiting_decision", [report([""], { recorded: false })]), "text"],
    ["findings to decide", pr("awaiting_decision", [report(["approved", ""])]), "decide"],
    [
      "every finding decided, one approved",
      pr("awaiting_decision", [report(["approved", "discarded"])]),
      "apply",
    ],
    ["every finding discarded", pr("awaiting_decision", [report(["discarded"])]), "decide"],
  ])("is the form of %s", (_name, request, form) => {
    expect(findingsFormOf(request)).toBe(form);
  });
});

describe("passPlace", () => {
  it.each<[string, PullRequest, string]>([
    [
      "the current pass",
      pr("awaiting_decision", [report([""], { pass: 3 })], { currentPass: 3 }),
      "PR review · pass 3",
    ],
    [
      "the last pass in text",
      pr("awaiting_decision", [makeTextPRReport(1, false), makeTextPRReport(2, true)], {
        currentPass: 0,
      }),
      "PR review · pass 2",
    ],
    ["no pass", pr("awaiting_decision", [], { currentPass: 0 }), "PR review · pass 1"],
  ])("names %s", (_name, request, place) => {
    expect(passPlace(request)).toBe(place);
  });
});

describe("findingsNotes", () => {
  it.each<[string, Partial<PullRequest>, string[], string]>([
    ["nothing", {}, [], ""],
    [
      "the worktree with changes",
      { review: makeReview({ total: 2 }) },
      ["the worktree has changes"],
      "They go to review with the changes of the approved findings.",
    ],
    ["a worktree that can't be read", { review: makeReview({ total: 2, error: "boom" }) }, [], ""],
    ["a worktree with no change", { review: makeReview({ total: 0 }) }, [], ""],
    [
      "the rewrite that can't be read",
      { unreadableReport: "no heading for finding 2" },
      ["the rewritten report can't be read"],
      "no heading for finding 2",
    ],
    [
      "both",
      { review: makeReview({ total: 1 }), unreadableReport: "no heading" },
      ["the worktree has changes", "the rewritten report can't be read"],
      "They go to review with the changes of the approved findings. no heading",
    ],
  ])("adds %s", (_name, rest, notes, tooltip) => {
    expect(findingsNotes(pr("awaiting_decision", [report([""])], rest))).toEqual({
      notes,
      tooltip,
    });
  });
});

describe("findingsBar", () => {
  const NEXT = expect.objectContaining({ action: "nextToDecide", shortcut: "Alt ↓" });

  it("draws the findings to decide, with Apply dashed by what is left", () => {
    const bar = findingsBar(pr("awaiting_decision", [report(["approved", "", ""])]), "decide");

    expect(bar).toMatchObject({
      form: "decision",
      label: "Decide findings",
      place: "PR review · pass 1",
      progress: "1 of 3 decided",
      status: "Decide findings · PR review · pass 1",
      focus: "finding",
    });
    expect(bar.actions).toEqual([
      NEXT,
      {
        action: "approveRest",
        label: "Approve the rest",
        variant: "secondary",
        tooltip: "Approve the 2 findings not decided yet",
        loadingLabel: "Approving…",
      },
      {
        action: "applyFindings",
        label: "Apply approved",
        variant: "primary",
        loadingLabel: "Sending…",
        disabledReason: "Decide 2 more",
      },
    ]);
  });

  it("words the tooltip of Approve the rest for one finding", () => {
    const bar = findingsBar(pr("awaiting_decision", [report(["approved", ""])]), "decide");

    expect(bar.actions[1]?.tooltip).toBe("Approve the 1 finding not decided yet");
  });

  it("leaves Approve the rest out and Apply approved enabled when every finding is decided", () => {
    const bar = findingsBar(pr("awaiting_decision", [report(["approved", "discarded"])]), "decide");

    expect(bar.actions.map((button) => button.action)).toEqual(["nextToDecide", "applyFindings"]);
    expect(bar.actions[1]).not.toHaveProperty("disabledReason");
  });

  it("puts the notes in the middle, with their tooltip", () => {
    const bar = findingsBar(
      pr("awaiting_decision", [report(["", ""])], {
        review: makeReview({ total: 1 }),
        unreadableReport: "no heading",
      }),
      "decide",
    );

    expect(bar.progress).toBe(
      "0 of 2 decided · the worktree has changes · the rewritten report can't be read",
    );
    expect(bar.progressTooltip).toBe(
      "They go to review with the changes of the approved findings. no heading",
    );
  });

  it.each([
    [1, "1 approved finding goes to the agent"],
    [2, "2 approved findings go to the agent"],
  ])("draws the findings ready to apply with %i approved", (count, progress) => {
    const bar = findingsBar(
      pr("awaiting_decision", [report([...Array(count).fill("approved"), "discarded"])]),
      "apply",
    );

    expect(bar).toMatchObject({
      form: "decision",
      label: "Ready to apply",
      place: "PR review · pass 1",
      progress,
      status: "Ready to apply · PR review · pass 1",
      focus: "primary",
    });
    expect(bar.actions.map((action) => action.label)).toEqual(["Apply approved"]);
  });

  it("draws a pass in text tinted, answered through the composer", () => {
    const bar = findingsBar(pr("awaiting_decision", [makeTextPRReport(1, false)]), "text");

    expect(bar).toEqual({
      form: "tinted",
      label: "Decide findings",
      place: "PR review · pass 1",
      status: "Decide findings · PR review · pass 1",
      actions: [],
      focus: "composer",
    });
  });
});

describe("noFileChanged", () => {
  const sent = report(["approved"], { sentAt: SENT_AT });

  it.each<[string, PullRequest, boolean]>([
    [
      "a sent pass and a worktree without changes",
      pr("in_review", [sent], { review: makeReview({ total: 0 }) }),
      true,
    ],
    ["a sent pass and no review read", pr("in_review", [sent], { review: null }), true],
    [
      "a worktree with changes",
      pr("in_review", [sent], { review: makeReview({ total: 2 }) }),
      false,
    ],
    [
      "a worktree that can't be read",
      pr("in_review", [sent], { review: makeReview({ total: 0, error: "x" }) }),
      false,
    ],
    ["a pass not sent", pr("in_review", [report(["approved"])], { review: null }), false],
    ["another status", pr("awaiting_decision", [sent], { review: null }), false],
  ])("says %s", (_name, request, expected) => {
    expect(noFileChanged(request)).toBe(expected);
  });
});

describe("disabledNote", () => {
  const sent = report(["approved", "discarded", ""], { sentAt: SENT_AT });
  const [approved, discarded, open] = sent.findings ?? [];

  it.each([
    ["an approved finding", approved, `Sent to the agent · ${clockTime(SENT_AT, NOW)}`],
    ["a discarded finding", discarded, "Not sent"],
    ["a finding not decided", open, "Not sent"],
  ])("says where %s went", (_name, finding, note) => {
    expect(finding && disabledNote(sent, finding, NOW)).toBe(note);
  });

  it("leaves the time out when the pass has none", () => {
    const pass = report(["approved"]);

    expect(disabledNote(pass, pass.findings?.[0] ?? makeReviewFinding(), NOW)).toBe(
      "Sent to the agent",
    );
  });
});

describe("reviewAgainTooltip", () => {
  it.each<[string, PullRequest, string | null]>([
    [
      "decisions that were edited",
      pr("trouble", [report(["approved"], { edited: true, pass: 2 })], { currentPass: 2 }),
      "Starts pass 3. The decisions of review 2 aren't applied.",
    ],
    ["a pass left as it came", pr("trouble", [report([""], { edited: false })]), null],
    ["a pass that is behind", pr("merged", [report(["discarded"], { edited: true })]), null],
    ["no structured pass", pr("trouble", [makeTextPRReport(1, false)]), null],
  ])("tells %s", (_name, request, tooltip) => {
    expect(reviewAgainTooltip(request)).toBe(tooltip);
  });
});

describe("prComposerContext", () => {
  const structured = pr("awaiting_decision", [report([""])]);
  const text = pr("awaiting_decision", [makeTextPRReport(1, false)]);
  const discarded = pr("done", [report(["discarded"])]);
  const REST: ComposerContext = {
    who: "PR agent",
    paused: false,
    stopped: false,
    turnFailed: false,
    turnRunning: false,
    question: null,
    choices: null,
    otherHeader: null,
    permission: false,
    chips: [],
    findings: false,
    askForChange: false,
    reviseFindings: false,
    item: "task",
  };

  it.each<[string, PullRequest, SituationKind, string]>([
    ["a pass in text", text, "findings", "Tell the PR agent which findings to apply…"],
    [
      "findings to decide",
      structured,
      "findings",
      "Ask the PR agent to add, change or drop a finding…",
    ],
    [
      "every finding discarded",
      discarded,
      "merge",
      "Ask the PR agent to add, change or drop a finding…",
    ],
    ["a merge with a pass in text", text, "merge", "Reply to the PR agent…"],
    ["the changes to review", structured, "changes_review", "Ask the PR agent for a change…"],
  ])("says what to write with %s", (_name, request, kind, placeholder) => {
    const task = makeTask({ stage: "pr", pr: request });

    expect(placeholderOf({ ...REST, ...prComposerContext(task, kind) })).toBe(placeholder);
  });

  it("asks for nothing without a situation", () => {
    expect(prComposerContext(makeTask({ stage: "pr", pr: structured }), null)).toEqual({
      findings: false,
      reviseFindings: false,
      askForChange: false,
    });
  });
});
