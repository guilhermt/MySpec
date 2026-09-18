import { describe, expect, it } from "vitest";
import {
  compactWait,
  compareSituations,
  namesPlace,
  placeLabel,
  prSituation,
  reviewerSituation,
  reviewName,
  reviewSituation,
  situationDetail,
  situationLabel,
  situationTone,
  spokenWait,
  stageSituation,
  stepOrReviewerSituation,
  stepSituation,
  summaryLabel,
  waitingEntries,
} from "@/lib/situations";
import type { Place } from "@/lib/wails";
import { makeReviewSummary, makeSituation, makeState, makeTask } from "@/test/wails-mock";

function stagePlace(stage: string): Place {
  return { kind: "stage", stage, step: 0 };
}

function stepPlace(step: number): Place {
  return { kind: "step", stage: "", step };
}

function reviewerPlace(step: number): Place {
  return { kind: "step_review", stage: "", step };
}

const PR_PLACE: Place = { kind: "pr", stage: "", step: 0 };
const REVIEW_PLACE: Place = { kind: "review", stage: "", step: 0 };

const ids = (situations: readonly { id: string }[]) => situations.map((situation) => situation.id);

describe("situationTone", () => {
  it.each([
    ["error", "error"],
    ["waiting", "attention"],
    ["closing", "attention"],
  ])("colours the %s group as %s", (group, tone) => {
    expect(situationTone(makeSituation({ group }))).toBe(tone);
  });
});

describe("situationLabel", () => {
  it.each([
    ["session_error", "", 0, "Session error"],
    ["step_blocked", "", 0, "Step 3 blocked"],
    ["worktree_unreadable", "", 0, "Can't read worktree"],
    ["pr_blocked", "", 0, "PR blocked"],
    ["plan_invalid", "", 0, "Plan still invalid"],
    ["pr_closed", "", 0, "PR closed unmerged"],
    ["permission", "", 0, "Permission"],
    ["question", "", 0, "Question"],
    ["reply", "", 0, "Waiting for reply"],
    ["ready_to_continue", "", 0, "Ready to continue"],
    ["step_review", "review", 0, "Review step 3"],
    ["step_review", "staged", 60, "Step 3 · 60% staged"],
    ["step_review", "approve", 100, "Approve step 3"],
    ["step_empty", "", 0, "Step 3 has no changes"],
    ["draft", "", 0, "Draft to approve"],
    ["findings", "", 0, "Findings to decide"],
    ["changes_review", "review", 0, "Review changes"],
    ["changes_review", "staged", 40, "Changes · 40% staged"],
    ["changes_review", "approve", 100, "Approve changes"],
    ["merge", "merge", 0, "Ready to merge"],
    ["merge", "close", 0, "Ready to close"],
    ["review_report", "decide", 0, "Decide findings"],
    ["review_report", "publish", 0, "Publish review"],
    ["review_report", "apply", 0, "Apply findings"],
    ["new_commits", "", 0, "New commits"],
    ["publish_failed", "", 0, "Publish failed"],
  ])("names %s in the %s form", (kind, form, percent, label) => {
    const situation = makeSituation({ kind, form, percent, place: stepPlace(3) });

    expect(situationLabel(situation)).toBe(label);
  });

  it("reads a review in a form it does not have as the start of it", () => {
    expect(situationLabel(makeSituation({ kind: "step_review", place: stepPlace(2) }))).toBe(
      "Review step 2",
    );
    expect(situationLabel(makeSituation({ kind: "changes_review", form: "close" }))).toBe(
      "Review changes",
    );
    expect(situationLabel(makeSituation({ kind: "review_report", place: REVIEW_PLACE }))).toBe(
      "Decide findings",
    );
  });
});

describe("placeLabel", () => {
  it.each([
    [stagePlace("prd"), "PRD"],
    [stagePlace("tech_spec"), "tech spec"],
    [stagePlace("plan"), "plan"],
    [stagePlace("one_shot"), "One-Shot planning"],
    [stagePlace("implementation"), "implementation"],
    [stepPlace(4), "step 4"],
    [reviewerPlace(2), "step 2 review"],
    [PR_PLACE, "pull request"],
    [REVIEW_PLACE, "review"],
  ])("names the place %#", (place, label) => {
    expect(placeLabel(makeSituation({ place }))).toBe(label);
  });
});

describe("namesPlace and situationDetail", () => {
  it.each([
    ["step_blocked", true],
    ["step_review", true],
    ["step_empty", true],
    ["plan_invalid", true],
    ["review_report", true],
    ["new_commits", true],
    ["publish_failed", true],
    ["session_error", false],
    ["worktree_unreadable", false],
    ["pr_blocked", false],
    ["pr_closed", false],
    ["permission", false],
    ["question", false],
    ["reply", false],
    ["ready_to_continue", false],
    ["draft", false],
    ["findings", false],
    ["changes_review", false],
    ["merge", false],
  ])("knows whether the label of %s names its place", (kind, expected) => {
    expect(namesPlace(makeSituation({ kind }))).toBe(expected);
  });

  it("follows the label with the place when the label does not name it", () => {
    const draft = makeSituation({ kind: "draft", place: PR_PLACE });
    const reply = makeSituation({ kind: "reply", place: stagePlace("tech_spec") });

    expect(situationDetail(draft)).toBe("Draft to approve · pull request");
    expect(situationDetail(reply)).toBe("Waiting for reply · tech spec");
  });

  it("says it is the reviewer of the step that asks", () => {
    const question = makeSituation({ kind: "question", place: reviewerPlace(2) });

    expect(situationDetail(question)).toBe("Question · step 2 review");
  });

  it("is the label alone when the label names the place", () => {
    const review = makeSituation({ kind: "step_review", form: "review", place: stepPlace(3) });

    expect(situationDetail(review)).toBe("Review step 3");
  });
});

describe("summaryLabel", () => {
  it("is null without situations", () => {
    expect(summaryLabel([])).toBeNull();
  });

  it("is the label of the only situation", () => {
    expect(summaryLabel([makeSituation({ kind: "draft" })])).toBe("Draft to approve");
  });

  it("counts the others after the most urgent one", () => {
    const situations = [
      makeSituation({ kind: "draft" }),
      makeSituation({ id: "situation-2", kind: "findings" }),
      makeSituation({ id: "situation-3", kind: "merge", group: "closing", form: "merge" }),
    ];

    expect(summaryLabel(situations)).toBe("Draft to approve +2");
  });
});

describe("the order of the situations", () => {
  const closing = makeSituation({
    id: "closing",
    kind: "merge",
    group: "closing",
    form: "merge",
    startedAt: "2026-09-05T08:00:00Z",
  });
  const older = makeSituation({ id: "older", kind: "reply", startedAt: "2026-09-05T09:00:00Z" });
  const newer = makeSituation({ id: "newer", kind: "draft", startedAt: "2026-09-05T10:00:00Z" });
  const error = makeSituation({
    id: "error",
    kind: "session_error",
    group: "error",
    startedAt: "2026-09-05T11:00:00Z",
  });

  it("puts the most urgent group first, then the one that started first", () => {
    expect(ids([closing, newer, error, older].sort(compareSituations))).toEqual([
      "error",
      "older",
      "newer",
      "closing",
    ]);
  });

  it("ties a start it cannot read with any other of the group", () => {
    const unreadable = makeSituation({ startedAt: "not a date" });

    expect(compareSituations(unreadable, older)).toBe(0);
  });
});

describe("waitingEntries", () => {
  const started = "2026-09-05T10:00:00Z";
  const app = makeState({
    tasks: [
      makeTask({
        id: "task-1",
        name: "zeta",
        situations: [makeSituation({ id: "zeta-reply", taskId: "task-1", startedAt: started })],
      }),
      makeTask({
        id: "task-2",
        name: "billing",
        situations: [
          makeSituation({
            id: "billing-draft",
            taskId: "task-2",
            kind: "draft",
            place: PR_PLACE,
            startedAt: started,
          }),
          makeSituation({
            id: "billing-findings",
            taskId: "task-2",
            kind: "findings",
            place: PR_PLACE,
            startedAt: started,
          }),
        ],
      }),
      makeTask({
        id: "task-3",
        name: "add-login",
        situations: [
          makeSituation({
            id: "add-login-blocked",
            taskId: "task-3",
            kind: "step_blocked",
            group: "error",
            place: stepPlace(2),
            startedAt: "2026-09-05T11:00:00Z",
          }),
        ],
      }),
    ],
  });

  it("lists every situation of the active tasks, most urgent first, then by name and id", () => {
    const entries = waitingEntries(app, null);

    expect(entries.map((entry) => [entry.name, entry.situation.id])).toEqual([
      ["add-login", "add-login-blocked"],
      ["billing", "billing-draft"],
      ["billing", "billing-findings"],
      ["zeta", "zeta-reply"],
    ]);
  });

  it("leaves the open task out", () => {
    expect(ids(waitingEntries(app, "task-2").map((entry) => entry.situation))).toEqual([
      "add-login-blocked",
      "zeta-reply",
    ]);
  });

  it("lists the situations of the reviews beside the ones of the tasks", () => {
    const withReview = makeState({
      tasks: [
        makeTask({
          id: "task-1",
          name: "billing",
          situations: [makeSituation({ id: "billing-draft", kind: "draft", place: PR_PLACE })],
        }),
      ],
      reviews: [
        makeReviewSummary({
          id: "review-1",
          situations: [
            makeSituation({
              id: "review-failed",
              taskId: "review-1",
              kind: "publish_failed",
              group: "error",
              place: REVIEW_PLACE,
            }),
          ],
        }),
      ],
    });

    expect(waitingEntries(withReview, null)).toEqual([
      expect.objectContaining({ itemId: "review-1", name: "web#31" }),
      expect.objectContaining({ itemId: "task-1", name: "billing" }),
    ]);
  });

  it("leaves the open review out", () => {
    const withReview = makeState({
      reviews: [
        makeReviewSummary({
          id: "review-1",
          situations: [makeSituation({ id: "review-report", place: REVIEW_PLACE })],
        }),
      ],
    });

    expect(waitingEntries(withReview, "review-1")).toEqual([]);
  });

  it("is empty without tasks or reviews, or without a situation in them", () => {
    expect(waitingEntries(null, null)).toEqual([]);
    expect(waitingEntries(makeState({ tasks: null, reviews: null }), null)).toEqual([]);
    expect(
      waitingEntries(
        makeState({
          tasks: [makeTask({ situations: null })],
          reviews: [makeReviewSummary({ situations: null })],
        }),
        null,
      ),
    ).toEqual([]);
  });
});

describe("reviewName", () => {
  it("names a review by the short name of its repository and its number", () => {
    expect(reviewName(makeReviewSummary())).toBe("web#31");
  });
});

describe("reviewSituation", () => {
  it("finds the situation of a review", () => {
    const situation = makeSituation({ id: "report", kind: "review_report", place: REVIEW_PLACE });

    expect(reviewSituation(makeReviewSummary({ situations: [situation] }))?.id).toBe("report");
    expect(reviewSituation(makeReviewSummary({ situations: [] }))).toBeNull();
    expect(reviewSituation(makeReviewSummary({ situations: null }))).toBeNull();
  });
});

describe("the situation of a place", () => {
  const stage = makeSituation({ id: "stage", place: stagePlace("plan") });
  const step = makeSituation({ id: "step", kind: "step_empty", place: stepPlace(2) });
  const draft = makeSituation({ id: "draft", kind: "draft", place: PR_PLACE });

  it("finds the situation of the planning stage", () => {
    expect(stageSituation(makeTask({ situations: [step, stage] }))?.id).toBe("stage");
    expect(stageSituation(makeTask({ situations: [step] }))).toBeNull();
    expect(stageSituation(makeTask({ situations: null }))).toBeNull();
  });

  it("finds the situation of a step by its number", () => {
    const task = makeTask({ situations: [stage, step] });

    expect(stepSituation(task, 2)?.id).toBe("step");
    expect(stepSituation(task, 3)).toBeNull();
    expect(stepSituation(makeTask({ situations: null }), 2)).toBeNull();
  });

  it("finds the situation of the reviewer of a step by its number", () => {
    const reviewer = makeSituation({ id: "reviewer", kind: "question", place: reviewerPlace(2) });
    const task = makeTask({ situations: [step, reviewer] });

    expect(reviewerSituation(task, 2)?.id).toBe("reviewer");
    expect(reviewerSituation(task, 3)).toBeNull();
    expect(stepSituation(task, 2)?.id).toBe("step");
    expect(reviewerSituation(makeTask({ situations: null }), 2)).toBeNull();
  });

  it("finds the most urgent situation of a step, in either of its conversations", () => {
    const reviewer = makeSituation({ id: "reviewer", kind: "question", place: reviewerPlace(2) });
    const error = makeSituation({
      id: "error",
      kind: "session_error",
      group: "error",
      place: reviewerPlace(2),
    });

    expect(stepOrReviewerSituation(makeTask({ situations: [step, reviewer] }), 2)?.id).toBe("step");
    expect(stepOrReviewerSituation(makeTask({ situations: [error, step] }), 2)?.id).toBe("error");
    expect(stepOrReviewerSituation(makeTask({ situations: [reviewer] }), 2)?.id).toBe("reviewer");
    expect(stepOrReviewerSituation(makeTask({ situations: [stage, reviewer] }), 3)).toBeNull();
    expect(stepOrReviewerSituation(makeTask({ situations: null }), 2)).toBeNull();
  });

  it("finds the situation of the pull request", () => {
    expect(prSituation(makeTask({ situations: [stage, draft] }))?.id).toBe("draft");
    expect(prSituation(makeTask({ situations: [stage] }))).toBeNull();
    expect(prSituation(makeTask({ situations: null }))).toBeNull();
  });
});

describe("compactWait and spokenWait", () => {
  const now = Date.parse("2026-09-05T12:00:00Z");
  const second = 1000;
  const minute = 60 * second;
  const hour = 60 * minute;
  const day = 24 * hour;
  const ago = (ms: number) => new Date(now - ms).toISOString();

  it.each([
    ["0 s", ago(0), "now", "just now"],
    ["59 s", ago(59 * second), "now", "just now"],
    ["60 s", ago(60 * second), "1m", "1 minute"],
    ["59 min", ago(59 * minute + 59 * second), "59m", "59 minutes"],
    ["1 h", ago(hour), "1h", "1 hour"],
    ["23 h", ago(23 * hour + 59 * minute), "23h", "23 hours"],
    ["24 h", ago(day), "1d", "1 day"],
    ["3 d", ago(3 * day + 5 * hour), "3d", "3 days"],
    ["a start ahead of the clock", ago(-5 * minute), "now", "just now"],
    ["an invalid date", "not a date", "now", "just now"],
  ])("tells a wait of %s", (_wait, startedAt, compact, spoken) => {
    expect(compactWait(startedAt, now)).toBe(compact);
    expect(spokenWait(startedAt, now)).toBe(spoken);
  });
});
