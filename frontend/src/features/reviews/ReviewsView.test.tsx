import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ReviewsView } from "@/features/reviews/ReviewsView";
import { api, type ReviewCenter, type State } from "@/lib/wails";
import { renderWithStore } from "@/test/render";
import {
  makePullRequestRow,
  makePullsFailure,
  makeRepository,
  makeReviewCenter,
  makeReviewFilters,
  makeState,
} from "@/test/wails-mock";

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

  it("lists the pull requests the filters keep, under the bar of filters", () => {
    view({
      pullRequests: [
        makePullRequestRow({ key: "dev/web#31", number: 31 }),
        makePullRequestRow({ key: "dev/web#32", number: 32, title: "Fix the header" }),
        makePullRequestRow({ key: "dev/web#33", number: 33, title: "Bump deps", filtered: true }),
      ],
    });

    expect(screen.getByRole("region", { name: "Reviews" })).toBeInTheDocument();
    expect(screen.getByRole("search", { name: "Filter the pull requests" })).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(screen.queryByText("Bump deps")).not.toBeInTheDocument();
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

  describe("pending only", () => {
    const pullRequests = [
      makePullRequestRow({ key: "dev/web#31", number: 31, pending: true }),
      makePullRequestRow({
        key: "dev/web#32",
        number: 32,
        title: "Fix the header",
        pending: false,
      }),
    ];

    it("hides the pull requests that do not wait for the user", async () => {
      const { user } = view({ pullRequests });

      await user.click(screen.getByRole("button", { name: "Pending only" }));

      expect(screen.getAllByRole("listitem")).toHaveLength(1);
      expect(screen.queryByText("Fix the header")).not.toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "Pending only" }));

      expect(screen.getAllByRole("listitem")).toHaveLength(2);
    });

    it("says nothing matches when it hides everything, and Clear filters turns it off", async () => {
      const { user } = view({
        pullRequests: [makePullRequestRow({ key: "dev/web#32", pending: false })],
      });
      await user.click(screen.getByRole("button", { name: "Pending only" }));

      expect(screen.getByText("No pull requests match the filters.")).toBeInTheDocument();
      const [, clear] = screen.getAllByRole("button", { name: "Clear filters" });
      await user.click(clear as HTMLElement);

      expect(screen.getByRole("button", { name: "Pending only" })).toHaveAttribute(
        "aria-pressed",
        "false",
      );
      expect(screen.getAllByRole("listitem")).toHaveLength(1);
    });
  });
});
