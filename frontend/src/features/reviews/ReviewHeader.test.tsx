import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ReviewHeader } from "@/features/reviews/ReviewHeader";
import { api, type ReviewSummary } from "@/lib/wails";
import { renderWithStore } from "@/test/render";
import { makeReviewSummary, makeSituation, makeState } from "@/test/wails-mock";

function header(overrides: Partial<ReviewSummary> = {}) {
  const review = makeReviewSummary(overrides);
  const onToggleArtifacts = vi.fn();
  const view = renderWithStore(
    <ReviewHeader review={review} artifactsOpen={false} onToggleArtifacts={onToggleArtifacts} />,
    { state: makeState({ reviews: [review] }) },
  );
  return { ...view, onToggleArtifacts };
}

describe("ReviewHeader", () => {
  it("names the pull request, its repository, its author and the mode", () => {
    header();

    expect(screen.getByText("#31")).toBeInTheDocument();
    expect(screen.getByText("Add the login screen")).toBeInTheDocument();
    expect(screen.getByText("web")).toBeInTheDocument();
    expect(screen.getByText("alice")).toBeInTheDocument();
    expect(screen.getByText("Publish")).toBeInTheDocument();
    expect(screen.getByText("Reviewing")).toBeInTheDocument();
  });

  it("shows the card the pull request is linked to", () => {
    header({
      card: {
        boardId: "board-1",
        number: 12,
        title: "Add the login screen",
        url: "https://github.com/dev/web/issues/12",
        status: "In review",
      },
    });

    expect(screen.getByRole("button", { name: "#12" })).toBeInTheDocument();
    expect(screen.getByText("In review")).toBeInTheDocument();
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
    const { user, onToggleArtifacts } = header();

    await user.click(screen.getByRole("button", { name: "Reports" }));
    expect(onToggleArtifacts).toHaveBeenCalledOnce();

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

    expect(container.querySelector(".bg-\\[var\\(--status-attention\\)\\]")).toBeInTheDocument();
  });
});
