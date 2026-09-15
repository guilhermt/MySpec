import { describe, expect, it } from "vitest";
import {
  fallbackReason,
  findStepReport,
  reviewModeHint,
  reviewModeLabel,
  stepReportLabel,
} from "@/lib/review-modes";
import type { ReviewFallback, ReviewMode } from "@/lib/wails";

describe("reviewModeLabel", () => {
  it.each([
    ["manual", "Manual"],
    ["agent", "Agent"],
  ] as const)("names the %s mode", (mode: ReviewMode, expected) => {
    expect(reviewModeLabel(mode)).toBe(expected);
  });
});

describe("reviewModeHint", () => {
  it.each([
    ["manual", "You review each step in VS Code before its commit."],
    ["agent", "An agent reviews each step, and the task runs to the pull request on its own."],
  ] as const)("says what the %s mode does to a task", (mode: ReviewMode, expected) => {
    expect(reviewModeHint(mode)).toBe(expected);
  });
});

describe("fallbackReason", () => {
  it.each([
    ["taken_over", "Taken over from the agent review"],
    ["rounds_exhausted", "The agent review didn't come clean after three rounds"],
    ["commit_failed", "The commit after the agent review didn't happen"],
    ["", ""],
  ] as const)(
    "says why the user reviewed a step that fell back for %j",
    (fallback: ReviewFallback, expected) => {
      expect(fallbackReason(fallback)).toBe(expected);
    },
  );
});

describe("stepReportLabel", () => {
  it.each([
    [true, "Review 2 · clean"],
    [false, "Review 2 · changes"],
  ])("names a report with its verdict (clean: %s)", (clean, expected) => {
    expect(stepReportLabel(2, clean)).toBe(expected);
  });
});

describe("findStepReport", () => {
  const first = { pass: 1, file: "1-review-1.md", clean: false };
  const second = { pass: 1, file: "2-review-1.md", clean: true };
  const steps = [
    { number: 1, reports: [first] },
    { number: 2, reports: [second] },
    { number: 3, reports: null },
  ];

  it("finds a report with the step that lists it", () => {
    expect(findStepReport(steps, "2-review-1.md")).toEqual({ step: steps[1], report: second });
  });

  it("finds nothing once no step lists the report", () => {
    expect(findStepReport(steps, "1-review-2.md")).toBeNull();
  });
});
