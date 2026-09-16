import { act, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { BoardView } from "@/features/board/BoardView";
import { boardViewKey } from "@/lib/ui-storage";
import { api, type Board, type State } from "@/lib/wails";
import { useAppStore } from "@/store/app-store";
import { renderWithStore } from "@/test/render";
import { makeBoard, makeBoardCard, makeRepository, makeState } from "@/test/wails-mock";

const LOGIN = makeBoardCard();
const HEADER = makeBoardCard({
  key: "dev/web#7",
  number: 7,
  title: "Fix the header",
  statusId: "in-progress",
  status: "In progress",
});
const SHIPPED = makeBoardCard({
  key: "dev/web#3",
  number: 3,
  title: "Ship it",
  statusId: "done",
  status: "Done",
});

function stateWith(board: Partial<Board> = {}): State {
  return makeState({
    repositories: [makeRepository({ boardId: "board-1" })],
    boards: [makeBoard({ cards: [LOGIN, HEADER, SHIPPED], ...board })],
  });
}

function view(board: Partial<Board> = {}) {
  return renderWithStore(<BoardView boardId="board-1" />, { state: stateWith(board) });
}

afterEach(() => {
  localStorage.clear();
});

describe("BoardView", () => {
  it("reads the board as it opens", () => {
    view();

    expect(api.refreshBoard).toHaveBeenCalledExactlyOnceWith("board-1");
  });

  it("shows the header and the sections, final statuses collapsed", () => {
    view();

    expect(screen.getByRole("heading", { level: 1, name: "Roadmap" })).toBeInTheDocument();
    const tree = screen.getByRole("tree", { name: "Cards" });
    expect(within(tree).getByRole("button", { name: /^Todo/ })).toBeInTheDocument();
    expect(within(tree).getByRole("treeitem", { name: /#12/ })).toBeInTheDocument();
    expect(within(tree).getByRole("treeitem", { name: /#7/ })).toBeInTheDocument();
    expect(within(tree).queryByRole("treeitem", { name: /#3/ })).not.toBeInTheDocument();
  });

  it("shows placeholder rows while a board never read is being read", () => {
    view({ readAt: "", reading: true, cards: [] });

    expect(screen.queryByRole("tree")).not.toBeInTheDocument();
    expect(screen.getByRole("status", { name: "Reading the board" })).toBeInTheDocument();
  });

  it("shows why a board never read failed, and tries again", async () => {
    const { user } = view({
      readAt: "",
      cards: [],
      failure: { reason: "not_found", message: "The board wasn't found.", failedAt: "" },
    });

    expect(screen.getByRole("alert")).toHaveTextContent("The board wasn't found.");
    await user.click(screen.getByRole("button", { name: "Try again" }));

    expect(api.refreshBoard).toHaveBeenCalledTimes(2);
  });

  it("says when the board has no issues", () => {
    view({ cards: [] });

    expect(screen.getByText("This board has no issues.")).toBeInTheDocument();
  });

  it("clears filters that leave no card", async () => {
    const { user } = view();

    await user.type(screen.getByRole("textbox", { name: "Search cards" }), "nothing like it");
    expect(screen.getByText("No cards match the filters.")).toBeInTheDocument();

    const [clear] = screen.getAllByRole("button", { name: "Clear filters" });
    await user.click(clear ?? document.body);

    expect(screen.getByRole("treeitem", { name: /#12/ })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Search cards" })).toHaveValue("");
  });

  it("remembers the filters and the sections of each board", async () => {
    const { user, unmount } = view();

    await user.type(screen.getByRole("textbox", { name: "Search cards" }), "header");
    await user.click(screen.getByRole("button", { name: /^Done/ }));
    unmount();

    expect(JSON.parse(localStorage.getItem(boardViewKey("board-1")) ?? "null")).toEqual({
      filters: { query: "header", repository: "", status: "", assignee: "", mine: false },
      collapsed: [],
    });

    view();
    expect(screen.getByRole("textbox", { name: "Search cards" })).toHaveValue("header");
    expect(screen.getByRole("treeitem", { name: /#7/ })).toBeInTheDocument();
    expect(screen.queryByRole("treeitem", { name: /#12/ })).not.toBeInTheDocument();
  });

  it("collapses the final statuses of a board first opened before its reading", async () => {
    const { user } = view({ readAt: "", reading: true, statuses: [], cards: [] });

    await user.type(screen.getByRole("textbox", { name: "Search cards" }), "x");
    await user.clear(screen.getByRole("textbox", { name: "Search cards" }));
    act(() => {
      useAppStore.getState().applyState(stateWith());
    });

    expect(screen.getByRole("treeitem", { name: "Done" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    expect(screen.queryByRole("treeitem", { name: /#3/ })).not.toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem(boardViewKey("board-1")) ?? "null")).toEqual({
      filters: { query: "", repository: "", status: "", assignee: "", mine: false },
    });
  });

  it("opens the detail of a card and closes it with Escape", async () => {
    const { user } = view();

    await user.click(screen.getByRole("treeitem", { name: /#12/ }));
    expect(screen.getByRole("complementary", { name: "Card #12" })).toBeInTheDocument();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
  });

  it("drops the selection when the card leaves the reading", async () => {
    const { user } = view();
    await user.click(screen.getByRole("treeitem", { name: /#12/ }));

    act(() => {
      useAppStore.getState().applyState(stateWith({ cards: [HEADER] }));
    });

    expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
  });

  it("focuses the search on /", async () => {
    const { user } = view();
    screen.getByRole("treeitem", { name: /#12/ }).focus();

    await user.keyboard("/");

    expect(screen.getByRole("textbox", { name: "Search cards" })).toHaveFocus();
    expect(screen.getByRole("textbox", { name: "Search cards" })).toHaveValue("");
  });

  it("starts a task for the focused card on S", async () => {
    const { user } = view();
    screen.getByRole("treeitem", { name: /#12/ }).focus();

    await user.keyboard("s");

    expect(useAppStore.getState().newTaskCard).toEqual({ boardId: "board-1", key: "dev/web#12" });
  });

  it("refreshes from the header", async () => {
    const { user } = view();

    await user.click(screen.getByRole("button", { name: "Refresh" }));

    expect(api.refreshBoard).toHaveBeenCalledTimes(2);
  });

  it("shows the failure of a later reading over the stored cards", () => {
    view({ failure: { reason: "rate_limited", message: "GitHub limits.", failedAt: "" } });

    expect(screen.getByRole("alert")).toHaveTextContent("GitHub limits.");
    expect(screen.getByRole("treeitem", { name: /#12/ })).toBeInTheDocument();
  });
});
