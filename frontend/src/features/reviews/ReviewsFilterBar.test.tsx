import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ReviewsFilterBar } from "@/features/reviews/ReviewsFilterBar";
import { api, type ReviewCenter } from "@/lib/wails";
import { renderWithStore } from "@/test/render";
import {
  makeBoard,
  makeRepository,
  makeReviewCenter,
  makeReviewFilters,
  makeState,
} from "@/test/wails-mock";

function centerOf(center: Partial<ReviewCenter> = {}) {
  return makeReviewCenter({ authors: ["alice", "dependabot"], labels: ["bug"], ...center });
}

function bar(center: Partial<ReviewCenter> = {}) {
  return renderWithStore(<ReviewsFilterBar center={centerOf(center)} />, {
    state: makeState({ boards: [makeBoard()], repositories: [makeRepository()] }),
  });
}

describe("ReviewsFilterBar", () => {
  it("offers a board, a repository, the authors and the labels", () => {
    bar();

    expect(screen.getByRole("button", { name: "Board: Any" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Repository: Any" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Author: Any" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Label: Any" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Pending only" })).toBeInTheDocument();
  });

  it("filters by the repositories without a board", async () => {
    const { user } = bar();

    await user.click(screen.getByRole("button", { name: "Board: Any" }));
    await user.click(await screen.findByRole("menuitemradio", { name: "No board" }));

    expect(api.setReviewFilters).toHaveBeenCalledWith(
      expect.objectContaining({ boardId: "__none__" }),
    );
  });

  it("narrows the view to what waits for the user", async () => {
    const { user } = bar();

    await user.click(screen.getByRole("button", { name: "Pending only" }));

    expect(api.setReviewFilters).toHaveBeenCalledWith(
      expect.objectContaining({ pendingOnly: true }),
    );
  });

  it("clears every filter at once, and offers it only while filtering", async () => {
    bar();
    expect(screen.queryByRole("button", { name: "Clear filters" })).not.toBeInTheDocument();

    const { user } = bar({ filters: makeReviewFilters({ authorsExclude: ["dependabot"] }) });
    await user.click(screen.getByRole("button", { name: "Clear filters" }));

    expect(api.setReviewFilters).toHaveBeenCalledWith(
      expect.objectContaining({ authorsExclude: [], pendingOnly: false }),
    );
  });

  it("builds each click on the one before it, before the snapshot catches up", async () => {
    const { user } = bar();

    await user.click(screen.getByRole("button", { name: "Author: Any" }));
    await user.click(await screen.findByRole("menuitem", { name: "dependabot: not filtered" }));
    await user.click(screen.getByRole("menuitem", { name: "alice: not filtered" }));

    expect(api.setReviewFilters).toHaveBeenLastCalledWith(
      expect.objectContaining({ authorsExclude: ["dependabot", "alice"] }),
    );
    expect(screen.getByRole("menuitem", { name: "dependabot: excluded" })).toBeInTheDocument();
  });

  it("follows the snapshot again once it carries the choice", async () => {
    const { user, rerender } = bar();
    await user.click(screen.getByRole("button", { name: "Pending only" }));

    rerender(
      <ReviewsFilterBar center={centerOf({ filters: makeReviewFilters({ pendingOnly: true }) })} />,
    );
    rerender(<ReviewsFilterBar center={centerOf()} />);

    expect(screen.getByRole("button", { name: "Pending only" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("gives the view back to the snapshot when the choice is refused", async () => {
    vi.mocked(api.setReviewFilters).mockRejectedValueOnce(new Error("disk full"));
    const { user } = bar();

    await user.click(screen.getByRole("button", { name: "Pending only" }));

    await vi.waitFor(() =>
      expect(screen.getByRole("button", { name: "Pending only" })).toHaveAttribute(
        "aria-pressed",
        "false",
      ),
    );
  });
});
