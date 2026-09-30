import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ReviewComposer } from "@/features/reviews/ReviewComposer";
import type { ReviewSummary } from "@/lib/wails";
import { renderWithStore } from "@/test/render";
import {
  makeReviewFinding,
  makeReviewPass,
  makeReviewSummary,
  makeSituation,
  makeState,
} from "@/test/wails-mock";

function composer(overrides: Partial<ReviewSummary> = {}) {
  const review = makeReviewSummary({
    sessionStatus: "waiting",
    turnRunning: false,
    processRunning: false,
    ...overrides,
  });
  return renderWithStore(<ReviewComposer review={review} />, {
    state: makeState({ reviews: [review] }),
  });
}

const field = () => screen.getByRole("textbox", { name: "Reply to the reviewer" });

describe("ReviewComposer", () => {
  it("asks for a change in a finding of a pass not yet published", () => {
    composer({
      status: "awaiting_decision",
      passes: [makeReviewPass({ findings: [makeReviewFinding()] })],
    });

    expect(field()).toHaveAttribute(
      "placeholder",
      "Ask the reviewer to add, change or drop a finding…",
    );
  });

  it("asks for a change in what the agent made applying the findings", () => {
    composer({ mode: "apply", status: "in_review", passes: [makeReviewPass({ sent: true })] });

    expect(field()).toHaveAttribute("placeholder", "Ask the reviewer for a change…");
  });

  it("answers a published pass like any conversation", () => {
    composer({ status: "published", passes: [makeReviewPass({ published: true })] });

    expect(field()).toHaveAttribute("placeholder", "Reply to the reviewer…");
  });

  it("says that sending resumes the review while it is paused", () => {
    composer({ sessionStatus: "paused" });

    expect(field()).toHaveAttribute("placeholder", "Sending resumes the review…");
  });

  it("sends with a secondary Send while the bar holds the primary", () => {
    composer({
      status: "ready_to_publish",
      situations: [
        makeSituation({
          kind: "review_report",
          form: "publish",
          taskId: "review-1",
          place: { kind: "review", stage: "review", step: 0 },
        }),
      ],
      passes: [makeReviewPass()],
    });

    expect(screen.getByRole("button", { name: /Send/ })).toHaveAttribute(
      "data-variant",
      "secondary",
    );
  });
});
