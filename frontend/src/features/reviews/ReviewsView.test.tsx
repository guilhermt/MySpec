import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ReviewsView } from "@/features/reviews/ReviewsView";
import { api, type ReviewCenter, type State } from "@/lib/wails";
import { renderWithStore } from "@/test/render";
import {
  makePullRequestRow,
  makeRepository,
  makeReviewCenter,
  makeReviewFilters,
  makeState,
} from "@/test/wails-mock";

/** PLACEHOLDER_ROWS is how many rows ReviewsView stands in with, its SKELETON_ROWS. */
const PLACEHOLDER_ROWS = 6;

function view(center: Partial<ReviewCenter> = {}, state?: State) {
  const app =
    state ??
    makeState({
      repositories: [makeRepository()],
      reviewCenter: makeReviewCenter({ readAt: "2026-09-16T12:00:00Z", ...center }),
    });
  return renderWithStore(<ReviewsView />, { state: app });
}

describe("ReviewsView", () => {
  it("reads the pull requests as it opens", () => {
    view();

    expect(api.refreshPullRequests).toHaveBeenCalledOnce();
  });

  it("lists the pull requests the filters keep", () => {
    view({
      pullRequests: [
        makePullRequestRow({ key: "dev/web#31", number: 31 }),
        makePullRequestRow({ key: "dev/web#32", number: 32, title: "Fix the header" }),
        makePullRequestRow({ key: "dev/web#33", number: 33, title: "Bump deps", filtered: true }),
      ],
    });

    expect(screen.getByRole("main", { name: "Reviews" })).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(screen.queryByText("Bump deps")).not.toBeInTheDocument();
  });

  it("shows placeholder rows while the first reading runs", () => {
    const { container } = view({ readAt: "", reading: true });

    expect(screen.queryByRole("list")).not.toBeInTheDocument();
    expect(container.querySelectorAll('[data-slot="skeleton"]')).toHaveLength(PLACEHOLDER_ROWS);
  });

  it("says when nothing is open", () => {
    view();

    expect(screen.getByText("No open pull requests.")).toBeInTheDocument();
  });

  it("shows the repositories the reading failed on, and the pull requests of the others", () => {
    view({
      pullRequests: [makePullRequestRow()],
      failures: [{ repositoryId: "repo-2", repository: "dev/api", message: "No access." }],
    });

    expect(screen.getByRole("alert")).toHaveTextContent("dev/api: No access.");
    expect(screen.getByText("Add the login screen")).toBeInTheDocument();
  });

  it("offers to clear the filters when they hide everything", async () => {
    const { user } = view({
      pullRequests: [makePullRequestRow({ filtered: true })],
      filters: makeReviewFilters({ pendingOnly: true }),
    });

    expect(screen.getByText("No pull requests match the filters.")).toBeInTheDocument();
    // The bar offers it too; the empty state is the second.
    const [, clear] = screen.getAllByRole("button", { name: "Clear filters" });
    await user.click(clear as HTMLElement);

    expect(api.setReviewFilters).toHaveBeenCalledWith(
      expect.objectContaining({ pendingOnly: false }),
    );
  });

  it("asks for a repository when none is registered", () => {
    view({}, makeState({ repositories: [], reviewCenter: makeReviewCenter({ readAt: "x" }) }));

    expect(screen.getByText("Register a repository to see its pull requests.")).toBeInTheDocument();
  });
});
