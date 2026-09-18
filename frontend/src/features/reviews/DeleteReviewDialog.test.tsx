import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DeleteReviewDialog } from "@/features/reviews/DeleteReviewDialog";
import { api } from "@/lib/wails";
import { renderWithStore } from "@/test/render";
import { makeReviewSummary, makeState } from "@/test/wails-mock";

function dialog() {
  const onOpenChange = vi.fn();
  const view = renderWithStore(
    <DeleteReviewDialog review={makeReviewSummary()} open onOpenChange={onOpenChange} />,
    { state: makeState() },
  );
  return { ...view, onOpenChange };
}

describe("DeleteReviewDialog", () => {
  it("says what the deletion takes and what it leaves on GitHub", () => {
    dialog();

    expect(
      screen.getByRole("heading", { name: "Delete the review of web#31?" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/What was published on GitHub stays/)).toBeInTheDocument();
  });

  it("deletes the review and closes", async () => {
    const { user, onOpenChange } = dialog();

    await user.click(screen.getByRole("button", { name: "Delete" }));

    expect(api.deleteReview).toHaveBeenCalledWith("review-1");
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
