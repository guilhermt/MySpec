import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ReviewAgainDialog } from "@/features/reviews/ReviewAgainDialog";
import { api, type ReviewSummary } from "@/lib/wails";
import { renderWithStore } from "@/test/render";
import { makeReviewFinding, makeReviewPass, makeReviewSummary, makeState } from "@/test/wails-mock";

function dialog(overrides: Partial<ReviewSummary> = {}) {
  const review = makeReviewSummary({ canReviewAgain: true, ...overrides });
  const onOpenChange = vi.fn();
  const view = renderWithStore(
    <ReviewAgainDialog review={review} open onOpenChange={onOpenChange} />,
    { state: makeState({ reviews: [review] }) },
  );
  return { ...view, onOpenChange };
}

describe("ReviewAgainDialog", () => {
  it("asks for another pass with the instructions the user wrote", async () => {
    const { user, onOpenChange } = dialog();

    await user.type(screen.getByLabelText("Instructions"), "Look at the migrations.");
    await user.click(screen.getByRole("button", { name: "Review again" }));

    expect(api.askReviewAgain).toHaveBeenCalledWith("review-1", "Look at the migrations.");
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("warns that the decisions of a pass never published go away", () => {
    dialog({
      passes: [makeReviewPass({ findings: [makeReviewFinding({ decision: "approved" })] })],
    });

    expect(
      screen.getByText("The decisions and edits of review 1 will be discarded."),
    ).toBeInTheDocument();
  });

  it("warns that the edits of a pass never published go away", () => {
    dialog({ passes: [makeReviewPass({ edited: true })] });

    expect(
      screen.getByText("The decisions and edits of review 1 will be discarded."),
    ).toBeInTheDocument();
  });

  it("says nothing about a pass nobody worked on", () => {
    dialog({ passes: [makeReviewPass()] });

    expect(screen.queryByText(/will be discarded/)).not.toBeInTheDocument();
  });

  it("says nothing about a pass already published", () => {
    dialog({
      passes: [
        makeReviewPass({
          published: true,
          verdict: "comment",
          edited: true,
          findings: [makeReviewFinding({ decision: "approved" })],
        }),
      ],
    });

    expect(screen.queryByText(/will be discarded/)).not.toBeInTheDocument();
  });

  it("shows a failure where the user asked for the pass", async () => {
    vi.mocked(api.askReviewAgain).mockRejectedValueOnce(new Error("The worktree is gone."));
    const { user } = dialog();

    await user.click(screen.getByRole("button", { name: "Review again" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("The worktree is gone.");
  });

  it("opens again without the error of the last attempt", async () => {
    vi.mocked(api.askReviewAgain).mockRejectedValueOnce(new Error("The worktree is gone."));
    const { user, rerender, onOpenChange } = dialog();
    await user.click(screen.getByRole("button", { name: "Review again" }));
    await screen.findByRole("alert");
    const review = makeReviewSummary({ canReviewAgain: true });

    rerender(<ReviewAgainDialog review={review} open={false} onOpenChange={onOpenChange} />);
    rerender(<ReviewAgainDialog review={review} open onOpenChange={onOpenChange} />);

    expect(screen.getByRole("heading", { name: "Review again" })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
