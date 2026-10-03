import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ALL_REPOSITORIES } from "@/lib/repositories";
import {
  announcement,
  announcePlace,
  compactWait,
  compareSituations,
  counted,
  DURATION_SLOW_MS,
  discussionSituation,
  FLASH_MS,
  listed,
  nextWaiting,
  prSituation,
  reviewerSituation,
  reviewName,
  reviewSituation,
  situationFragment,
  situationLabel,
  situationPillState,
  situationTone,
  spokenWait,
  stageSituation,
  stepSituation,
  summaryLabel,
} from "@/lib/situations";
import type { Place } from "@/lib/wails";
import {
  makeDiscussion,
  makeReviewSummary,
  makeSituation,
  makeState,
  makeTask,
} from "@/test/wails-mock";

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
const DISCUSSION_PLACE: Place = { kind: "discussion", stage: "", step: 0 };

const ids = (situations: readonly { id: string }[]) => situations.map((situation) => situation.id);

describe("FLASH_MS", () => {
  it("lasts the two blinks of --duration-slow", () => {
    const tokens = readFileSync(
      join(import.meta.dirname, "../../../design/system/tokens.css"),
      "utf8",
    );

    expect(tokens).toContain(`--duration-slow: ${DURATION_SLOW_MS}ms`);
    expect(FLASH_MS).toBe(2 * DURATION_SLOW_MS);
  });
});

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
    ["findings", "", 0, "Decide findings"],
    ["findings", "decide", 0, "Decide findings"],
    ["findings", "apply", 0, "Ready to apply"],
    ["changes_review", "review", 0, "Review changes"],
    ["changes_review", "staged", 40, "Changes · 40% staged"],
    ["changes_review", "approve", 100, "Approve changes"],
    ["merge", "merge", 0, "Ready to merge"],
    ["merge", "close", 0, "Ready to close"],
    ["review_report", "decide", 0, "Decide findings"],
    ["review_report", "publish", 0, "Ready to publish"],
    ["review_report", "apply", 0, "Ready to apply"],
    ["new_commits", "", 0, "New commits"],
    ["drafts", "", 0, "Decide drafts"],
    ["epic_cant_publish", "", 0, "Epic can't publish"],
    ["epic_discarded", "", 0, "Epic discarded"],
    ["ready_to_archive", "", 0, "Ready to archive"],
    ["publish_failed", "", 0, "Publish failed"],
    ["pass_blocked", "", 0, "Pass blocked"],
    ["pr_trouble", "checks", 0, "Checks failed"],
    ["pr_trouble", "conflict", 0, "Conflict with base"],
    ["pr_trouble", "checks_conflict", 0, "Checks failed · conflict"],
  ])("names %s in the %s form", (kind, form, percent, label) => {
    const situation = makeSituation({ kind, form, percent, place: stepPlace(3) });

    expect(situationLabel(situation)).toBe(label);
  });

  it("says a review waits for the report where a task waits for a reply", () => {
    expect(situationLabel(makeSituation({ kind: "reply", place: REVIEW_PLACE }))).toBe(
      "Waiting for the report",
    );
    expect(situationLabel(makeSituation({ kind: "reply", place: PR_PLACE }))).toBe(
      "Waiting for reply",
    );
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

describe("nextWaiting", () => {
  const early = "2026-09-05T09:00:00Z";
  const late = "2026-09-05T11:00:00Z";
  const app = makeState({
    repositoryFilter: "repo-2",
    tasks: [
      makeTask({
        id: "task-1",
        name: "zeta",
        repositoryId: "repo-1",
        situations: [makeSituation({ id: "zeta-reply", startedAt: "2026-09-05T08:00:00Z" })],
      }),
      makeTask({
        id: "task-2",
        name: "billing",
        repositoryId: "repo-2",
        situations: [
          makeSituation({ id: "billing-reply", startedAt: late }),
          makeSituation({
            id: "billing-error",
            kind: "session_error",
            group: "error",
            startedAt: late,
          }),
        ],
      }),
    ],
    reviews: [
      makeReviewSummary({
        id: "review-1",
        title: "Rate limit",
        situations: [makeSituation({ id: "review-merge", group: "closing", startedAt: early })],
      }),
    ],
    discussions: [
      makeDiscussion({
        id: "discussion-1",
        title: "Onboarding",
        situations: [makeSituation({ id: "discussion-reply", startedAt: early })],
      }),
    ],
  });

  it.each([
    ["the most severe situation of all first", null, "billing-error"],
    ["the longest wait of the same group, leaving out the item on screen", "task-2", "zeta-reply"],
  ])("opens %s", (_case, open, expected) => {
    expect(nextWaiting(app, open)?.situation.id).toBe(expected);
  });

  it("takes the name between the same waits, and names the item as the tree does", () => {
    const tied = {
      ...app,
      tasks: [
        makeTask({ id: "task-9", name: "zeta", situations: [makeSituation({ startedAt: early })] }),
      ],
      reviews: [],
    };

    expect(nextWaiting(tied, null)).toMatchObject({
      itemId: "discussion-1",
      name: "Onboarding",
    });
  });

  it("gives the same item whatever the repository filter", () => {
    const all = nextWaiting({ ...app, repositoryFilter: ALL_REPOSITORIES }, null);
    // The filter keeps repo-1, and the most severe situation is billing's, in repo-2.
    const filtered = nextWaiting({ ...app, repositoryFilter: "repo-1" }, null);

    expect(filtered).toMatchObject({ itemId: "task-2", situation: { id: "billing-error" } });
    expect(filtered).toEqual(all);
  });

  it("takes a discussion ready to archive, a closing situation", () => {
    const closing = makeState({
      discussions: [
        makeDiscussion({
          id: "discussion-2",
          title: "Invoices",
          situations: [
            makeSituation({
              id: "ready",
              kind: "ready_to_archive",
              group: "closing",
              place: DISCUSSION_PLACE,
            }),
          ],
        }),
      ],
    });

    expect(nextWaiting(closing, null)).toMatchObject({
      itemId: "discussion-2",
      situation: { id: "ready" },
    });
  });

  it("is null when nothing waits", () => {
    expect(nextWaiting(makeState({ tasks: [makeTask({ situations: null })] }), null)).toBeNull();
  });
});

describe("announcement", () => {
  it.each([
    [makeSituation({ kind: "question", place: stagePlace("prd") }), "Login: question in PRD"],
    [
      makeSituation({ kind: "reply", place: stagePlace("tech_spec") }),
      "Login: waiting for reply in Tech spec",
    ],
    [
      makeSituation({ kind: "permission", place: stagePlace("one_shot") }),
      "Login: permission in Planning",
    ],
    [
      makeSituation({ kind: "step_empty", place: stepPlace(3) }),
      "Login: step 3 has no changes in Step 3",
    ],
    [makeSituation({ kind: "question", place: reviewerPlace(2) }), "Login: question in Reviewer"],
    [makeSituation({ kind: "draft", place: PR_PLACE }), "Login: draft to approve in PR"],
    [makeSituation({ kind: "new_commits", place: REVIEW_PLACE }), "Login: new commits"],
    [makeSituation({ kind: "drafts", place: DISCUSSION_PLACE }), "Login: decide drafts"],
    [
      makeSituation({ kind: "epic_cant_publish", place: DISCUSSION_PLACE }),
      "Login: epic can't publish",
    ],
    [makeSituation({ kind: "epic_discarded", place: DISCUSSION_PLACE }), "Login: epic discarded"],
    [
      makeSituation({ kind: "ready_to_archive", group: "closing", place: DISCUSSION_PLACE }),
      "Login: ready to archive",
    ],
  ])("tells %o as %s", (situation, expected) => {
    expect(announcement("Login", situation)).toBe(expected);
  });

  it("names no place for a review or a discussion before its first round", () => {
    expect(announcePlace(makeSituation({ place: REVIEW_PLACE }))).toBeNull();
    expect(announcePlace(makeSituation({ place: DISCUSSION_PLACE }))).toBeNull();
  });

  it("names the round of a discussion", () => {
    const situation = makeSituation({ kind: "drafts", place: DISCUSSION_PLACE });

    expect(announcePlace(situation, 2)).toBe("round 2");
    expect(announcement("Invoices", situation, 2)).toBe("Invoices: decide drafts in round 2");
    expect(situationFragment(situation, 1)).toBe("decide drafts in round 1");
  });
});

describe("situationFragment", () => {
  it.each([
    [makeSituation({ kind: "question", place: reviewerPlace(2) }), "question in Reviewer"],
    [makeSituation({ kind: "step_empty", place: stepPlace(3) }), "step 3 has no changes in Step 3"],
    [makeSituation({ kind: "new_commits", place: REVIEW_PLACE }), "new commits"],
    [makeSituation({ kind: "step_blocked", place: stepPlace(5) }), "step 5 blocked"],
    [makeSituation({ kind: "worktree_unreadable", place: stepPlace(5) }), "can't read worktree"],
    [makeSituation({ kind: "pr_blocked", place: PR_PLACE }), "PR blocked"],
    [makeSituation({ kind: "plan_invalid", place: stagePlace("plan") }), "plan still invalid"],
    [makeSituation({ kind: "findings", place: PR_PLACE }), "decide findings in PR review"],
    [
      makeSituation({ kind: "findings", form: "decide", place: PR_PLACE }),
      "decide findings in PR review",
    ],
    [
      makeSituation({ kind: "findings", form: "apply", place: PR_PLACE }),
      "ready to apply in PR review",
    ],
  ])("tells %o as %s", (situation, expected) => {
    expect(situationFragment(situation)).toBe(expected);
  });
});

describe("situationPillState", () => {
  const question = makeSituation({ kind: "question", place: reviewerPlace(2) });
  const failure = makeSituation({ kind: "session_error", group: "error", place: REVIEW_PLACE });
  const archive = makeSituation({
    kind: "ready_to_archive",
    group: "closing",
    place: { kind: "discussion", stage: "discussion", step: 0 },
  });

  it.each([
    [question, 1, "waiting for you: question in Reviewer"],
    [question, 3, "waiting for you: question in Reviewer, and 2 more"],
    [failure, 1, "error: session error"],
    [failure, 2, "error: session error, and 1 more"],
    [archive, 1, "ready to archive"],
    [archive, 2, "ready to archive, and 1 more"],
  ])("tells %o of %i as %s", (situation, count, expected) => {
    expect(situationPillState(situation, count)).toBe(expected);
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

describe("discussionSituation", () => {
  it("finds the situation of a discussion", () => {
    const situation = makeSituation({ id: "drafts", kind: "drafts", place: DISCUSSION_PLACE });

    expect(discussionSituation(makeDiscussion({ situations: [situation] }))?.id).toBe("drafts");
    expect(discussionSituation(makeDiscussion({ situations: [] }))).toBeNull();
    expect(discussionSituation(makeDiscussion({ situations: null }))).toBeNull();
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

describe("listed", () => {
  it.each<[string[], string]>([
    [[], ""],
    [["#455"], "#455"],
    [["#455", "#461"], "#455 and #461"],
    [["a", "b", "c"], "a, b and c"],
  ])("joins %j as %j", (items, want) => {
    expect(listed(items)).toBe(want);
  });
});

describe("counted", () => {
  it.each([
    [0, "0 findings"],
    [1, "1 finding"],
    [3, "3 findings"],
  ])("counts %i as %j", (count, want) => {
    expect(counted(count, "finding")).toBe(want);
  });
});
