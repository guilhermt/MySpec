import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PullRequestRow } from "@/features/reviews/PullRequestRow";
import { api, type PullRequestRow as Row, type State } from "@/lib/wails";
import { useAppStore } from "@/store/app-store";
import { renderWithStore } from "@/test/render";
import {
  makePullRequestRow,
  makeRepository,
  makeReviewSummary,
  makeState,
} from "@/test/wails-mock";

function row(overrides: Partial<Row> = {}, state: State = makeState()) {
  const pull = makePullRequestRow(overrides);
  return { ...renderWithStore(<PullRequestRow row={pull} />, { state }), pull };
}

describe("PullRequestRow", () => {
  it("shows the pull request, its repository and its author", () => {
    row();

    expect(screen.getByText("#31")).toBeInTheDocument();
    expect(screen.getByText("Add the login screen")).toBeInTheDocument();
    expect(screen.getByText("web")).toBeInTheDocument();
    expect(screen.getByText("alice")).toBeInTheDocument();
  });

  it("marks a pending pull request, in text as well as colour", () => {
    const { container } = row({ pending: true });

    expect(screen.getByText("Pending")).toBeInTheDocument();
    expect(container.querySelector('[data-pending="true"]')).toBeInTheDocument();
  });

  it("marks a draft and the pull request of a task of the product", () => {
    row({ draft: true, taskId: "task-1", action: "open_task" });

    expect(screen.getByText("Draft")).toBeInTheDocument();
    expect(screen.getByText("Task")).toBeInTheDocument();
  });

  it("says where the review of the pull request stands", () => {
    const state = makeState({
      reviews: [makeReviewSummary({ id: "review-1", status: "ready_to_publish" })],
    });
    row({ reviewId: "review-1", action: "open_review" }, state);

    expect(screen.getByText("Ready to publish")).toBeInTheDocument();
  });

  it("shows the card of the pull request and opens it on GitHub", async () => {
    const { user } = row({
      card: {
        boardId: "board-1",
        number: 12,
        title: "Add the login screen",
        url: "https://github.com/dev/web/issues/12",
        status: "In progress",
      },
    });

    await user.click(screen.getByRole("button", { name: "#12 · In progress" }));

    expect(api.openExternal).toHaveBeenCalledExactlyOnceWith(
      "https://github.com/dev/web/issues/12",
    );
  });

  it("says the user reviewed it, and when it moved since", () => {
    row({ reviewed: true });
    expect(screen.getByText("Reviewed")).toBeInTheDocument();

    row({ reviewed: true, newCommits: true });
    expect(screen.getByText("New commits")).toBeInTheDocument();
  });

  it("opens the pull request on GitHub", async () => {
    const { user } = row();

    await user.click(screen.getByRole("button", { name: "Open on GitHub" }));

    expect(api.openExternal).toHaveBeenCalledExactlyOnceWith("https://github.com/dev/web/pull/31");
  });

  it("opens the dialog that starts a review", async () => {
    const { user } = row();

    await user.click(screen.getByRole("button", { name: "Review" }));

    expect(useAppStore.getState().startReview).toEqual({ repositoryId: "repo-1", number: 31 });
  });

  it("opens the dialog for a repository that still has to be cloned", async () => {
    const { user } = row({ action: "clone" });

    await user.click(screen.getByRole("button", { name: "Review" }));

    expect(useAppStore.getState().startReview).toEqual({ repositoryId: "repo-1", number: 31 });
  });

  it("opens the review the pull request already has", async () => {
    const state = makeState({ reviews: [makeReviewSummary({ id: "review-1" })] });
    const { user } = row({ reviewId: "review-1", action: "open_review" }, state);

    await user.click(screen.getByRole("button", { name: "Open review" }));

    expect(useAppStore.getState().openReviewId).toBe("review-1");
  });

  it("opens the task the pull request belongs to", async () => {
    const { user } = row({ taskId: "task-1", action: "open_task" });

    await user.click(screen.getByRole("button", { name: "Open task" }));

    expect(useAppStore.getState().openTaskId).toBe("task-1");
  });

  it("refuses a pull request from a fork, and says why", async () => {
    const { user } = row({ action: "fork" });
    const button = screen.getByRole("button", { name: "Review" });

    expect(button).toBeDisabled();
    await user.hover(button);

    expect(
      await screen.findByText("Pull requests from forks can't be reviewed yet."),
    ).toBeInTheDocument();
  });

  it("refuses a pull request whose clone is gone, and says where it was", async () => {
    const state = makeState({ repositories: [makeRepository({ path: "/home/dev/web" })] });
    const { user } = row({ action: "clone_missing" }, state);

    await user.hover(screen.getByRole("button", { name: "Review" }));

    expect(await screen.findByText("The clone at /home/dev/web is missing.")).toBeInTheDocument();
  });
});
