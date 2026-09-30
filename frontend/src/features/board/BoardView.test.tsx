import { act, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { BoardView } from "@/features/board/BoardView";
import { EMPTY_FILTERS } from "@/features/board/board-view";
import { boardViewKey } from "@/lib/ui-storage";
import { api, type Board, type State } from "@/lib/wails";
import { useAppStore } from "@/store/app-store";
import { renderWithStore } from "@/test/render";
import { makeBoard, makeBoardCard, makeRepository, makeState } from "@/test/wails-mock";

/** SKELETON_BARS is how many bars the skeleton of a board never read has. */
const SKELETON_BARS = 4;

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
  return renderWithStore(<BoardView boardId="board-1" />, {
    state: stateWith(board),
    ui: { location: { kind: "board", id: "board-1" } },
  });
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
    const tree = screen.getByRole("tree", { name: "Cards of Roadmap, by status" });
    expect(within(tree).getByRole("treeitem", { name: /^Todo/ })).toBeInTheDocument();
    expect(within(tree).getByRole("treeitem", { name: /#12/ })).toBeInTheDocument();
    expect(within(tree).getByRole("treeitem", { name: /#7/ })).toBeInTheDocument();
    expect(within(tree).queryByRole("treeitem", { name: /#3/ })).not.toBeInTheDocument();
  });

  it("opens the board on GitHub from the ⋯", async () => {
    const { user } = view();

    await user.click(screen.getByRole("button", { name: "More actions" }));
    await user.click(await screen.findByRole("menuitem", { name: "Open on GitHub" }));

    expect(api.openExternal).toHaveBeenCalledWith(makeBoard().url);
  });

  it("shows the skeleton while a board never read is being read", () => {
    const { container } = view({ readAt: "", reading: true, cards: [] });

    expect(screen.queryByRole("tree")).not.toBeInTheDocument();
    expect(screen.getByRole("status", { name: "Reading the board…" })).toBeInTheDocument();
    expect(container.querySelectorAll('[data-slot="skeleton"]')).toHaveLength(SKELETON_BARS);
    // The header says the reading too, and the filters wait for the cards.
    expect(screen.getByText("Reading…")).toBeInTheDocument();
    expect(screen.queryByRole("search")).not.toBeInTheDocument();
  });

  it("shows why a board never read failed in place of the list, and tries again", async () => {
    const { user } = view({
      readAt: "",
      cards: [],
      failure: { reason: "not_found", message: "The board wasn't found.", failedAt: "" },
    });

    expect(screen.getByText("Couldn't read the board")).toBeInTheDocument();
    expect(screen.getByText("The board wasn't found.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Try again" }));

    expect(api.refreshBoard).toHaveBeenCalledTimes(2);
  });

  it("shows the skeleton, not the failure, while a board never read is read again", () => {
    view({
      readAt: "",
      reading: true,
      cards: [],
      failure: { reason: "not_found", message: "The board wasn't found.", failedAt: "" },
    });

    expect(screen.getByRole("status", { name: "Reading the board…" })).toBeInTheDocument();
    expect(screen.queryByText("The board wasn't found.")).not.toBeInTheDocument();
  });

  it("shows the skeleton for a board never read that is neither reading nor failed", () => {
    view({ readAt: "", cards: [] });

    expect(screen.getByRole("status", { name: "Reading the board…" })).toBeInTheDocument();
  });

  it("says when the board has no issues", () => {
    view({ cards: [] });

    expect(screen.getByText("This board has no issues.")).toBeInTheDocument();
    expect(screen.getByText(/A discussion publishes new cards here\./)).toBeInTheDocument();
    // There is nothing to filter, so the bar is not there.
    expect(screen.queryByRole("search")).not.toBeInTheDocument();
  });

  it("starts a discussion from the empty board", async () => {
    const { user } = view({ cards: [] });

    const [, fromTheEmptyBoard] = screen.getAllByRole("button", { name: "New discussion" });
    await user.click(fromTheEmptyBoard as HTMLElement);

    expect(useAppStore.getState().newDiscussion).toEqual({
      boardId: "board-1",
      cardKeys: [],
      askBoard: false,
    });
  });

  it("says what the filters ask when no card matches", async () => {
    const { user } = view();

    await user.type(screen.getByRole("searchbox", { name: "Search cards" }), "refund");

    expect(screen.getByText("No cards match the filters.")).toBeInTheDocument();
    expect(
      screen.getByText('Nothing on the board has "refund" in the title or the number.'),
    ).toBeInTheDocument();
    // The bar stays, to change the filters.
    expect(screen.getByRole("search", { name: "Filter the cards" })).toBeInTheDocument();
  });

  it("clears filters that leave no card", async () => {
    const { user } = view();

    await user.type(screen.getByRole("searchbox", { name: "Search cards" }), "nothing like it");
    expect(screen.getByText("No cards match the filters.")).toBeInTheDocument();

    const [clear] = screen.getAllByRole("button", { name: "Clear filters" });
    await user.click(clear ?? document.body);

    expect(screen.getByRole("treeitem", { name: /#12/ })).toBeInTheDocument();
    expect(screen.getByRole("searchbox", { name: "Search cards" })).toHaveValue("");
  });

  it("remembers the filters and the sections of each board", async () => {
    const { user, unmount } = view();

    await user.type(screen.getByRole("searchbox", { name: "Search cards" }), "header");
    await user.click(screen.getByRole("treeitem", { name: /^In progress/ }));
    unmount();

    expect(JSON.parse(localStorage.getItem(boardViewKey("board-1")) ?? "null")).toEqual({
      filters: {
        query: "header",
        repository: "",
        repositoryName: "",
        status: "",
        statusName: "",
        assignee: "",
        mine: false,
      },
      collapsed: ["done", "in-progress"],
    });

    view();
    expect(screen.getByRole("searchbox", { name: "Search cards" })).toHaveValue("header");
    expect(screen.getByRole("treeitem", { name: /^In progress/ })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    expect(screen.queryByRole("treeitem", { name: /#7/ })).not.toBeInTheDocument();
  });

  it("collapses the final statuses of a board first opened before its reading", async () => {
    view({ readAt: "", reading: true, statuses: [], cards: [] });

    act(() => {
      useAppStore.getState().applyState(stateWith());
    });

    expect(screen.getByRole("treeitem", { name: /^Done/ })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    expect(screen.queryByRole("treeitem", { name: /#3/ })).not.toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem(boardViewKey("board-1")) ?? "null")).toEqual({
      filters: EMPTY_FILTERS,
    });
  });

  it("opens the detail of a card and closes it with Escape", async () => {
    const { user } = view();

    await user.click(screen.getByRole("treeitem", { name: /#12/ }));
    expect(screen.getByRole("complementary", { name: "Card #12" })).toBeInTheDocument();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
  });

  describe("openBoardCard", () => {
    it("opens the card in the panel with its section expanded and its row focused", () => {
      view();
      // The Done section starts collapsed: the card of the request is in it.
      expect(screen.queryByRole("treeitem", { name: /#3/ })).not.toBeInTheDocument();

      act(() => useAppStore.getState().openBoardCard("board-1", SHIPPED.key));

      expect(screen.getByRole("complementary", { name: "Card #3" })).toBeInTheDocument();
      expect(screen.getByRole("treeitem", { name: /#3/ })).toHaveFocus();
      expect(useAppStore.getState().boardCardRequest).toBeNull();
    });

    it("keeps the filters and focuses the panel when they hide the row", async () => {
      localStorage.setItem(
        boardViewKey("board-1"),
        JSON.stringify({ filters: { ...EMPTY_FILTERS, query: "header" } }),
      );
      view();

      act(() => useAppStore.getState().openBoardCard("board-1", LOGIN.key));

      const panel = await screen.findByRole("complementary", { name: "Card #12" });
      expect(screen.queryByRole("treeitem", { name: /#12/ })).not.toBeInTheDocument();
      expect(screen.getByRole("searchbox", { name: "Search cards" })).toHaveValue("header");
      await waitFor(() =>
        expect(within(panel).getByRole("button", { name: /^Start task/ })).toHaveFocus(),
      );
    });

    it("is taken by the view already open on that board", () => {
      view();

      act(() => useAppStore.getState().openBoardCard("board-1", HEADER.key));

      expect(screen.getByRole("complementary", { name: "Card #7" })).toBeInTheDocument();
      expect(screen.getByRole("treeitem", { name: /#7/ })).toHaveFocus();
    });
  });

  it("opens a discussion of the board with no card from the header", async () => {
    const { user } = view();

    await user.click(screen.getByRole("button", { name: "New discussion" }));

    expect(useAppStore.getState().newDiscussion).toEqual({
      boardId: "board-1",
      cardKeys: [],
      askBoard: false,
    });
  });

  it("waits for the first reading to offer a discussion", () => {
    view({ readAt: "", reading: true, cards: [] });

    const button = screen.getByRole("button", { name: "New discussion" });
    expect(button).toHaveAttribute("aria-disabled", "true");
    expect(button).toHaveAccessibleDescription("The board hasn't been read yet.");
  });

  it("ends the flash of a new card even when another reading arrives meanwhile", async () => {
    view();
    const fresh = makeBoardCard({ key: "dev/web#20", number: 20, title: "Brand new" });

    act(() => {
      useAppStore.getState().applyState(stateWith({ cards: [LOGIN, HEADER, SHIPPED, fresh] }));
    });
    const item = screen.getByRole("treeitem", { name: /#20/ });
    expect(item).toHaveClass("row-flash");

    act(() => {
      useAppStore.getState().applyState(stateWith({ cards: [LOGIN, HEADER, SHIPPED, fresh] }));
    });

    await waitFor(() => expect(item).not.toHaveClass("row-flash"));
  });

  it("refreshes from the header", async () => {
    const { user } = view();

    await user.click(screen.getByRole("button", { name: "Refresh" }));

    expect(api.refreshBoard).toHaveBeenCalledTimes(2);
  });

  it("says how old the reading is", () => {
    view({ readAt: new Date(Date.now() - 120_000).toISOString() });
    expect(screen.getByText("Read 2m ago")).toBeInTheDocument();
  });

  it("dashes Refresh while reading, over the stored list", () => {
    view({ reading: true });

    expect(screen.getByRole("button", { name: "Refresh" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    expect(screen.getByText("Reading…")).toBeInTheDocument();
    expect(screen.getByRole("treeitem", { name: /#12/ })).toBeInTheDocument();
  });

  describe("the ⋯", () => {
    async function openMenu(board: Partial<Board> = {}) {
      const rendered = view(board);
      await rendered.user.click(screen.getByRole("button", { name: "More actions" }));
      await screen.findByRole("menu");
      return rendered;
    }

    it("holds selecting, GitHub and the board settings", async () => {
      await openMenu();

      expect(
        screen.getByRole("menuitem", { name: /^Select cards to discuss/ }),
      ).toBeInTheDocument();
      expect(screen.getByRole("menuitem", { name: "Open on GitHub" })).toBeInTheDocument();
      expect(
        screen.getByRole("menuitem", { name: "Edit the board in Settings…" }),
      ).toBeInTheDocument();
    });

    it("opens the boards of Settings", async () => {
      const { user } = await openMenu();

      await user.click(screen.getByRole("menuitem", { name: "Edit the board in Settings…" }));

      expect(useAppStore.getState().location).toEqual({ kind: "settings", section: "boards" });
    });

    it("dashes selecting with the reason of a board never read", async () => {
      await openMenu({ readAt: "", reading: true, cards: [] });

      const item = screen.getByRole("menuitem", { name: /Select cards to discuss/ });
      expect(item).toHaveAttribute("aria-disabled", "true");
      expect(item).toHaveTextContent("the board hasn't been read yet");
    });

    it("dashes selecting when no card can be selected", async () => {
      await openMenu({
        cards: [makeBoardCard({ key: "dev/api#1", number: 1, repositoryId: "repo-9" })],
      });

      expect(screen.getByRole("menuitem", { name: /Select cards to discuss/ })).toHaveTextContent(
        "no card to select",
      );
    });

    it("dashes selecting while selecting", async () => {
      const { user } = await openMenu();
      await user.click(screen.getByRole("menuitem", { name: /Select cards to discuss/ }));
      await user.click(screen.getByRole("button", { name: "More actions" }));

      expect(
        await screen.findByRole("menuitem", { name: /Select cards to discuss/ }),
      ).toHaveTextContent("already selecting");
    });
  });

  describe("the failure of a later reading", () => {
    const failure = {
      reason: "rate_limited",
      message: "GitHub limits.",
      failedAt: "2026-09-16T12:03:00Z",
    };

    it("shows a strip over the stored cards, with the age of the stored reading", () => {
      view({ failure });

      const strip = screen.getByRole("alert");
      expect(strip).toHaveTextContent("Couldn't read the board");
      expect(strip).toHaveTextContent("GitHub limits.");
      expect(screen.getByRole("treeitem", { name: /#12/ })).toBeInTheDocument();
      expect(screen.getByText(/^Read /)).toBeInTheDocument();
    });

    it("keeps the strip with the empty board", async () => {
      view({ failure, cards: [] });

      expect(screen.getByRole("alert")).toHaveTextContent("GitHub limits.");
      expect(screen.getByText("This board has no issues.")).toBeInTheDocument();
    });

    it("tries again from the strip, which says Reading… meanwhile", async () => {
      const { user } = view({ failure });

      await user.click(screen.getByRole("button", { name: "Try again" }));
      expect(api.refreshBoard).toHaveBeenCalledTimes(2);

      act(() => {
        useAppStore.getState().applyState(stateWith({ failure, reading: true }));
      });
      expect(screen.queryByRole("button", { name: "Try again" })).not.toBeInTheDocument();
      expect(screen.getByRole("alert")).toHaveTextContent("Reading…");
      expect(screen.getAllByRole("status").some((node) => node.textContent === "Reading…")).toBe(
        true,
      );
      expect(screen.getByRole("treeitem", { name: /#12/ })).toBeInTheDocument();
    });
  });
});
