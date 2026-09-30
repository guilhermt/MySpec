import { act, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ReviewsView } from "@/features/reviews/ReviewsView";
import { REVIEWS_SECTIONS_KEY } from "@/lib/ui-storage";
import { api, type PullRequestRow } from "@/lib/wails";
import { useAppStore } from "@/store/app-store";
import { renderWithStore } from "@/test/render";
import {
  makePullRequestRow,
  makeRepository,
  makeReviewCenter,
  makeReviewSummary,
  makeState,
  makeTask,
} from "@/test/wails-mock";

function pull(number: number, overrides: Partial<PullRequestRow> = {}): PullRequestRow {
  return makePullRequestRow({
    key: `dev/web#${number}`,
    number,
    title: `Pull ${number}`,
    url: `https://github.com/dev/web/pull/${number}`,
    ...overrides,
  });
}

const FIRST = pull(12, { updatedAt: "2026-09-16T12:00:00Z" });
const SECOND = pull(7, { updatedAt: "2026-09-15T12:00:00Z" });
const WATCHED = pull(9, {
  reviewId: "review-1",
  action: "open_review",
  updatedAt: "2026-09-14T12:00:00Z",
});
const OLD = pull(3, { pending: false, reviewed: true, updatedAt: "2026-09-01T12:00:00Z" });

function stateOf(pullRequests: PullRequestRow[], extra: Parameters<typeof makeState>[0] = {}) {
  return makeState({
    repositories: [makeRepository()],
    reviews: [makeReviewSummary({ id: "review-1", number: 9 })],
    tasks: [makeTask({ id: "task-1", name: "Login task" })],
    reviewCenter: makeReviewCenter({ readAt: "2026-09-16T12:00:00Z", pullRequests }),
    ...extra,
  });
}

function view(pullRequests: PullRequestRow[] = [FIRST, SECOND, WATCHED, OLD]) {
  return renderWithStore(<ReviewsView />, { state: stateOf(pullRequests) });
}

function row(number: number) {
  return screen.getByRole("treeitem", { name: new RegExp(`^web#${number} `) });
}

function header(name: string) {
  return screen.getByRole("treeitem", { name: new RegExp(`^${name},`) });
}

afterEach(() => {
  localStorage.clear();
});

describe("the keyboard of Reviews", () => {
  describe("the tree", () => {
    it("walks the headers and the rows with the arrows, Home and End", async () => {
      const { user } = view();
      row(12).focus();

      await user.keyboard("{ArrowDown}");
      expect(row(7)).toHaveFocus();
      await user.keyboard("{ArrowDown}");
      expect(header("In review")).toHaveFocus();
      await user.keyboard("{ArrowDown}{ArrowDown}");
      // Reviewed and Yours and your tasks start collapsed: Reviewed is followed by its header.
      expect(header("Reviewed")).toHaveFocus();
      await user.keyboard("{End}");
      expect(header("Yours and your tasks")).toHaveFocus();
      await user.keyboard("{ArrowDown}");
      expect(header("Yours and your tasks")).toHaveFocus();
      await user.keyboard("{ArrowUp}");
      expect(header("Reviewed")).toHaveFocus();
      await user.keyboard("{Home}");
      expect(header("Pending")).toHaveFocus();
      await user.keyboard("{ArrowUp}");
      expect(header("Pending")).toHaveFocus();
    });

    it("collapses and expands the sections with ←, → and Enter, and remembers them", async () => {
      const { user } = view();
      header("Pending").focus();

      await user.keyboard("{ArrowLeft}");
      expect(header("Pending")).toHaveAttribute("aria-expanded", "false");
      expect(screen.queryByText("Pull 12")).not.toBeInTheDocument();
      await user.keyboard("{ArrowRight}");
      expect(header("Pending")).toHaveAttribute("aria-expanded", "true");
      await user.keyboard("{ArrowRight}");
      expect(header("Pending")).toHaveAttribute("aria-expanded", "true");
      await user.keyboard("{Enter}");
      expect(header("Pending")).toHaveAttribute("aria-expanded", "false");
      await user.keyboard("{Enter}");
      expect(header("Pending")).toHaveAttribute("aria-expanded", "true");

      expect(JSON.parse(localStorage.getItem(REVIEWS_SECTIONS_KEY) ?? "null")).toEqual({
        collapsed: ["reviewed", "yours"],
      });
    });

    it("folds the section of a row with ← and puts the focus on its header", async () => {
      const { user } = view();
      row(7).focus();

      await user.keyboard("{ArrowLeft}");

      expect(header("Pending")).toHaveAttribute("aria-expanded", "false");
      expect(header("Pending")).toHaveFocus();
    });

    it("leaves an empty section alone", async () => {
      const { user } = view([FIRST]);
      header("In review").focus();

      await user.keyboard("{ArrowLeft}{Enter}{ArrowRight}");

      expect(header("In review")).not.toHaveAttribute("aria-expanded");
    });

    it("has one tab stop, which follows the focus", async () => {
      const { user } = view();
      const tree = screen.getByRole("tree");
      const stops = () =>
        within(tree)
          .getAllByRole("treeitem")
          .filter((item) => item.tabIndex === 0);

      expect(stops()).toEqual([row(12)]);
      act(() => row(7).focus());
      expect(stops()).toEqual([row(7)]);

      await user.keyboard("{ArrowDown}");
      expect(stops()).toEqual([header("In review")]);
    });

    it("moves the focus to the next row when the focused one leaves the reading", () => {
      view();
      row(12).focus();

      act(() => {
        useAppStore.getState().applyState(stateOf([SECOND, WATCHED, OLD]));
      });

      expect(row(7)).toHaveFocus();
    });

    it("moves the focus to the row before when no row comes after the one that leaves", () => {
      view();
      row(9).focus();

      act(() => {
        useAppStore.getState().applyState(stateOf([FIRST, SECOND, OLD]));
      });

      expect(row(7)).toHaveFocus();
    });
  });

  describe("Enter on a row", () => {
    it("does what R does, until the panel takes it", async () => {
      const { user } = view();
      row(12).focus();

      await user.keyboard("{Enter}");

      expect(useAppStore.getState().startReview).toEqual({ repositoryId: "repo-1", number: 12 });
    });
  });

  describe("R", () => {
    it("opens the dialog that starts a review on a pull request to review", async () => {
      const { user } = view();
      row(12).focus();

      await user.keyboard("r");

      expect(useAppStore.getState().startReview).toEqual({ repositoryId: "repo-1", number: 12 });
    });

    it("opens the dialog on a repository to clone too, which the dialog offers", async () => {
      const { user } = view([pull(12, { action: "clone" })]);
      row(12).focus();

      await user.keyboard("r");

      expect(useAppStore.getState().startReview).toEqual({ repositoryId: "repo-1", number: 12 });
    });

    it("opens the review the pull request has", async () => {
      const { user } = view();
      row(9).focus();

      await user.keyboard("R");

      expect(useAppStore.getState().location).toEqual({ kind: "review", id: "review-1" });
    });

    it("opens the task the pull request belongs to", async () => {
      const { user } = view([pull(5, { taskId: "task-1", action: "open_task", pending: false })]);
      await user.click(screen.getByRole("treeitem", { name: /^Yours and your tasks,/ }));
      row(5).focus();

      await user.keyboard("r");

      expect(useAppStore.getState().location).toEqual({ kind: "task", id: "task-1" });
    });

    it("says why it does nothing on a pull request from a fork", async () => {
      const { user } = view([pull(12, { action: "fork" })]);
      row(12).focus();

      await user.keyboard("r");

      expect(await screen.findByRole("status")).toHaveTextContent(
        "No review of web#12 · Pull requests from forks can't be reviewed yet.",
      );
      expect(useAppStore.getState().startReview).toBeNull();
    });

    it("says where the clone should be when it is gone", async () => {
      const { user } = view([pull(12, { action: "clone_missing" })]);
      row(12).focus();

      await user.keyboard("r");

      expect(await screen.findByRole("status")).toHaveTextContent("No review of web#12 · ");
      expect(screen.getByRole("status")).toHaveTextContent("/home/dev/projects/web");
      expect(useAppStore.getState().startReview).toBeNull();
    });

    it("does nothing on a header", async () => {
      const { user } = view();
      header("Pending").focus();

      await user.keyboard("r");

      expect(useAppStore.getState().startReview).toBeNull();
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
    });

    it("does nothing with a modifier", async () => {
      const { user } = view();
      row(12).focus();

      await user.keyboard("{Control>}r{/Control}");

      expect(useAppStore.getState().startReview).toBeNull();
    });
  });

  describe("O", () => {
    it("opens the pull request on GitHub, from a row of any action", async () => {
      const { user } = view([pull(12, { action: "fork" })]);
      row(12).focus();

      await user.keyboard("o");

      expect(api.openExternal).toHaveBeenCalledExactlyOnceWith(
        "https://github.com/dev/web/pull/12",
      );
    });

    it("does nothing on a header", async () => {
      const { user } = view();
      header("Pending").focus();

      await user.keyboard("o");

      expect(api.openExternal).not.toHaveBeenCalled();
    });
  });

  describe("Esc", () => {
    it("closes the notice, and leaves the focus on the row", async () => {
      const { user } = view([pull(12, { action: "fork" })]);
      row(12).focus();
      await user.keyboard("r");
      expect(await screen.findByRole("status")).toBeInTheDocument();

      await user.keyboard("{Escape}");

      await waitFor(() => expect(screen.queryByRole("status")).not.toBeInTheDocument());
      expect(row(12)).toHaveFocus();
    });

    it("is left to the global handler when there is no notice", () => {
      view();
      row(12).focus();

      const notCancelled = row(12).dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }),
      );

      expect(notCancelled).toBe(true);
    });
  });
});
