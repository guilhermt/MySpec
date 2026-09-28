import { describe, expect, it } from "vitest";
import type { Situation, Step } from "@/lib/wails";
import { firstTab } from "@/store/step-tab";
import { makeSituation, makeStep, makeStepReviewer, makeTask } from "@/test/wails-mock";

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
