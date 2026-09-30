import { screen } from "@testing-library/react";
import { useState } from "react";
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

/** Bar is the filter bar under the view that owns the pending-only switch. */
function Bar({ center }: { center: ReviewCenter }) {
  const [pendingOnly, setPendingOnly] = useState(false);
  return (
    <ReviewsFilterBar
      center={center}
      pendingOnly={pendingOnly}
      onPendingOnlyChange={setPendingOnly}
    />
  );
}

function bar(center: Partial<ReviewCenter> = {}) {
  return renderWithStore(<Bar center={centerOf(center)} />, {
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

  it("turns pending only on without asking Go to store it", async () => {
    const { user } = bar();

    await user.click(screen.getByRole("button", { name: "Pending only" }));

    expect(screen.getByRole("button", { name: "Pending only" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(api.setReviewFilters).not.toHaveBeenCalled();
  });

  it("clears pending only along with the filters", async () => {
    const { user } = bar();
    await user.click(screen.getByRole("button", { name: "Pending only" }));

    await user.click(screen.getByRole("button", { name: "Clear filters" }));

    expect(screen.getByRole("button", { name: "Pending only" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("clears every filter at once, and offers it only while filtering", async () => {
    bar();
    expect(screen.queryByRole("button", { name: "Clear filters" })).not.toBeInTheDocument();

    const { user } = bar({ filters: makeReviewFilters({ authorsExclude: ["dependabot"] }) });
    await user.click(screen.getByRole("button", { name: "Clear filters" }));

    expect(api.setReviewFilters).toHaveBeenCalledWith(
      expect.objectContaining({ authorsExclude: [] }),
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
    await user.click(screen.getByRole("button", { name: "Board: Any" }));
    await user.click(await screen.findByRole("menuitemradio", { name: "No board" }));

    rerender(<Bar center={centerOf({ filters: makeReviewFilters({ boardId: "__none__" }) })} />);
    rerender(<Bar center={centerOf()} />);

    expect(screen.getByRole("button", { name: "Board: Any" })).toBeInTheDocument();
  });

  it("gives the view back to the snapshot when the choice is refused", async () => {
    vi.mocked(api.setReviewFilters).mockRejectedValueOnce(new Error("disk full"));
    const { user } = bar();

    await user.click(screen.getByRole("button", { name: "Board: Any" }));
    await user.click(await screen.findByRole("menuitemradio", { name: "No board" }));

    await vi.waitFor(() =>
      expect(screen.getByRole("button", { name: "Board: Any" })).toBeInTheDocument(),
    );
  });
});
