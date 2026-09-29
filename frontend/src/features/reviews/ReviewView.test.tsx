import { screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ReviewView } from "@/features/reviews/ReviewView";
import { api, type ReviewSummary } from "@/lib/wails";
import { renderWithStore } from "@/test/render";
import {
  makeEntry,
  makeReview,
  makeReviewPass,
  makeReviewSummary,
  makeState,
  makeTranscript,
} from "@/test/wails-mock";

function view(overrides: Partial<ReviewSummary> = {}) {
  return renderWithStore(<ReviewView reviewId="review-1" />, {
    state: makeState({ reviews: [makeReviewSummary(overrides)] }),
    ui: { location: { kind: "review", id: "review-1" } },
  });
}

describe("ReviewView", () => {
  it("puts the header, the bar and the conversation together", async () => {
    view();

    expect(screen.getByText("Add the login screen")).toBeInTheDocument();
    expect(screen.getAllByRole("status")[0]).toHaveTextContent("Reviewing");
    expect(screen.getByText("Reports")).toBeInTheDocument();
    await waitFor(() => {
      expect(api.getTranscript).toHaveBeenCalledWith("review-1", "review");
    });
  });

  it("shows the findings of the last pass above the conversation", () => {
    view({ status: "awaiting_decision", passes: [makeReviewPass()] });

    expect(screen.getByText("Review 1 · changes")).toBeInTheDocument();
    expect(screen.getByLabelText("Finding 1")).toBeInTheDocument();
  });

  it("shows the changes of the agent for the user to stage in apply mode", () => {
    view({ mode: "apply", status: "in_review", review: makeReview() });

    expect(screen.getByRole("progressbar", { name: "Review progress" })).toHaveAttribute(
      "aria-valuenow",
      "50",
    );
    expect(screen.getByText("src/LoginForm.tsx")).toBeInTheDocument();
  });

  it("shows no changes while the findings are still to apply", () => {
    view({ mode: "apply", status: "ready_to_apply", review: makeReview() });

    expect(screen.queryByRole("progressbar", { name: "Review progress" })).toBeNull();
  });

  it("opens the reports panel from its button, and closes it with ×", async () => {
    const { user } = view();
    const button = () => screen.getByRole("button", { name: "Reports" });
    expect(screen.queryByRole("complementary", { name: "Reports" })).not.toBeInTheDocument();

    await user.click(button());
    expect(button()).toHaveAttribute("aria-pressed", "true");
    const panel = screen.getByRole("complementary", { name: "Reports" });
    expect(panel).toBeInTheDocument();

    await user.click(within(panel).getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("complementary", { name: "Reports" })).not.toBeInTheDocument();
    expect(button()).toHaveFocus();
  });

  it("shows nothing at all for a review that is no longer there", () => {
    const { container } = renderWithStore(<ReviewView reviewId="review-9" />, {
      state: makeState({ reviews: [makeReviewSummary()] }),
    });

    expect(container.querySelector("header")).toBeNull();
  });

  it("lets nothing but the conversation scroll in its column", () => {
    view();

    const column = screen.getByRole("textbox").closest(".overflow-clip");
    expect(column).not.toBeNull();
  });

  it("reads the conversation as a feed of the reviewer", async () => {
    vi.mocked(api.getTranscript).mockResolvedValueOnce(
      makeTranscript({
        taskId: "review-1",
        stage: "review",
        entries: [makeEntry("assistant"), makeEntry("error")],
      }),
    );
    view();

    const feed = await screen.findByRole("feed", { name: "Conversation with the reviewer" });
    expect(within(feed).getByRole("article", { name: /^Reviewer, / })).toHaveTextContent("On it.");
    expect(within(feed).getByRole("article", { name: /^Session error, / })).toBeInTheDocument();
  });
});
