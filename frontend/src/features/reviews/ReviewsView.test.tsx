import { screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ReviewsView } from "@/features/reviews/ReviewsView";
import { api, type ReviewCenter, type State } from "@/lib/wails";
import { useAppStore } from "@/store/app-store";
import { renderWithStore } from "@/test/render";
import {
  makePullRequestRow,
  makePullsFailure,
  makeRepository,
  makeReviewCenter,
  makeReviewFilters,
  makeReviewSummary,
  makeState,
} from "@/test/wails-mock";

afterEach(() => {
  localStorage.clear();
});

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

  it("lists the pull requests the filters keep, under the bar of filters, in a tree", () => {
    view({
      pullRequests: [
        makePullRequestRow({ key: "dev/web#31", number: 31 }),
        makePullRequestRow({ key: "dev/web#32", number: 32, title: "Fix the header" }),
        makePullRequestRow({ key: "dev/web#33", number: 33, title: "Bump deps", filtered: true }),
      ],
    });

    expect(screen.getByRole("region", { name: "Reviews" })).toBeInTheDocument();
    expect(screen.getByRole("search", { name: "Filter the pull requests" })).toBeInTheDocument();
    expect(
      screen.getByRole("tree", { name: "Open pull requests, by what they wait for" }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("treeitem", { name: /^web#3\d / })).toHaveLength(2);
    expect(screen.queryByText("Bump deps")).not.toBeInTheDocument();
  });

  describe("the sections", () => {
    const pullRequests = [
      makePullRequestRow({ key: "dev/web#1", number: 1, title: "Pending one" }),
      makePullRequestRow({
        key: "dev/web#2",
        number: 2,
        title: "Reviewed one",
        pending: false,
        reviewed: true,
      }),
      makePullRequestRow({ key: "dev/web#3", number: 3, title: "Mine", own: true, pending: false }),
    ];

    it("keeps the four sections in order, with the count of each, even an empty one", () => {
      view({ pullRequests });

      const headers = screen
        .getAllByRole("treeitem")
        .filter((item) => item.getAttribute("aria-level") === "1");
      expect(headers.map((header) => header.getAttribute("aria-label"))).toEqual([
        "Pending, 1 pull request",
        "In review, 0 pull requests",
        "Reviewed, 1 pull request",
        "Yours and your tasks, 1 pull request",
      ]);
      expect(headers[1]).not.toHaveAttribute("aria-expanded");
    });

    it("starts with Reviewed and Yours and your tasks collapsed", () => {
      view({ pullRequests });

      expect(screen.getByRole("treeitem", { name: /^Reviewed,/ })).toHaveAttribute(
        "aria-expanded",
        "false",
      );
      expect(screen.getByRole("treeitem", { name: /^Pending,/ })).toHaveAttribute(
        "aria-expanded",
        "true",
      );
      expect(screen.getByText("Pending one")).toBeInTheDocument();
      expect(screen.queryByText("Reviewed one")).not.toBeInTheDocument();
      expect(screen.queryByText("Mine")).not.toBeInTheDocument();
    });

    it("expands a section on a click and remembers it for the next run", async () => {
      const { user, unmount } = view({ pullRequests });

      await user.click(screen.getByRole("treeitem", { name: /^Reviewed,/ }));

      expect(screen.getByText("Reviewed one")).toBeInTheDocument();
      unmount();
      view({ pullRequests });
      expect(screen.getByText("Reviewed one")).toBeInTheDocument();
      expect(screen.queryByText("Mine")).not.toBeInTheDocument();
    });

    it("puts a pull request with a review in In review, the most recent first in a section", () => {
      const state = makeState({
        repositories: [makeRepository()],
        reviews: [makeReviewSummary({ id: "review-1", number: 4 })],
        reviewCenter: makeReviewCenter({
          readAt: "2026-09-16T12:00:00Z",
          pullRequests: [
            makePullRequestRow({
              key: "dev/web#4",
              number: 4,
              title: "With a review",
              reviewId: "review-1",
              action: "open_review",
            }),
            makePullRequestRow({
              key: "dev/web#5",
              number: 5,
              title: "Older",
              updatedAt: "2026-09-10T12:00:00Z",
            }),
            makePullRequestRow({
              key: "dev/web#6",
              number: 6,
              title: "Newer",
              updatedAt: "2026-09-15T12:00:00Z",
            }),
          ],
        }),
      });
      view({}, state);

      const names = screen.getAllByRole("treeitem").map((item) => item.getAttribute("aria-label"));
      expect(names.map((name) => name?.split(" ")[0])).toEqual([
        "Pending,",
        "web#6",
        "web#5",
        "In",
        "web#4",
        "Reviewed,",
        "Yours",
      ]);
    });
  });

  it("opens the dialog that starts a review on a click on the row, as before the panel", async () => {
    const { user } = view({ pullRequests: [makePullRequestRow()] });

    await user.click(screen.getByRole("treeitem", { name: /^web#31 / }));

    expect(useAppStore.getState().startReview).toEqual({ repositoryId: "repo-1", number: 31 });
  });

  it("says why a pull request from a fork cannot be reviewed when its row is clicked", async () => {
    const { user } = view({ pullRequests: [makePullRequestRow({ action: "fork" })] });

    await user.click(screen.getByRole("treeitem", { name: /^web#31 / }));

    expect(await screen.findByRole("status")).toHaveTextContent(
      "No review of web#31 · Pull requests from forks can't be reviewed yet.",
    );
    expect(useAppStore.getState().startReview).toBeNull();
  });

  describe("the states of the reading", () => {
    it("shows a skeleton of four bars and no bar while the first reading runs", () => {
      const { container } = view({ readAt: "", reading: true });

      expect(
        screen.getByRole("status", { name: "Reading the pull requests…" }),
      ).toBeInTheDocument();
      expect(container.querySelectorAll('[data-slot="skeleton"]')).toHaveLength(4);
      expect(screen.queryByRole("search")).not.toBeInTheDocument();
    });

    it("keeps the stored list while a reading runs, and says so in the header", () => {
      view({ reading: true, pullRequests: [makePullRequestRow()] });

      expect(screen.getByText("Add the login screen")).toBeInTheDocument();
      expect(screen.getByText("Reading…")).toBeInTheDocument();
    });

    it("asks for a repository when none is registered", () => {
      view({}, makeState({ repositories: [], reviewCenter: makeReviewCenter({ readAt: "x" }) }));

      expect(
        screen.getByText("Register a repository to see its pull requests."),
      ).toBeInTheDocument();
      expect(screen.queryByRole("search")).not.toBeInTheDocument();
    });

    it("says when nothing is open, with Read now and no bar", async () => {
      const { user } = view();

      expect(screen.getByText("No open pull requests.")).toBeInTheDocument();
      expect(screen.queryByRole("search")).not.toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: "Read now" }));

      // Once on opening, once on Read now.
      expect(api.refreshPullRequests).toHaveBeenCalledTimes(2);
    });

    it("offers to clear the filters when they hide everything, with the bar in sight", async () => {
      const { user } = view({
        pullRequests: [makePullRequestRow({ filtered: true })],
        filters: makeReviewFilters({ authorsExclude: ["dependabot"] }),
      });

      expect(screen.getByText("No pull requests match the filters.")).toBeInTheDocument();
      expect(screen.getByText("1 is open; the filters hide it.")).toBeInTheDocument();
      expect(screen.getByRole("search", { name: "Filter the pull requests" })).toBeInTheDocument();
      // The bar offers it too; the empty state is the second.
      const [, clear] = screen.getAllByRole("button", { name: "Clear filters" });
      await user.click(clear as HTMLElement);

      expect(api.setReviewFilters).toHaveBeenCalledWith(
        expect.objectContaining({ authorsExclude: [] }),
      );
    });
  });

  describe("the repositories that failed", () => {
    it("draws a strip for each, and lists the pull requests of the others", () => {
      view({
        pullRequests: [makePullRequestRow()],
        failures: [
          makePullsFailure({
            repositoryId: "repo-2",
            repository: "dev/api",
            message: "gh is not authenticated. Run gh auth login.",
          }),
        ],
      });

      const strip = screen.getByRole("alert");
      expect(strip).toHaveTextContent("Couldn't read dev/api");
      expect(strip).toHaveTextContent("gh is not authenticated. Run gh auth login.");
      expect(screen.getByText("Add the login screen")).toBeInTheDocument();
    });

    it("keeps the strip over an empty list", () => {
      view({
        readAt: "",
        failures: [makePullsFailure({ repository: "dev/web", message: "No access." })],
      });

      expect(screen.getByRole("alert")).toHaveTextContent("Couldn't read dev/web");
      expect(screen.getByText("No open pull requests.")).toBeInTheDocument();
    });

    it("reads again on Try again", async () => {
      const { user } = view({ failures: [makePullsFailure()] });

      await user.click(screen.getByRole("button", { name: "Try again" }));

      // Once on opening, once on Try again.
      expect(api.refreshPullRequests).toHaveBeenCalledTimes(2);
    });
  });
});
