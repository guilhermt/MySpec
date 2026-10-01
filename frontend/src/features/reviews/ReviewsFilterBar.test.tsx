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
    state: makeState({
      boards: [makeBoard({ id: "board-1", title: "Mobile App" })],
      repositories: [makeRepository({ id: "repo-1", fullName: "acme/web" })],
    }),
  });
}

describe("ReviewsFilterBar", () => {
  it("is the search landmark of the pull requests, with the Filter menu and no chip", () => {
    bar();

    expect(screen.getByRole("search", { name: "Filter the pull requests" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Filter" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Remove the filter/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Clear filters" })).not.toBeInTheDocument();
  });

  it("offers the boards and No board, the repositories, the authors and the labels", async () => {
    const { user } = bar();

    await user.click(screen.getByRole("button", { name: "Filter" }));

    expect(await screen.findByRole("menuitemcheckbox", { name: "Mobile App" })).toBeInTheDocument();
    expect(screen.getByRole("menuitemcheckbox", { name: "No board" })).toBeInTheDocument();
    expect(screen.getByRole("menuitemcheckbox", { name: "acme/web" })).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: "alice: no filter. Click to cycle." }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: "bug: no filter. Click to cycle." }),
    ).toBeInTheDocument();
  });

  it("filters by the repositories without a board, and shows the chip", async () => {
    const { user } = bar();

    await user.click(screen.getByRole("button", { name: "Filter" }));
    await user.click(await screen.findByRole("menuitemcheckbox", { name: "No board" }));

    expect(api.setReviewFilters).toHaveBeenCalledWith(
      expect.objectContaining({ boardId: "__none__", boardName: "No board" }),
    );
    expect(screen.getByRole("button", { name: "Remove the filter Board: No board" })).toBeVisible();
  });

  it("keeps the name of the repository the filter was chosen with", async () => {
    const { user } = bar();

    await user.click(screen.getByRole("button", { name: "Filter" }));
    await user.click(await screen.findByRole("menuitemcheckbox", { name: "acme/web" }));

    expect(api.setReviewFilters).toHaveBeenCalledWith(
      expect.objectContaining({ repositoryId: "repo-1", repositoryName: "acme/web" }),
    );
  });

  it("marks a filter whose board is gone, and keeps filtering by it until the ×", async () => {
    const { user } = bar({
      filters: makeReviewFilters({ boardId: "board-9", boardName: "Old Board" }),
    });

    expect(screen.getByText("◇ Board: Old Board")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Remove the filter Board: Old Board" }));

    expect(api.setReviewFilters).toHaveBeenCalledWith(
      expect.objectContaining({ boardId: "", boardName: "" }),
    );
  });

  it("removes a chip by its ×, one per value of an author", async () => {
    const { user } = bar({
      filters: makeReviewFilters({ authorsExclude: ["dependabot"], authorsInclude: ["alice"] }),
    });

    expect(
      screen.getByRole("button", { name: "Remove the filter Author −dependabot" }),
    ).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Remove the filter Author +alice" }));

    expect(api.setReviewFilters).toHaveBeenCalledWith(
      expect.objectContaining({ authorsInclude: [], authorsExclude: ["dependabot"] }),
    );
  });

  it("has no Pending only switch: the Pending section says it", () => {
    bar({ filters: makeReviewFilters({ authorsExclude: ["dependabot"] }) });

    expect(screen.queryByRole("button", { name: "Pending only" })).not.toBeInTheDocument();
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

    await user.click(screen.getByRole("button", { name: "Filter" }));
    await user.click(
      await screen.findByRole("menuitem", { name: "dependabot: no filter. Click to cycle." }),
    );
    await user.click(screen.getByRole("menuitem", { name: "alice: no filter. Click to cycle." }));

    expect(api.setReviewFilters).toHaveBeenLastCalledWith(
      expect.objectContaining({ authorsExclude: ["dependabot", "alice"] }),
    );
    expect(
      screen.getByRole("menuitem", { name: "dependabot: hidden. Click to cycle." }),
    ).toBeInTheDocument();
  });

  it("walks an author from hidden to only", async () => {
    const { user } = bar();

    await user.click(screen.getByRole("button", { name: "Filter" }));
    const item = await screen.findByRole("menuitem", {
      name: "alice: no filter. Click to cycle.",
    });
    await user.click(item);
    await user.click(screen.getByRole("menuitem", { name: "alice: hidden. Click to cycle." }));

    expect(api.setReviewFilters).toHaveBeenLastCalledWith(
      expect.objectContaining({ authorsInclude: ["alice"], authorsExclude: [] }),
    );
  });

  it("follows the snapshot again once it carries the choice", async () => {
    const { user, rerender } = bar();
    await user.click(screen.getByRole("button", { name: "Filter" }));
    await user.click(await screen.findByRole("menuitemcheckbox", { name: "No board" }));

    rerender(
      <ReviewsFilterBar
        center={centerOf({ filters: makeReviewFilters({ boardId: "__none__" }) })}
      />,
    );
    rerender(<ReviewsFilterBar center={centerOf()} />);

    expect(screen.queryByRole("button", { name: /^Remove the filter/ })).not.toBeInTheDocument();
  });

  it("gives the bar back to the snapshot when the choice is refused", async () => {
    vi.mocked(api.setReviewFilters).mockRejectedValueOnce(new Error("disk full"));
    const { user } = bar();

    await user.click(screen.getByRole("button", { name: "Filter" }));
    await user.click(await screen.findByRole("menuitemcheckbox", { name: "No board" }));

    await vi.waitFor(() =>
      expect(
        screen.queryByRole("button", { name: "Remove the filter Board: No board" }),
      ).not.toBeInTheDocument(),
    );
  });
});
