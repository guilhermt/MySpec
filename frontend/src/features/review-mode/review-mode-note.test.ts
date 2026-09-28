import { describe, expect, it } from "vitest";
import { type ReviewModeNote, reviewModeNote } from "@/features/review-mode/review-mode-note";
import type { Step, TaskSummary } from "@/lib/wails";
import { makeStep, makeTask } from "@/test/wails-mock";

const done = (number: number) => makeStep({ number, status: "done" });
const follows = (number: number) => makeStep({ number });
const own = (number: number) => makeStep({ number, reviewModeAdjusted: true });

function planned(steps: Step[], task: Partial<TaskSummary> = {}): TaskSummary {
  return makeTask({ stage: "implementation", steps, ...task });
}

describe("reviewModeNote", () => {
  it.each<[string, TaskSummary, ReviewModeNote]>([
    [
      "before the plan",
      makeTask({ stage: "tech_spec", steps: [] }),
      { text: "Applies to the steps the plan writes.", disabled: false },
    ],
    [
      "with steps that follow the task",
      planned([done(1), done(2), done(3), follows(4), follows(5)]),
      { text: "Applies to the steps not started that follow the task: 4, 5.", disabled: false },
    ],
    [
      "with one step of its own mode",
      planned([done(1), done(2), done(3), own(4), follows(5), follows(6), follows(7)]),
      {
        text: "Applies to the steps not started that follow the task: 5, 6, 7. Step 4 has its own mode.",
        disabled: false,
      },
    ],
    [
      "with two steps of their own mode",
      planned([done(1), done(2), done(3), own(4), follows(5), own(6), follows(7)]),
      {
        text: "Applies to the steps not started that follow the task: 5, 7. Steps 4 and 6 have their own mode.",
        disabled: false,
      },
    ],
    [
      "with no step left to start",
      planned([done(1), makeStep({ number: 2, status: "implementing" })], {
        reviewModeEditable: false,
      }),
      { text: "No step is left to start, so the mode can't change.", disabled: true },
    ],
    [
      "with every step not started of its own mode",
      planned([done(1), own(2), own(3)], { reviewModeEditable: false }),
      { text: "Every step not started has its own mode.", disabled: true },
    ],
    [
      "in a One-Shot task, before the implementation",
      makeTask({ mode: "one_shot", stage: "one_shot" }),
      { text: "Applies to the implementation, before it starts.", disabled: false },
    ],
    [
      "in a One-Shot task, once the implementation started",
      makeTask({ mode: "one_shot", stage: "implementation", reviewModeEditable: false }),
      { text: "The implementation has started, so the mode can't change.", disabled: true },
    ],
  ])("says %s", (_, task, note) => {
    expect(reviewModeNote(task)).toEqual(note);
  });
});
