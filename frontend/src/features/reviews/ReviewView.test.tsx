import { screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ReviewView } from "@/features/reviews/ReviewView";
import { api, type ReviewSummary } from "@/lib/wails";
import { renderWithStore } from "@/test/render";
import { makeReviewPass, makeReviewSummary, makeState } from "@/test/wails-mock";

function view(overrides: Partial<ReviewSummary> = {}) {
  return renderWithStore(<ReviewView reviewId="review-1" />, {
    state: makeState({ reviews: [makeReviewSummary(overrides)] }),
  });
}

describe("ReviewView", () => {
  it("puts the header, the bar, the conversation and the reports together", async () => {
    view();

    expect(screen.getByText("Add the login screen")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Reviewing");
    expect(screen.getByText("Reports")).toBeInTheDocument();
    await waitFor(() => {
      expect(api.getTranscript).toHaveBeenCalledWith("review-1", "review");
    });
  });

  it("shows the findings of the last pass above the conversation", () => {
    view({ status: "awaiting_decision", passes: [makeReviewPass()] });

    // The panel of the findings names the pass, and so does the list of reports.
    expect(screen.getAllByText("Review 1 · changes")).toHaveLength(2);
    expect(screen.getByLabelText("Finding 1")).toBeInTheDocument();
  });

  it("folds the reports panel away from the header", async () => {
    const { user } = view();

    await user.click(screen.getByRole("button", { name: "Reports" }));

    expect(screen.getByRole("button", { name: "Reports" })).toHaveAttribute("aria-pressed");
  });

  it("shows nothing at all for a review that is no longer there", () => {
    const { container } = renderWithStore(<ReviewView reviewId="review-9" />, {
      state: makeState({ reviews: [makeReviewSummary()] }),
    });

    expect(container.querySelector("header")).toBeNull();
  });
});
