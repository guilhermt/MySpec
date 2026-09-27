import { act, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { StartReviewDialog } from "@/features/reviews/StartReviewDialog";
import { api, type PullRequestRow, type Repository } from "@/lib/wails";
import { useAppStore } from "@/store/app-store";
import { renderWithStore } from "@/test/render";
import { makePullRequestRow, makeRepository, makeReviewCenter, makeState } from "@/test/wails-mock";

const PULL = { repositoryId: "repo-1", number: 31 };

function dialog(row: Partial<PullRequestRow> = {}, repository: Partial<Repository> = {}) {
  const state = makeState({
    repositories: [makeRepository(repository)],
    reviewCenter: makeReviewCenter({ pullRequests: [makePullRequestRow(row)] }),
  });
  return renderWithStore(<StartReviewDialog />, { state, ui: { startReview: PULL } });
}

describe("StartReviewDialog", () => {
  it("shows nothing until a pull request is chosen", () => {
    renderWithStore(<StartReviewDialog />, { state: makeState() });

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("sums up the pull request and starts its review with the defaults", async () => {
    vi.mocked(api.startReview).mockResolvedValue("review-1");
    const { user } = dialog();

    expect(screen.getByText("#31 Add the login screen")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Start review" }));

    expect(api.startReview).toHaveBeenCalledExactlyOnceWith({
      repositoryId: "repo-1",
      number: 31,
      instructions: "",
      model: "claude-opus-5-5[1m]",
      effort: "high",
      mode: "publish",
    });
    await waitFor(() =>
      expect(useAppStore.getState().location).toEqual({ kind: "review", id: "review-1" }),
    );
    expect(useAppStore.getState().startReview).toBeNull();
  });

  it("sends the instructions of the pass", async () => {
    vi.mocked(api.startReview).mockResolvedValue("review-1");
    const { user } = dialog();

    await user.type(screen.getByLabelText("Instructions"), "Watch the migrations.");
    await user.click(screen.getByRole("button", { name: "Start review" }));

    expect(api.startReview).toHaveBeenCalledWith(
      expect.objectContaining({ instructions: "Watch the migrations." }),
    );
  });

  it("starts the review on Ctrl+Enter from the instructions", async () => {
    vi.mocked(api.startReview).mockResolvedValue("review-1");
    const { user } = dialog();

    await user.click(screen.getByLabelText("Instructions"));
    await user.keyboard("{Control>}{Enter}{/Control}");

    expect(api.startReview).toHaveBeenCalledOnce();
  });

  it("offers publish and apply only for a pull request of the user", async () => {
    dialog();
    expect(screen.queryByRole("group", { name: "Mode" })).not.toBeInTheDocument();

    vi.mocked(api.startReview).mockResolvedValue("review-1");
    const { user } = dialog({ own: true });
    await user.click(screen.getByRole("button", { name: "Apply" }));
    await user.click(screen.getByRole("button", { name: "Start review" }));

    expect(api.startReview).toHaveBeenCalledWith(expect.objectContaining({ mode: "apply" }));
  });

  it("offers the clone of a repository that has none, and waits for it", async () => {
    vi.mocked(api.cloneRepository).mockResolvedValue(true);
    const { user } = dialog({}, { cloned: false, path: "" });

    expect(screen.getByRole("button", { name: "Start review" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Clone and continue" }));

    expect(api.cloneRepository).toHaveBeenCalledExactlyOnceWith("repo-1");
    await waitFor(() => expect(useAppStore.getState().pendingReview).toEqual(PULL));
    expect(useAppStore.getState().startReview).toBeNull();
  });

  it("shows what the start failed with, and stays open", async () => {
    vi.mocked(api.startReview).mockRejectedValue(new Error("The worktree couldn't be created."));
    const { user } = dialog();

    await user.click(screen.getByRole("button", { name: "Start review" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("The worktree couldn't be created.");
    expect(useAppStore.getState().startReview).toEqual(PULL);
  });

  it("starts afresh when it is opened for another pull request", async () => {
    vi.mocked(api.startReview).mockResolvedValue("review-1");
    const state = makeState({
      repositories: [makeRepository()],
      reviewCenter: makeReviewCenter({
        pullRequests: [
          makePullRequestRow(),
          makePullRequestRow({ number: 32, title: "Fix the header" }),
        ],
      }),
    });
    const { user } = renderWithStore(<StartReviewDialog />, {
      state,
      ui: { startReview: { repositoryId: "repo-1", number: 32 } },
    });
    await user.type(screen.getByLabelText("Instructions"), "Watch the migrations.");

    act(() => {
      useAppStore.getState().openStartReview(PULL);
    });

    expect(await screen.findByText("#31 Add the login screen")).toBeInTheDocument();
    expect(screen.getByLabelText("Instructions")).toHaveValue("");
  });

  it("explains a pull request that left the last reading", () => {
    renderWithStore(<StartReviewDialog />, {
      state: makeState({ reviewCenter: makeReviewCenter({ pullRequests: [] }) }),
      ui: { startReview: PULL },
    });

    expect(screen.getByText("This pull request isn't in the last reading.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Start review" })).not.toBeInTheDocument();
  });

  it("closes without starting anything on Cancel", async () => {
    const { user } = dialog();

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(api.startReview).not.toHaveBeenCalled();
    expect(useAppStore.getState().startReview).toBeNull();
  });
});
