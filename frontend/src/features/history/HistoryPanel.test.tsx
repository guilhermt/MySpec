import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { HistoryPanel } from "@/features/history/HistoryPanel";
import { type ArchivedDiscussion, type ArchivedReview, api } from "@/lib/wails";
import { useAppStore } from "@/store/app-store";
import { renderWithStore } from "@/test/render";
import {
  makeArchivedDiscussion,
  makeArchivedReview,
  makeArchivedTask,
  makeRepository,
  makeState,
} from "@/test/wails-mock";

const WEB = makeRepository();
const API = makeRepository({
  id: "repo-2",
  name: "api",
  fullName: "dev/api",
  path: "/home/dev/projects/api",
});

const LOGIN = makeArchivedTask();
const HEADER = makeArchivedTask({
  id: "task-2",
  name: "fix-header",
  repositoryId: "repo-2",
  repository: "dev/api",
  steps: [],
  pr: null,
});

const REVIEW = makeArchivedReview({
  id: "review-31",
  title: "Cache the sessions",
  archivedAt: "2026-09-07T10:00:00Z",
});

const DISCUSSION = makeArchivedDiscussion({
  title: "The invoices",
  publishedCount: 2,
  archivedAt: "2026-09-06T10:00:00Z",
});

function panel(
  history = [LOGIN, HEADER],
  filter = "",
  reviewHistory: ArchivedReview[] = [],
  discussionHistory: ArchivedDiscussion[] = [],
) {
  return renderWithStore(<HistoryPanel />, {
    state: makeState({
      repositories: [WEB, API],
      repositoryFilter: filter,
      history,
      reviewHistory,
      discussionHistory,
    }),
  });
}

describe("HistoryPanel", () => {
  it("lists every archived task with what it touched", () => {
    panel();

    expect(screen.getByRole("heading", { name: "History" })).toBeInTheDocument();
    const [first, second] = screen.getAllByRole("listitem");
    expect(first).toHaveTextContent("add-login");
    expect(first).toHaveTextContent("web");
    expect(first).toHaveTextContent("#12");
    expect(first).toHaveTextContent("1 step");
    expect(second).toHaveTextContent("fix-header");
    expect(second).toHaveTextContent("api");
    expect(second).toHaveTextContent("0 steps");
  });

  it("labels a One-Shot task in place of its count of steps", () => {
    panel([makeArchivedTask({ mode: "one_shot" })]);

    const row = screen.getByRole("listitem");
    expect(row).toHaveTextContent("One-Shot");
    expect(row).not.toHaveTextContent("1 step");
  });

  it("says when each task began and when it ended", () => {
    panel([LOGIN]);

    const row = screen.getByRole("listitem");
    expect(row).toHaveTextContent(new Date(LOGIN.createdAt).getFullYear().toString());
    expect(row).toHaveTextContent(new Date(LOGIN.archivedAt).getFullYear().toString());
  });

  it("opens the pull request of a task without opening the task", async () => {
    const { user } = panel([LOGIN]);

    await user.click(screen.getByRole("button", { name: "#12" }));

    expect(api.openExternal).toHaveBeenCalledWith("https://github.com/dev/web/pull/12");
    expect(useAppStore.getState().location).toEqual({ kind: "home" });
  });

  it("opens the task the user picks", async () => {
    const { user } = panel();

    await user.click(screen.getByRole("button", { name: /fix-header/ }));

    expect(useAppStore.getState().location).toEqual({ kind: "archived-task", id: "task-2" });
  });

  it("opens the task from the keyboard", async () => {
    const { user } = panel([LOGIN]);

    screen.getByRole("button", { name: /add-login/ }).focus();
    await user.keyboard("{Enter}");

    expect(useAppStore.getState().location).toEqual({ kind: "archived-task", id: "task-1" });
  });

  it("keeps only the tasks whose name carries what was typed", async () => {
    const { user } = panel();

    await user.type(screen.getByRole("textbox", { name: "Search history" }), "login");

    expect(screen.getByRole("listitem")).toHaveTextContent("add-login");
    expect(useAppStore.getState().historyQuery).toBe("login");
  });

  it("says when the search finds nothing", async () => {
    const { user } = panel();

    await user.type(screen.getByRole("textbox", { name: "Search history" }), "nothing");

    expect(screen.getByText("Nothing matches “nothing”")).toBeInTheDocument();
    expect(screen.queryAllByRole("listitem")).toHaveLength(0);
  });

  it("keeps only the tasks of the repository of the filter", () => {
    panel([LOGIN, HEADER], "repo-2");

    expect(screen.getByRole("listitem")).toHaveTextContent("fix-header");
  });

  it("says when the repository of the filter has nothing archived", () => {
    panel([LOGIN], "repo-2");

    expect(screen.getByText("Nothing archived in api")).toBeInTheDocument();
    expect(screen.getByText("Choose another repository, or all of them.")).toBeInTheDocument();
  });

  it("says when nothing was ever archived", () => {
    panel([]);

    expect(screen.getByText("Nothing archived yet")).toBeInTheDocument();
    expect(
      screen.getByText(
        "A task comes here once it's closed, a review once its pull request is merged or closed, a discussion once it's archived.",
      ),
    ).toBeInTheDocument();
  });

  it("lists an archived review among the tasks, by when it ended", () => {
    panel([LOGIN], "", [REVIEW]);

    const [first, second] = screen.getAllByRole("listitem");
    expect(first).toHaveTextContent("add-login");
    expect(second).toHaveTextContent("Review");
    expect(second).toHaveTextContent("#31 Cache the sessions");
    expect(second).toHaveTextContent("web");
    expect(second).toHaveTextContent("alice");
    expect(second).toHaveTextContent("Merged");
  });

  it("finds a review by its #number", async () => {
    const { user } = panel([LOGIN], "", [REVIEW]);

    await user.type(screen.getByRole("textbox", { name: "Search history" }), "#31");

    expect(screen.getByRole("listitem")).toHaveTextContent("Cache the sessions");
  });

  it("keeps the reviews of the repository of the filter", () => {
    const { unmount } = panel([LOGIN, HEADER], "repo-2", [REVIEW]);

    expect(screen.getByRole("listitem")).toHaveTextContent("fix-header");
    unmount();

    panel([HEADER], "repo-1", [REVIEW]);

    expect(screen.getByRole("listitem")).toHaveTextContent("Cache the sessions");
  });

  it("opens the review the user picks", async () => {
    const { user } = panel([], "", [REVIEW]);

    await user.click(screen.getByRole("button", { name: /Cache the sessions/ }));

    expect(useAppStore.getState().location).toEqual({ kind: "archived-review", id: "review-31" });
  });

  it("lists an archived discussion with its board and what it published", () => {
    panel([], "", [], [DISCUSSION]);

    const row = screen.getByRole("listitem");
    expect(row).toHaveTextContent("Discussion");
    expect(row).toHaveTextContent("The invoices");
    expect(row).toHaveTextContent("Roadmap");
    expect(row).toHaveTextContent("2 cards published");
  });

  it("finds a discussion by its title", async () => {
    const { user } = panel([LOGIN], "", [], [DISCUSSION]);

    await user.type(screen.getByRole("textbox", { name: "Search history" }), "invoices");

    expect(screen.getByRole("listitem")).toHaveTextContent("The invoices");
  });

  it("keeps the discussions of the repository of the filter", () => {
    panel([HEADER], "repo-1", [], [DISCUSSION]);

    expect(screen.getByRole("listitem")).toHaveTextContent("The invoices");
  });

  it("opens the discussion the user picks", async () => {
    const { user } = panel([], "", [], [DISCUSSION]);

    await user.click(screen.getByRole("button", { name: /The invoices/ }));

    expect(useAppStore.getState().location).toEqual({
      kind: "archived-discussion",
      id: "discussion-1",
    });
  });
});
