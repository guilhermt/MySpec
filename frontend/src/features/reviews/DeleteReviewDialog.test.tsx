import { screen, waitFor } from "@testing-library/react";
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

    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Delete the review of web#31?" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/What was published on GitHub stays/)).toBeInTheDocument();
  });

  it("opens on Cancel, not on the deletion", async () => {
    dialog();

    // The dialog moves the focus once it opens, after the button is drawn.
    await waitFor(() => expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus());
  });

  it("deletes the review and closes", async () => {
    const { user, onOpenChange } = dialog();

    await user.click(screen.getByRole("button", { name: "Delete review" }));

    expect(api.deleteReview).toHaveBeenCalledWith("review-1");
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("closes without deleting on Cancel", async () => {
    const { user, onOpenChange } = dialog();

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(api.deleteReview).not.toHaveBeenCalled();
    expect(onOpenChange.mock.calls[0]?.[0]).toBe(false);
  });
});
