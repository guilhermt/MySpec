import { act, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "@/app/App";
import { api } from "@/lib/wails";
import { useAppStore } from "@/store/app-store";
import { renderWithStore, resetAppStore } from "@/test/render";
import {
  makeArchivedReview,
  makeArchivedTask,
  makeBoard,
  makeMigration,
  makePullRequestRow,
  makeRepository,
  makeReviewCenter,
  makeReviewPass,
  makeReviewSummary,
  makeSituation,
  makeState,
  makeTask,
  subscriberCount,
} from "@/test/wails-mock";

beforeEach(() => {
  resetAppStore();
});

// Two tasks wait for the user: add-login for a reply, and fix-header for an
// error that started later.
// readyToPublish is the situation of a review whose findings were decided.
function readyToPublish(reviewId: string) {
  return makeSituation({
    id: `s-${reviewId}`,
    taskId: reviewId,
    kind: "review_report",
    form: "publish",
    place: { kind: "review", stage: "review", step: 0 },
  });
}

function waitingState() {
  return makeState({
    tasks: [
      makeTask({
        situations: [makeSituation({ id: "s-reply", startedAt: "2026-09-05T10:00:00Z" })],
      }),
      makeTask({
        id: "task-2",
        name: "fix-header",
        situations: [
          makeSituation({
            id: "s-error",
            taskId: "task-2",
            kind: "session_error",
            group: "error",
            startedAt: "2026-09-05T10:05:00Z",
          }),
        ],
      }),
    ],
  });
}

describe("App", () => {
  it("renders the shell once the first snapshot arrives", async () => {
    renderWithStore(<App />);

    expect(
      await screen.findByRole("button", { name: "Repository filter: All repositories" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Start" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Theme: System" })).toBeInTheDocument();
  });

  it("renders the welcome inside the shell when nothing is registered", async () => {
    vi.mocked(api.getState).mockResolvedValue(
      makeState({
        repositories: [],
        boards: [],
        tasks: [],
        reviews: [],
        discussions: [],
        history: [],
        reviewHistory: [],
        discussionHistory: [],
      }),
    );

    renderWithStore(<App />);

    expect(await screen.findByRole("heading", { name: "Welcome to MySpec" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Add board/ })).toHaveFocus();
    expect(screen.getByRole("button", { name: /^Add repository/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Settings" })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Repository filter: All repositories" }),
    ).not.toBeInTheDocument();
  });

  it("leaves the welcome once a board is registered, even without a repository", async () => {
    vi.mocked(api.getState).mockResolvedValue(
      makeState({ repositories: [], boards: [makeBoard()], tasks: [] }),
    );

    renderWithStore(<App />);

    expect(await screen.findByRole("button", { name: "Settings" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Welcome to MySpec" })).not.toBeInTheDocument();
  });

  it("renders the migration screen when the data could not be updated", async () => {
    vi.mocked(api.getState).mockResolvedValue(makeState({ migration: makeMigration() }));

    renderWithStore(<App />);

    expect(
      await screen.findByRole("heading", { name: "MySpec couldn't be updated" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Repository filter: All repositories" }),
    ).not.toBeInTheDocument();
  });

  it("gives a row of the tree the main area back from the settings", async () => {
    vi.mocked(api.getState).mockResolvedValue(waitingState());
    const { user } = renderWithStore(<App />);
    await screen.findByRole("tree", { name: "Active items" });

    await user.click(screen.getByRole("button", { name: "Settings" }));
    expect(await screen.findByRole("heading", { name: "Defaults" })).toBeInTheDocument();

    await user.click(screen.getByRole("treeitem", { name: /^task add-login\./ }));

    expect(screen.queryByRole("heading", { name: "Defaults" })).not.toBeInTheDocument();
    expect(await screen.findByRole("treeitem", { name: /^task add-login\./ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("shows a rejected binding at the top of the main area and dismisses it", async () => {
    vi.mocked(api.setRepositoryFilter).mockRejectedValueOnce(new Error("filter failed"));
    const { user } = renderWithStore(<App />);

    await user.click(
      await screen.findByRole("button", { name: "Repository filter: All repositories" }),
    );
    await user.click(await screen.findByRole("menuitemradio", { name: /dev\/web/ }));

    const notice = await screen.findByRole("alert");
    expect(notice).toHaveTextContent("Couldn't show the tasks of dev/web");
    expect(notice).toHaveTextContent("filter failed. Try again.");
    expect(screen.getByRole("main").firstElementChild).toBe(notice);

    await user.click(screen.getByRole("button", { name: "Dismiss" }));

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("unsubscribes when it unmounts", async () => {
    const { unmount } = renderWithStore(<App />);
    await screen.findByRole("button", { name: "Repository filter: All repositories" });

    unmount();

    await waitFor(() => {
      expect(subscriberCount()).toBe(0);
    });
  });

  it("swaps home for the task screen and back", async () => {
    vi.mocked(api.getState).mockResolvedValue(makeState({ tasks: [makeTask()] }));
    const { user } = renderWithStore(<App />);

    await user.click(await screen.findByRole("treeitem", { name: /^task add-login\./ }));

    expect(await screen.findByRole("button", { name: "More actions" })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Start" })).not.toBeInTheDocument();

    act(() => {
      useAppStore.getState().go({ kind: "home" });
    });

    expect(await screen.findByRole("region", { name: "Start" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "More actions" })).not.toBeInTheDocument();
  });

  it("opens the history over home and comes back to it", async () => {
    vi.mocked(api.getState).mockResolvedValue(makeState({ history: [makeArchivedTask()] }));
    const { user } = renderWithStore(<App />);

    await user.click(await screen.findByRole("button", { name: /^History/ }));

    expect(screen.getByRole("heading", { name: "History" })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Start" })).not.toBeInTheDocument();

    act(() => {
      useAppStore.getState().go({ kind: "home" });
    });

    expect(screen.getByRole("region", { name: "Start" })).toBeInTheDocument();
  });

  it("gives the main area to an archived task, and to a live one over it", async () => {
    vi.mocked(api.getState).mockResolvedValue(
      makeState({
        tasks: [makeTask()],
        history: [makeArchivedTask({ id: "old", name: "fix-header" })],
      }),
    );
    const { user } = renderWithStore(<App />);
    await screen.findByRole("treeitem", { name: /^task add-login\./ });

    await user.click(screen.getByRole("button", { name: /^History/ }));
    await user.click(screen.getByRole("button", { name: /fix-header/ }));

    expect(screen.getByText("Archived", { selector: "span" })).toBeInTheDocument();

    await user.click(screen.getByRole("treeitem", { name: /^task add-login\./ }));

    expect(screen.queryByText("Archived", { selector: "span" })).not.toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Artifacts" })).toBeInTheDocument();
  });

  it("gives the main area to a board view, and a task back over it", async () => {
    vi.mocked(api.getState).mockResolvedValue(
      makeState({ tasks: [makeTask()], boards: [makeBoard({ title: "Platform" })] }),
    );
    const { user } = renderWithStore(<App />);
    await screen.findByRole("treeitem", { name: /^task add-login\./ });

    act(() => {
      useAppStore.getState().openBoard("board-1");
    });

    expect(screen.getByRole("heading", { level: 1, name: "Platform" })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Start" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("treeitem", { name: /^task add-login\./ }));

    expect(screen.queryByRole("heading", { level: 1, name: "Platform" })).not.toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "More actions" })).toBeInTheDocument();
  });

  it("opens the creation dialog for a card once its clone is there", async () => {
    vi.mocked(api.getState).mockResolvedValue(
      makeState({ repositories: [makeRepository({ cloned: false, cloning: true, path: "" })] }),
    );
    renderWithStore(<App />);
    await screen.findByRole("region", { name: "Start" });

    act(() => {
      useAppStore
        .getState()
        .setPendingStart({ boardId: "board-1", key: "dev/web#12", repositoryId: "repo-1" });
      useAppStore.getState().applyState(makeState({ repositories: [makeRepository()] }));
    });

    expect(useAppStore.getState().newTaskOpen).toBe(true);
    expect(useAppStore.getState().pendingStart).toBeNull();
  });
  it("gives the main area to the Reviews view, and a task back over it", async () => {
    vi.mocked(api.getState).mockResolvedValue(
      makeState({
        tasks: [makeTask()],
        reviewCenter: makeReviewCenter({ readAt: "2026-09-16T12:00:00Z" }),
      }),
    );
    const { user } = renderWithStore(<App />);
    await screen.findByRole("treeitem", { name: /^task add-login\./ });

    act(() => {
      useAppStore.getState().openReviews();
    });

    expect(screen.getByRole("region", { name: "Reviews" })).toBeInTheDocument();
    expect(api.refreshPullRequests).toHaveBeenCalled();

    await user.click(screen.getByRole("treeitem", { name: /^task add-login\./ }));

    expect(screen.queryByRole("region", { name: "Reviews" })).not.toBeInTheDocument();
  });

  it("gives the main area to the screen of a review", async () => {
    vi.mocked(api.getState).mockResolvedValue(
      makeState({ tasks: [makeTask()], reviews: [makeReviewSummary()] }),
    );
    renderWithStore(<App />);
    await screen.findByRole("treeitem", { name: /^task add-login\./ });

    act(() => {
      useAppStore.getState().openReview("review-1");
    });

    expect(screen.getByRole("list", { name: /^Progress · Pass 1/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Details" })).toBeInTheDocument();
    await waitFor(() => {
      expect(api.getTranscript).toHaveBeenCalledWith("review-1", "review");
    });
  });

  it("starts the screen of another review afresh", async () => {
    vi.mocked(api.getState).mockResolvedValue(
      makeState({
        tasks: [makeTask()],
        reviews: [
          makeReviewSummary({
            status: "ready_to_publish",
            canPublish: true,
            passes: [makeReviewPass()],
            situations: [readyToPublish("review-1")],
          }),
          makeReviewSummary({
            id: "review-2",
            number: 32,
            own: true,
            verdicts: ["comment"],
            status: "ready_to_publish",
            canPublish: true,
            passes: [makeReviewPass()],
            situations: [readyToPublish("review-2")],
          }),
        ],
      }),
    );
    const { user } = renderWithStore(<App />);
    await screen.findByRole("treeitem", { name: /^task add-login\./ });

    act(() => {
      useAppStore.getState().openReview("review-1");
    });
    await user.click(screen.getByRole("button", { name: "Publish review…" }));
    expect(screen.getByRole("radio", { name: /Approve/ })).not.toBeChecked();
    await user.keyboard("2");
    expect(screen.getByRole("radio", { name: /Approve/ })).toBeChecked();
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    act(() => {
      useAppStore.getState().openReview("review-2");
    });
    await user.click(screen.getByRole("button", { name: "Publish review…" }));

    expect(screen.getByRole("radio", { name: /Comment/ })).toBeChecked();
    expect(screen.getByRole("radio", { name: /Approve/ })).not.toBeChecked();
  });

  it("gives the main area to an archived review, inside the history", async () => {
    vi.mocked(api.getState).mockResolvedValue(
      makeState({ tasks: [makeTask()], reviewHistory: [makeArchivedReview()] }),
    );
    renderWithStore(<App />);
    await screen.findByRole("treeitem", { name: /^task add-login\./ });

    act(() => {
      useAppStore.getState().openArchivedReview("review-1");
    });

    expect(
      screen.getByRole("heading", { level: 1, name: "Add the login screen" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Merged", { selector: "span" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Report · reviews/pass-1.md" })).toBeInTheDocument();
  });

  it("starts the review of a pull request from anywhere in the app", async () => {
    vi.mocked(api.getState).mockResolvedValue(
      makeState({ reviewCenter: makeReviewCenter({ pullRequests: [makePullRequestRow()] }) }),
    );
    renderWithStore(<App />);
    await screen.findByRole("region", { name: "Start" });

    act(() => {
      useAppStore.getState().openStartReview({ repositoryId: "repo-1", number: 31 });
    });

    expect(await screen.findByRole("heading", { name: "Review web#31" })).toBeInTheDocument();
  });

  it("opens the dialog that starts a review once the clone of its repository is there", async () => {
    vi.mocked(api.getState).mockResolvedValue(
      makeState({ repositories: [makeRepository({ cloned: false, cloning: true, path: "" })] }),
    );
    renderWithStore(<App />);
    await screen.findByRole("region", { name: "Start" });

    act(() => {
      useAppStore.getState().setPendingReview({ repositoryId: "repo-1", number: 31 });
      useAppStore.getState().applyState(makeState({ repositories: [makeRepository()] }));
    });

    expect(useAppStore.getState().startReview).toEqual({ repositoryId: "repo-1", number: 31 });
    expect(useAppStore.getState().pendingReview).toBeNull();
  });
});
