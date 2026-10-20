import { describe, expect, it } from "vitest";
import type { PullRequest, Situation, Step } from "@/lib/wails";
import { firstPRTab, firstPRTabDecided, firstTab, firstTabDecided } from "@/store/step-tab";
import {
  makePRImplementer,
  makePullRequest,
  makeSituation,
  makeStep,
  makeStepReviewer,
  makeTask,
  makeTaskConversation,
} from "@/test/wails-mock";

const implementerAsks = (startedAt: string) =>
  makeSituation({
    id: "i",
    kind: "permission",
    place: { kind: "step", stage: "", step: 3 },
    startedAt,
  });
const reviewerAsks = (startedAt: string) =>
  makeSituation({
    id: "r",
    kind: "question",
    place: { kind: "step_review", stage: "", step: 3 },
    startedAt,
  });

const EARLY = "2026-09-27T14:00:00Z";
const LATE = "2026-09-27T14:30:00Z";

describe("firstTab", () => {
  it.each<[string, Partial<Step>, Situation[], string]>([
    [
      "both asking, the implementer first",
      { status: "agent_review" },
      [implementerAsks(EARLY), reviewerAsks(LATE)],
      "implementer",
    ],
    [
      "both asking, the reviewer first",
      { status: "addressing_review" },
      [implementerAsks(LATE), reviewerAsks(EARLY)],
      "reviewer",
    ],
    [
      "only the implementer asking",
      { status: "agent_review" },
      [implementerAsks(EARLY)],
      "implementer",
    ],
    [
      "only the reviewer asking",
      { status: "addressing_review" },
      [reviewerAsks(EARLY)],
      "reviewer",
    ],
    ["no one asking, during a pass", { status: "agent_review" }, [], "reviewer"],
    ["no one asking, during a round", { status: "addressing_review" }, [], "implementer"],
  ])("opens %s", (_, step, situations, tab) => {
    const current = makeStep({
      number: 3,
      reviewer: makeStepReviewer({ sessionStage: "step_review:3" }),
      ...step,
    });

    expect(firstTab(makeTask({ situations }), current)).toBe(tab);
  });

  it("opens the implementer in a pass whose reviewer has no session yet", () => {
    expect(
      firstTab(makeTask(), makeStep({ number: 3, status: "agent_review", reviewer: null })),
    ).toBe("implementer");
  });
});

describe("firstTabDecided", () => {
  it("is undecided in a pass whose reviewer has no session and no situation asks", () => {
    expect(
      firstTabDecided(makeTask(), makeStep({ number: 3, status: "agent_review", reviewer: null })),
    ).toBe(false);
  });

  it("is decided once the reviewer has a session", () => {
    expect(
      firstTabDecided(
        makeTask(),
        makeStep({
          number: 3,
          status: "agent_review",
          reviewer: makeStepReviewer({ sessionStage: "step_review:3" }),
        }),
      ),
    ).toBe(true);
  });

  it("is decided by the implementer's situation, reviewer or not", () => {
    expect(
      firstTabDecided(
        makeTask({ situations: [implementerAsks(EARLY)] }),
        makeStep({ number: 3, status: "agent_review", reviewer: null }),
      ),
    ).toBe(true);
  });

  it("is decided by the reviewer's situation, reviewer or not", () => {
    expect(
      firstTabDecided(
        makeTask({ situations: [reviewerAsks(EARLY)] }),
        makeStep({ number: 3, status: "agent_review", reviewer: null }),
      ),
    ).toBe(true);
  });
});

const fixAsks = (startedAt: string) =>
  makeSituation({
    id: "i",
    kind: "question",
    place: { kind: "pr_fix", stage: "", step: 0 },
    startedAt,
  });
const prReviewerAsks = (startedAt: string) =>
  makeSituation({
    id: "r",
    kind: "question",
    place: { kind: "pr", stage: "", step: 0 },
    startedAt,
  });

const reviewing = (pr: Partial<PullRequest> = {}) =>
  makePullRequest({ status: "reviewing", sessionStage: "pr_review", ...pr });

describe("firstPRTab", () => {
  it.each<[string, Partial<PullRequest>, Situation[], string]>([
    [
      "both asking, the implementer first",
      { implementer: makePRImplementer() },
      [fixAsks(EARLY), prReviewerAsks(LATE)],
      "implementer",
    ],
    [
      "both asking, the reviewer first",
      { implementer: makePRImplementer() },
      [fixAsks(LATE), prReviewerAsks(EARLY)],
      "reviewer",
    ],
    [
      "only the implementer asking",
      { implementer: makePRImplementer() },
      [fixAsks(EARLY)],
      "implementer",
    ],
    [
      "only the reviewer asking",
      { status: "addressing_review" },
      [prReviewerAsks(EARLY)],
      "reviewer",
    ],
    [
      "no one asking, while the implementer addresses the review",
      { status: "addressing_review", implementer: makePRImplementer() },
      [],
      "implementer",
    ],
    [
      "no one asking, while the implementer commits",
      { status: "committing", implementer: makePRImplementer() },
      [],
      "implementer",
    ],
    ["no one asking, during a pass", { implementer: makePRImplementer() }, [], "reviewer"],
    ["no one asking, without an implementer", { status: "addressing_review" }, [], "reviewer"],
  ])("opens %s", (_, pr, situations, tab) => {
    expect(firstPRTab(makeTask({ situations }), reviewing(pr))).toBe(tab);
  });
});

describe("firstPRTabDecided", () => {
  const reviewed = (situations: Situation[] = []) =>
    makeTask({
      situations,
      conversations: [makeTaskConversation({ stage: "pr_review" })],
    });

  it("is undecided while nothing but the reviewer's conversation exists", () => {
    expect(firstPRTabDecided(reviewed(), reviewing())).toBe(false);
  });

  it("is decided once the implementer has a session", () => {
    expect(firstPRTabDecided(reviewed(), reviewing({ implementer: makePRImplementer() }))).toBe(
      true,
    );
  });

  it.each([
    ["the implementer's", fixAsks(EARLY)],
    ["the reviewer's", prReviewerAsks(EARLY)],
  ])("is decided by %s situation", (_, situation) => {
    expect(firstPRTabDecided(reviewed([situation]), reviewing())).toBe(true);
  });

  it("is undecided without the reviewer's conversation, whatever else holds", () => {
    expect(firstPRTabDecided(makeTask(), reviewing({ implementer: makePRImplementer() }))).toBe(
      false,
    );
  });
});
