import { act, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HistoryView } from "@/features/history/HistoryView";
import { olderKey } from "@/lib/history";
import { api } from "@/lib/wails";
import { type AppStore, useAppStore } from "@/store/app-store";
import { intersect, observed } from "@/test/intersection";
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

/** answeredWith is the list of the History beyond the window the Go has answered for, with nothing more to come. */
function answeredWith(query: string, repositoryId: string, matched: number): Partial<AppStore> {
  return {
    olderLists: {
      [olderKey(query, repositoryId)]: { ids: [], next: null, matched, status: "idle", error: "" },
    },
  };
}

/** older is a History with more beyond the window than the list holds: 12 items, 3 in the window. */
const MORE = { historySummary: makeHistorySummary({ tasks: 8, reviews: 2, discussions: 2 }) };

const sentinel = () => document.querySelector("[data-older-sentinel]") as HTMLElement;

/** list is the list of the History beyond the window, by what the Go has said. */
function list(
  query: string,
  repositoryId: string,
  older: Partial<AppStore["olderLists"][string]>,
): Partial<AppStore> {
  return {
    olderLists: {
      [olderKey(query, repositoryId)]: {
        ids: [],
        next: null,
        matched: null,
        status: "idle",
        error: "",
        ...older,
      },
    },
  };
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
    const { user } = view(
      { repositoryFilter: "repo-1", history: [], reviewHistory: [] },
      "",
      answeredWith("", "repo-1", 2),
    );

    expect(screen.getByText("Nothing archived in dev/web")).toBeInTheDocument();
    const [, button] = screen.getAllByRole("button", { name: "Show all repositories" });
    await user.click(button as HTMLElement);
    expect(api.setRepositoryFilter).toHaveBeenCalledWith("");
  });

  it("says nothing matches the search and clears it back to the search box", async () => {
    const { user } = view({}, "refund", answeredWith("refund", "", 0));

    expect(screen.getByText("Nothing matches “refund”")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Clear the search" }));

    expect(useAppStore.getState().historyQuery).toBe("");
    expect(screen.getByRole("searchbox", { name: "Search History" })).toHaveFocus();
  });

  it("names the repository when the search and the filter both match nothing", () => {
    view({ repositoryFilter: "repo-1" }, "refund", answeredWith("refund", "repo-1", 0));

    expect(screen.getByText("Nothing matches “refund” in dev/web")).toBeInTheDocument();
  });
});

describe("HistoryView, older items", () => {
  beforeEach(() => {
    vi.mocked(api.listArchived).mockClear();
  });

  it("says it is loading the older items, as a status", () => {
    view(MORE, "", list("", "", { status: "loading" }));

    expect(screen.getByRole("status")).toHaveTextContent("Loading older items…");
  });

  it("says it is searching the older items while a search waits for the answer", () => {
    view(MORE, "refund");

    expect(screen.getByRole("status")).toHaveTextContent("Searching older items…");
    expect(screen.queryByText(/Nothing matches/)).toBeNull();
  });

  it("shows nothing at the foot when everything came", () => {
    view({}, "", list("", "", { matched: 3 }));

    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("tells the failure with its message and asks again with Try again", async () => {
    const { user } = view(MORE, "", list("", "", { status: "error", error: "the disk is full" }));

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Couldn't load older items: the disk is full",
    );
    await user.click(screen.getByRole("button", { name: "Try again" }));

    expect(api.listArchived).toHaveBeenCalledWith(
      expect.objectContaining({ query: "", repositoryId: "" }),
    );
  });

  it("asks for a page when the foot comes into view, once, and again when the page leaves it in view", async () => {
    view(MORE);
    expect(observed(sentinel())).toBe(true);

    await act(async () => intersect(sentinel()));
    expect(api.listArchived).toHaveBeenCalledTimes(1);
    expect(api.listArchived).toHaveBeenCalledWith({
      before: expect.any(String),
      beforeId: "",
      query: "",
      repositoryId: "",
    });
  });

  it("does not look for older items when the window holds the whole History", () => {
    view();

    expect(observed(sentinel())).toBe(false);
  });

  it("does not look for them after the last page", () => {
    view(MORE, "", list("", "", { matched: 12, next: null }));

    expect(observed(sentinel())).toBe(false);
  });

  it("stops looking while a page is on its way and after a failure", () => {
    view(MORE, "", list("", "", { status: "error", error: "no" }));

    expect(observed(sentinel())).toBe(false);
  });

  it("asks for the older items that match the search once the text has stopped for 300 ms", async () => {
    vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout"] });
    vi.setSystemTime(NOW);
    view(MORE, "refund");

    await act(async () => vi.advanceTimersByTime(299));
    expect(api.listArchived).not.toHaveBeenCalled();
    await act(async () => vi.advanceTimersByTime(1));

    expect(api.listArchived).toHaveBeenCalledWith(
      expect.objectContaining({ query: "refund", repositoryId: "" }),
    );
  });

  it("starts the wait over with each key, and sends the repository of the filter", async () => {
    vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout"] });
    vi.setSystemTime(NOW);
    view({ ...MORE, repositoryFilter: "repo-1" }, "ref");

    await act(async () => vi.advanceTimersByTime(200));
    act(() => useAppStore.getState().setHistoryQuery("refund"));
    await act(async () => vi.advanceTimersByTime(200));
    expect(api.listArchived).not.toHaveBeenCalled();
    await act(async () => vi.advanceTimersByTime(100));

    expect(api.listArchived).toHaveBeenCalledWith(
      expect.objectContaining({ query: "refund", repositoryId: "repo-1" }),
    );
  });

  it("does not search the older items again once the answer is there", async () => {
    vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout"] });
    vi.setSystemTime(NOW);
    view(MORE, "refund", list("refund", "", { matched: 4, next: { before: "x", beforeId: "y" } }));

    await act(async () => vi.advanceTimersByTime(1000));

    expect(api.listArchived).not.toHaveBeenCalled();
  });

  it("counts the window's matches, busy, until the Go answers, then the whole History's", () => {
    view(MORE, "Retry");
    const bar = screen.getByRole("search", { name: "Search History" });
    expect(bar.querySelector("[aria-busy]")).toHaveTextContent(/^1 of 12/);

    act(() => useAppStore.setState(list("Retry", "", { matched: 5, status: "idle" })));

    expect(bar.querySelector("[aria-busy]")).toBeNull();
    expect(bar).toHaveTextContent(/5 of 12/);
  });

  it("shows no search without a result before the answer, and the empty state after it", () => {
    view(MORE, "refund");
    expect(screen.queryByText(/Nothing matches/)).toBeNull();

    act(() => useAppStore.setState(list("refund", "", { matched: 0 })));

    expect(screen.getByText("Nothing matches “refund”")).toBeInTheDocument();
  });

  it("does not say nothing was archived in the repository while the older items are on their way", () => {
    view({ ...MORE, repositoryFilter: "repo-1", history: [], reviewHistory: [] });

    expect(screen.queryByText(/Nothing archived in/)).toBeNull();
  });
});

describe("HistoryView, the row just archived", () => {
  const fresh = (id: string, kind: "task" | "review" | "discussion") =>
    ({ location: { kind: "history", fresh: { kind, id } } }) as Partial<AppStore>;

  it("selects the row and leaves the others alone", () => {
    view({}, "", fresh("review-1", "review"));

    const selected = screen.getAllByRole("treeitem").filter((item) => item.ariaSelected === "true");
    expect(selected).toHaveLength(1);
    expect(selected[0]).toHaveAccessibleName(/^Review .*Retry the export/);
  });

  it("gives it the focus and the tab stop", () => {
    view({}, "", fresh("discussion-1", "discussion"));

    const row = screen.getAllByRole("treeitem").find((item) => item.ariaSelected === "true");
    expect(row).toHaveFocus();
    expect(row?.tabIndex).toBe(0);
  });

  it("keeps it outside the filter, without counting it in the bar nor in its day", () => {
    view({ repositoryFilter: "repo-2" }, "", fresh("review-1", "review"));

    expect(levelOf(2).map((item) => item.getAttribute("aria-label"))).toEqual([
      expect.stringMatching(/^Review Retry the export/),
      expect.stringMatching(/^Discussion Webhook delivery/),
    ]);
    expect(levelOf(1).map((item) => item.getAttribute("aria-label"))).toEqual([
      "Archived today: 0",
      "Archived on Monday, Sep 21: 1",
    ]);
    expect(screen.getByRole("search", { name: "Search History" })).toHaveTextContent(/1 of 3/);
  });

  it("counts it in its day when the filter would show it anyway", () => {
    view({ repositoryFilter: "repo-1" }, "", fresh("review-1", "review"));

    expect(levelOf(1).map((item) => item.getAttribute("aria-label"))).toEqual([
      "Archived today: 2",
    ]);
  });

  it("leaves it to a search typed after the arrival, which holds for every row", async () => {
    const { user } = view({}, "", {
      ...fresh("review-1", "review"),
      ...answeredWith("zzz", "", 0),
    });

    await user.type(screen.getByRole("searchbox", { name: "Search History" }), "zzz");

    expect(screen.queryAllByRole("treeitem")).toEqual([]);
    expect(screen.getByText("Nothing matches “zzz”")).toBeInTheDocument();
    expect(screen.getByRole("search", { name: "Search History" })).toHaveTextContent(/0 of 3/);
  });

  it("leaves it out of a search that matches other rows", async () => {
    const { user } = view({}, "", fresh("review-1", "review"));

    await user.type(screen.getByRole("searchbox", { name: "Search History" }), "Idempotency");

    expect(levelOf(2).map((item) => item.getAttribute("aria-label"))).toEqual([
      expect.stringMatching(/^Task Idempotency keys/),
    ]);
    expect(levelOf(1).map((item) => item.getAttribute("aria-label"))).toEqual([
      "Archived today: 1",
    ]);
  });

  it("scrolls it to the middle when it is out of view", () => {
    const scrolled = vi.spyOn(Element.prototype, "scrollIntoView");
    const rect = vi
      .spyOn(HTMLElement.prototype, "getBoundingClientRect")
      .mockImplementation(function (this: HTMLElement) {
        const row = this.getAttribute("data-row-key") !== null;
        return { top: row ? 4000 : 0, bottom: row ? 4040 : 600 } as DOMRect;
      });

    view({}, "", fresh("discussion-1", "discussion"));

    expect(scrolled).toHaveBeenCalledWith({ block: "center" });
    scrolled.mockRestore();
    rect.mockRestore();
  });

  it("does not scroll it when it is in view", () => {
    const scrolled = vi.spyOn(Element.prototype, "scrollIntoView");

    view({}, "", fresh("discussion-1", "discussion"));

    expect(scrolled).not.toHaveBeenCalledWith({ block: "center" });
    scrolled.mockRestore();
  });

  it("takes the focus again when the History is already open and another row arrives", () => {
    view();
    expect(screen.getByRole("searchbox", { name: "Search History" })).toHaveFocus();

    act(() => useAppStore.getState().openInHistory("review", "review-1"));

    expect(
      screen.getAllByRole("treeitem").find((item) => item.ariaSelected === "true"),
    ).toHaveFocus();
  });
});
