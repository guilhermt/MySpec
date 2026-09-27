import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ReviewHeader } from "@/features/reviews/ReviewHeader";
import { api, type ReviewSummary } from "@/lib/wails";
import { useAppStore } from "@/store/app-store";
import { renderWithStore } from "@/test/render";
import { makeReviewSummary, makeSituation, makeState } from "@/test/wails-mock";

function header(overrides: Partial<ReviewSummary> = {}) {
  const review = makeReviewSummary(overrides);
  return renderWithStore(<ReviewHeader review={review} />, {
    state: makeState({ reviews: [review] }),
    ui: { location: { kind: "review", id: review.id } },
  });
}

const CARD = {
  boardId: "board-1",
  number: 12,
  title: "Add the login screen",
  url: "https://github.com/dev/web/issues/12",
  status: "In review",
};

describe("ReviewHeader", () => {
  it("names the place after the pull request, with the mode and the state on the right", () => {
    header();

    expect(
      screen.getByRole("heading", { level: 1, name: "Add the login screen" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Publish")).toBeInTheDocument();
    expect(screen.getByText("Reviewing")).toBeInTheDocument();
  });

  it("leaves the number, the repository and the author to the tree", () => {
    header();

    expect(screen.queryByText("#31")).not.toBeInTheDocument();
    expect(screen.queryByText("web")).not.toBeInTheDocument();
    expect(screen.queryByText("alice")).not.toBeInTheDocument();
  });

  it("opens the card the pull request is linked to on GitHub", async () => {
    const { user } = header({ card: CARD });

    await user.click(screen.getByRole("button", { name: "Open card #12 on GitHub · In review" }));

    expect(api.openExternal).toHaveBeenCalledWith("https://github.com/dev/web/issues/12");
  });

  it("names the card by its number alone when the board gives it no status", () => {
    header({ card: { ...CARD, status: "" } });

    expect(screen.getByRole("button", { name: "Open card #12 on GitHub" })).toBeInTheDocument();
  });

  it("pauses the conversation of the review", async () => {
    const { user } = header();

    await user.click(screen.getByRole("button", { name: "Pause" }));

    expect(api.pause).toHaveBeenCalledWith("review-1", "review");
  });

  it("resumes a paused conversation", async () => {
    const { user } = header({ sessionStatus: "paused" });

    await user.click(screen.getByRole("button", { name: "Resume" }));

    expect(api.resume).toHaveBeenCalledWith("review-1", "review");
  });

  it("offers the reports panel and the deletion", async () => {
    const { user } = header();

    await user.click(screen.getByRole("button", { name: "Reports" }));
    expect(useAppStore.getState().panel).toBe("reports");
    expect(screen.getByRole("button", { name: "Reports" })).toHaveAttribute("aria-pressed", "true");

    await user.click(screen.getByRole("button", { name: "Delete review" }));
    expect(
      await screen.findByRole("heading", { name: "Delete the review of web#31?" }),
    ).toBeInTheDocument();
  });

  it("takes the colour of what waits for the user over the status", () => {
    const { container } = header({
      status: "awaiting_decision",
      situations: [
        makeSituation({
          taskId: "review-1",
          kind: "review_report",
          form: "decide",
          place: { kind: "review", stage: "", step: 0 },
        }),
      ],
    });

    expect(
      container.querySelector(".bg-\\[var\\(--status-attention-fill\\)\\]"),
    ).toBeInTheDocument();
  });
});
