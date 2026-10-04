import { act, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HistoryView } from "@/features/history/HistoryView";
import { api } from "@/lib/wails";
import { type AppStore, useAppStore } from "@/store/app-store";
import { renderWithStore } from "@/test/render";
import {
  makeArchivedDiscussion,
  makeArchivedReview,
  makeArchivedTask,
  makeHistorySummary,
  makeRepository,
  makeState,
} from "@/test/wails-mock";

const NOW = new Date(2026, 8, 24, 15, 10);
const at = (day: number, hour: number) => new Date(2026, 8, day, hour, 2).toISOString();

const TODAY = makeArchivedTask({ id: "task-1", name: "Idempotency keys", archivedAt: at(24, 15) });
const REVIEW = makeArchivedReview({
  id: "review-1",
  title: "Retry the export",
  number: 88,
  archivedAt: at(24, 13),
});
const OLD = makeArchivedDiscussion({
  id: "discussion-1",
  title: "Webhook delivery",
  archivedAt: at(21, 11),
  repositoryIds: ["repo-2"],
});
const WEB = makeRepository({ archivedTasks: 1, archivedReviews: 1 });
const API = makeRepository({
  id: "repo-2",
  name: "api",
  fullName: "dev/api",
  archivedDiscussions: 1,
});

function view(
  overrides: Parameters<typeof makeState>[0] = {},
  query = "",
  ui: Partial<AppStore> = {},
) {
  return renderWithStore(<HistoryView />, {
    state: makeState({
      repositories: [WEB, API],
      history: [TODAY],
      reviewHistory: [REVIEW],
      discussionHistory: [OLD],
      historySummary: makeHistorySummary({
        tasks: 1,
        reviews: 1,
        discussions: 1,
        oldest: at(21, 11),
      }),
      ...overrides,
    }),
    ui: { location: { kind: "history" }, historyQuery: query, ...ui },
  });
}

/** levelOf are the treeitems of a level: the days are 1, the rows 2. */
function levelOf(level: number): HTMLElement[] {
  return screen
    .getAllByRole("treeitem")
    .filter((item) => item.getAttribute("aria-level") === String(level));
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("HistoryView", () => {
  it("lists the items by day, as a tree named History", () => {
    view();

    const tree = screen.getByRole("tree", { name: "History" });
    expect(levelOf(1).map((item) => item.getAttribute("aria-label"))).toEqual([
      "Archived today: 2",
      "Archived on Monday, Sep 21: 1",
    ]);
    expect(
      within(tree).getByRole("treeitem", {
        name: "Task Idempotency keys, web, PR #12 · 1 step, archived today at 15:02",
      }),
    ).toBeInTheDocument();
    expect(levelOf(2)).toHaveLength(3);
  });

  it("starts with the focus on the search and says the whole History in the bar", () => {
    view();

    expect(screen.getByRole("searchbox", { name: "Search History" })).toHaveFocus();
    expect(screen.getByRole("search", { name: "Search History" })).toHaveTextContent(
      "3 archived · Sep 21 – today",
    );
  });

  it("starts with the focus on the row a deletion asked for, once", () => {
    view({}, "", { historyFocus: "review-1" });

    expect(screen.getByRole("treeitem", { name: /^Review Retry the export/ })).toHaveFocus();
    expect(useAppStore.getState().historyFocus).toBeNull();
  });

  it("opens each kind of item on a click", async () => {
    const { user } = view();

    await user.click(screen.getByRole("treeitem", { name: /^Review Retry/ }));
    expect(useAppStore.getState().location).toEqual({ kind: "archived-review", id: "review-1" });

    act(() => useAppStore.getState().go({ kind: "history" }));
    await user.click(screen.getByRole("treeitem", { name: /^Discussion Webhook/ }));
    expect(useAppStore.getState().location).toEqual({
      kind: "archived-discussion",
      id: "discussion-1",
    });
  });

  it("narrows by the search and counts what matches over the total, busy until the Go answers", async () => {
    const { user } = view();

    await user.type(screen.getByRole("searchbox", { name: "Search History" }), "#88");

    expect(levelOf(2)).toHaveLength(1);
    const count = screen.getByText("1 of 3 · Sep 21 – today");
    expect(count.closest("[aria-busy]")).toHaveAttribute("aria-busy", "true");
  });

  it("shows the chip of the filter, with the tooltip, and clears the filter from it", async () => {
    const { user } = view({ repositoryFilter: "repo-2" });

    expect(levelOf(2)).toHaveLength(1);
    expect(screen.getByRole("search")).toHaveTextContent("1 of 3 · Sep 21 – today");
    expect(screen.getByRole("button", { name: "Only dev/api" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    await user.click(screen.getByRole("button", { name: "Show all repositories" }));

    expect(api.setRepositoryFilter).toHaveBeenCalledWith("");
  });
});

describe("HistoryView, empty", () => {
  it("says nothing was archived, with no action", () => {
    view({
      history: [],
      reviewHistory: [],
      discussionHistory: [],
      historySummary: makeHistorySummary(),
    });

    expect(screen.getByText("Nothing archived yet")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Show all repositories" })).toBeNull();
    expect(screen.queryByRole("tree")).toBeNull();
  });

  it("says nothing was archived in the repository, and leaves it", async () => {
    const { user } = view({ repositoryFilter: "repo-1", history: [], reviewHistory: [] });

    expect(screen.getByText("Nothing archived in dev/web")).toBeInTheDocument();
    const [, button] = screen.getAllByRole("button", { name: "Show all repositories" });
    await user.click(button as HTMLElement);
    expect(api.setRepositoryFilter).toHaveBeenCalledWith("");
  });

  it("says nothing matches the search and clears it back to the search box", async () => {
    const { user } = view({}, "refund");

    expect(screen.getByText("Nothing matches “refund”")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Clear the search" }));

    expect(useAppStore.getState().historyQuery).toBe("");
    expect(screen.getByRole("searchbox", { name: "Search History" })).toHaveFocus();
  });

  it("names the repository when the search and the filter both match nothing", () => {
    view({ repositoryFilter: "repo-1" }, "refund");

    expect(screen.getByText("Nothing matches “refund” in dev/web")).toBeInTheDocument();
  });
});
