import { act, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BoardView } from "@/features/board/BoardView";
import { EMPTY_FILTERS } from "@/features/board/board-view";
import { boardViewKey } from "@/lib/ui-storage";
import { api, type Board, type BoardCard, type State } from "@/lib/wails";
import { useAppStore } from "@/store/app-store";
import { renderWithStore } from "@/test/render";
import {
  makeBoard,
  makeBoardCard,
  makeBoardRepositoryOption,
  makeRepository,
  makeState,
  makeTask,
} from "@/test/wails-mock";

function card(number: number, overrides: Partial<BoardCard> = {}): BoardCard {
  return makeBoardCard({
    key: `dev/web#${number}`,
    number,
    title: `Card ${number}`,
    suggestedName: `${number}-card`,
    ...overrides,
  });
}

const LOGIN = card(12, { title: "Add the login screen" });
const HEADER = card(7, { statusId: "in-progress", status: "In progress", title: "Fix the header" });
const LATER = card(8, { statusId: "in-progress", status: "In progress", title: "Fix the footer" });
const SHIPPED = card(3, { statusId: "done", status: "Done", final: true, title: "Ship it" });

function stateWith(board: Partial<Board> = {}, extra: Partial<State> = {}): State {
  return makeState({
    repositories: [makeRepository({ boardId: "board-1" })],
    boards: [makeBoard({ cards: [LOGIN, HEADER, LATER, SHIPPED], ...board })],
    ...extra,
  });
}

function view(board: Partial<Board> = {}, extra: Partial<State> = {}) {
  return renderWithStore(<BoardView boardId="board-1" />, {
    state: stateWith(board, extra),
    ui: { location: { kind: "board", id: "board-1" } },
  });
}

/** row is the card row of a number. */
function row(number: number) {
  return screen.getByRole("treeitem", { name: new RegExp(`^#${number} `) });
}

function header(name: string) {
  return screen.getByRole("treeitem", { name: new RegExp(`^${name},`) });
}

afterEach(() => {
  localStorage.clear();
});

describe("the keyboard of the board", () => {
  describe("the tree", () => {
    it("walks the headers and the rows with the arrows, Home and End", async () => {
      const { user } = view();
      row(12).focus();

      await user.keyboard("{ArrowDown}");
      expect(header("In progress")).toHaveFocus();
      await user.keyboard("{ArrowDown}");
      expect(row(7)).toHaveFocus();
      await user.keyboard("{ArrowDown}{ArrowDown}");
      // Done is collapsed: the header is the last entry.
      expect(header("Done")).toHaveFocus();
      await user.keyboard("{ArrowDown}");
      expect(header("Done")).toHaveFocus();

      await user.keyboard("{ArrowUp}");
      expect(row(8)).toHaveFocus();
      await user.keyboard("{Home}");
      expect(header("Todo")).toHaveFocus();
      await user.keyboard("{ArrowUp}");
      expect(header("Todo")).toHaveFocus();
      await user.keyboard("{End}");
      expect(header("Done")).toHaveFocus();
    });

    it("collapses and expands the sections with ←, → and Enter", async () => {
      const { user } = view();
      header("In progress").focus();

      await user.keyboard("{ArrowLeft}");
      expect(header("In progress")).toHaveAttribute("aria-expanded", "false");
      expect(screen.queryByRole("treeitem", { name: /^#7 / })).not.toBeInTheDocument();
      await user.keyboard("{ArrowRight}");
      expect(header("In progress")).toHaveAttribute("aria-expanded", "true");
      await user.keyboard("{ArrowRight}");
      expect(header("In progress")).toHaveAttribute("aria-expanded", "true");
      await user.keyboard("{Enter}");
      expect(header("In progress")).toHaveAttribute("aria-expanded", "false");
      await user.keyboard("{Enter}");
      expect(header("In progress")).toHaveAttribute("aria-expanded", "true");
    });

    it("folds the section of a row with ← and puts the focus on its header", async () => {
      const { user } = view();
      row(8).focus();

      await user.keyboard("{ArrowLeft}");

      expect(header("In progress")).toHaveAttribute("aria-expanded", "false");
      expect(header("In progress")).toHaveFocus();
    });

    it("leaves an empty section alone", async () => {
      const { user } = view({ cards: [LOGIN, SHIPPED] });
      header("In progress").focus();

      await user.keyboard("{ArrowLeft}{Enter}{ArrowRight}");

      expect(header("In progress")).not.toHaveAttribute("aria-expanded");
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

      await user.keyboard("{ArrowUp}");
      expect(stops()).toEqual([header("In progress")]);
    });

    it("moves the focus to the next row when the focused one leaves the reading", () => {
      view();
      row(7).focus();

      act(() => {
        useAppStore.getState().applyState(stateWith({ cards: [LOGIN, LATER, SHIPPED] }));
      });

      expect(row(8)).toHaveFocus();
    });

    it("moves the focus to the next visible card when the last of its section leaves", () => {
      localStorage.setItem(
        boardViewKey("board-1"),
        JSON.stringify({ filters: EMPTY_FILTERS, collapsed: [] }),
      );
      view();
      row(8).focus();

      act(() => {
        useAppStore.getState().applyState(stateWith({ cards: [LOGIN, HEADER, SHIPPED] }));
      });

      expect(row(3)).toHaveFocus();
    });

    it("moves the focus to the row before when no card follows the one that leaves", () => {
      view();
      row(8).focus();

      act(() => {
        useAppStore.getState().applyState(stateWith({ cards: [LOGIN, HEADER, SHIPPED] }));
      });

      expect(row(7)).toHaveFocus();
    });

    it("moves the focus to the header when the section is left with no row", () => {
      view({ cards: [HEADER, SHIPPED] });
      row(7).focus();

      act(() => {
        useAppStore.getState().applyState(stateWith({ cards: [SHIPPED] }));
      });

      expect(header("In progress")).toHaveFocus();
    });
  });

  describe("the panel", () => {
    it("opens a card with Enter and closes it with Enter", async () => {
      const { user } = view();
      row(12).focus();

      await user.keyboard("{Enter}");
      expect(screen.getByRole("complementary", { name: "Card #12" })).toBeInTheDocument();
      expect(row(12)).toHaveAttribute("aria-selected", "true");

      await user.keyboard("{Enter}");
      expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
    });
  });

  describe("S", () => {
    it("starts a task for a card that can", async () => {
      const { user } = view();
      row(12).focus();

      await user.keyboard("s");

      expect(useAppStore.getState().newTaskCard).toEqual({
        boardId: "board-1",
        key: "dev/web#12",
      });
    });

    it("opens the card and focuses Clone and continue for a repository not cloned", async () => {
      const uncloned = card(12, { action: "clone" });
      const { user } = view(
        { cards: [uncloned] },
        { repositories: [makeRepository({ boardId: "board-1", cloned: false, path: "" })] },
      );
      row(12).focus();

      await user.keyboard("s");

      expect(screen.getByRole("complementary", { name: "Card #12" })).toBeInTheDocument();
      await waitFor(() =>
        expect(screen.getByRole("button", { name: "Clone and continue" })).toHaveFocus(),
      );
      expect(api.cloneRepository).not.toHaveBeenCalled();
    });

    it("opens the card and Add to board for a repository the board does not manage", async () => {
      vi.mocked(api.checkBoardRepository).mockResolvedValue(
        makeBoardRepositoryOption({ link: "clone", path: "/home/dev/web", checked: false }),
      );
      const { user } = view({ cards: [card(12, { action: "add_to_board", repositoryId: "" })] });
      row(12).focus();

      await user.keyboard("s");

      await waitFor(() =>
        expect(api.checkBoardRepository).toHaveBeenCalledWith("board-1", "dev/web"),
      );
      expect(await screen.findByRole("dialog")).toBeInTheDocument();
    });

    it.each([
      [
        "a card with a task",
        card(12, { action: "has_task", activeTaskId: "task-1" }),
        "No task from #12",
        "#12 already has a task: add-login.",
      ],
      ["a closed card", card(12, { action: "closed" }), "No task from #12", "The issue is closed."],
      [
        "a card of another board",
        card(12, { action: "other_board", otherBoard: "Platform" }),
        "No task from #12",
        "dev/web belongs to the board Platform.",
      ],
      [
        "a card whose clone is missing",
        card(12, { action: "clone_missing" }),
        "No task from #12",
        "The clone at /home/dev/projects/web is missing.",
      ],
    ])("says why it does nothing for %s", async (_name, target, title, reason) => {
      const { user } = view({ cards: [target] }, { tasks: [makeTask()] });
      row(12).focus();

      await user.keyboard("s");

      const notice = await screen.findByRole("status");
      expect(notice).toHaveTextContent(`${title} · ${reason}`);
      expect(useAppStore.getState().newTaskOpen).toBe(false);
      expect(row(12)).toHaveFocus();
    });

    it("does nothing on a header", async () => {
      const { user } = view();
      header("Todo").focus();

      await user.keyboard("s");

      expect(useAppStore.getState().newTaskOpen).toBe(false);
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
    });

    it("acts on the card of the panel when the focus is in it", async () => {
      const { user } = view();
      await user.click(row(7));
      const panel = screen.getByRole("complementary", { name: "Card #7" });
      within(panel)
        .getByRole("button", { name: /^Discuss/ })
        .focus();

      await user.keyboard("s");

      expect(useAppStore.getState().newTaskCard).toEqual({ boardId: "board-1", key: "dev/web#7" });
    });
  });

  describe("D", () => {
    it("discusses the focused card", async () => {
      const { user } = view();
      row(12).focus();

      await user.keyboard("d");

      expect(useAppStore.getState().newDiscussion).toEqual({
        boardId: "board-1",
        cardKeys: ["dev/web#12"],
        askBoard: false,
      });
    });

    it("says why a card of another repository cannot be discussed", async () => {
      const { user } = view({
        cards: [card(1, { repositoryId: "repo-9", repository: "dev/api" })],
      });
      row(1).focus();

      await user.keyboard("d");

      expect(await screen.findByRole("status")).toHaveTextContent(
        "#1 can't go into a discussion · dev/api isn't a repository of this board.",
      );
      expect(useAppStore.getState().newDiscussion).toBeNull();
    });

    it("says that no card is selected in the select mode", async () => {
      const { user } = view();
      row(12).focus();
      await user.keyboard(" ");
      await user.keyboard(" ");
      expect(screen.getByRole("toolbar", { name: "Selected cards" })).toHaveTextContent(
        "0 selected",
      );

      await user.keyboard("d");

      expect(await screen.findByText("No card is selected")).toBeInTheDocument();
      expect(useAppStore.getState().newDiscussion).toBeNull();
    });

    it("discusses the selection in the order the cards were marked", async () => {
      const { user } = view();
      row(7).focus();
      await user.keyboard(" ");
      row(12).focus();
      await user.keyboard(" ");

      await user.keyboard("d");

      expect(useAppStore.getState().newDiscussion).toEqual({
        boardId: "board-1",
        cardKeys: ["dev/web#7", "dev/web#12"],
        askBoard: false,
      });
      expect(screen.getByText("#7 #12")).toBeInTheDocument();
    });
  });

  describe("Space and the select mode", () => {
    it("enters the mode with the card marked, and toggles the rows in it", async () => {
      const { user } = view();
      await user.click(row(12));
      expect(screen.getByRole("complementary")).toBeInTheDocument();
      row(7).focus();

      await user.keyboard(" ");

      expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
      expect(screen.getByRole("tree")).toHaveAttribute("aria-multiselectable", "true");
      expect(row(7)).toHaveAccessibleName(/\. selected$/);
      expect(row(12)).toHaveAccessibleName(/\. not selected$/);
      expect(screen.getByRole("toolbar", { name: "Selected cards" })).toHaveTextContent(
        "1 selected",
      );

      row(12).focus();
      await user.keyboard(" ");
      expect(row(12)).toHaveAccessibleName(/\. selected$/);
      await user.keyboard(" ");
      expect(row(12)).toHaveAccessibleName(/\. not selected$/);
    });

    it("toggles a row with Enter and with a click in the mode, without opening the card", async () => {
      const { user } = view();
      row(7).focus();
      await user.keyboard(" ");

      row(12).focus();
      await user.keyboard("{Enter}");
      expect(row(12)).toHaveAccessibleName(/\. selected$/);
      await user.click(row(12));
      expect(row(12)).toHaveAccessibleName(/\. not selected$/);
      expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
    });

    it("says why a card of another repository cannot be selected", async () => {
      const { user } = view({
        cards: [card(1, { repositoryId: "repo-9", repository: "dev/api" })],
      });
      row(1).focus();

      await user.keyboard(" ");

      expect(await screen.findByRole("status")).toHaveTextContent("#1 can't go into a discussion");
      expect(screen.queryByRole("toolbar", { name: "Selected cards" })).not.toBeInTheDocument();
    });

    it("enters from the ⋯ and leaves with Cancel, keeping the filters", async () => {
      const { user } = view();
      await user.click(screen.getByRole("button", { name: "More actions" }));
      await user.click(await screen.findByRole("menuitem", { name: /Select cards to discuss/ }));

      const bar = screen.getByRole("toolbar", { name: "Selected cards" });
      expect(bar).toHaveTextContent("0 selected");
      expect(screen.queryByRole("search")).not.toBeInTheDocument();

      await user.click(within(bar).getByRole("button", { name: /^Cancel/ }));
      expect(screen.getByRole("search", { name: "Filter the cards" })).toBeInTheDocument();
    });

    it("discusses the selection from the bar and keeps the mode", async () => {
      const { user } = view();
      row(12).focus();
      await user.keyboard(" ");

      await user.click(screen.getByRole("button", { name: /^Discuss 1 card/ }));

      expect(useAppStore.getState().newDiscussion).toEqual({
        boardId: "board-1",
        cardKeys: ["dev/web#12"],
        askBoard: false,
      });
      expect(screen.getByRole("toolbar", { name: "Selected cards" })).toBeInTheDocument();
    });

    it("drops from the selection a card the reading lost", async () => {
      const { user } = view();
      row(12).focus();
      await user.keyboard(" ");

      act(() => {
        useAppStore.getState().applyState(stateWith({ cards: [HEADER, LATER, SHIPPED] }));
      });

      expect(screen.getByRole("toolbar", { name: "Selected cards" })).toHaveTextContent(
        "0 selected",
      );
    });

    it("does nothing with S in the mode", async () => {
      const { user } = view();
      row(12).focus();
      await user.keyboard(" ");

      await user.keyboard("s");

      expect(useAppStore.getState().newTaskOpen).toBe(false);
    });
  });

  describe("N and /", () => {
    it("opens a discussion of the board with no card on N", async () => {
      const { user } = view();
      row(12).focus();

      await user.keyboard("n");

      expect(useAppStore.getState().newDiscussion).toEqual({
        boardId: "board-1",
        cardKeys: [],
        askBoard: false,
      });
    });

    it("works in the select mode too", async () => {
      const { user } = view();
      row(12).focus();
      await user.keyboard(" ");

      await user.keyboard("n");

      expect(useAppStore.getState().newDiscussion).toMatchObject({ cardKeys: [] });
    });

    it("says that the board was never read", async () => {
      const { user } = view({ readAt: "", cards: [] });
      screen.getByRole("button", { name: "Refresh" }).focus();

      await user.keyboard("n");

      expect(await screen.findByRole("status", { name: "" })).toHaveTextContent(
        "No discussion yet · The board hasn't been read yet.",
      );
      expect(useAppStore.getState().newDiscussion).toBeNull();
    });

    it("does not act inside the search", async () => {
      const { user } = view();
      await user.click(screen.getByRole("searchbox", { name: "Search cards" }));

      await user.keyboard("nsd");

      expect(screen.getByRole("searchbox", { name: "Search cards" })).toHaveValue("nsd");
      expect(useAppStore.getState().newDiscussion).toBeNull();
    });

    it("focuses the search on /, and goes back to the list with ↓ and Esc", async () => {
      const { user } = view();
      row(7).focus();
      await user.keyboard("/");
      const search = screen.getByRole("searchbox", { name: "Search cards" });
      expect(search).toHaveFocus();

      await user.keyboard("{ArrowDown}");
      expect(row(7)).toHaveFocus();

      await user.keyboard("/");
      await user.keyboard("{Escape}");
      expect(row(7)).toHaveFocus();
    });

    it("leaves / alone in the select mode", async () => {
      const { user } = view();
      row(12).focus();
      await user.keyboard(" ");

      await user.keyboard("/");

      expect(screen.queryByRole("searchbox")).not.toBeInTheDocument();
    });
  });

  describe("Esc", () => {
    it("closes the notice, then the panel, and leaves the focus on the row it is on", async () => {
      const { user } = view({ cards: [LOGIN, card(2, { action: "closed" })] });
      await user.click(row(12));
      expect(screen.getByRole("complementary")).toBeInTheDocument();
      row(2).focus();
      await user.keyboard("s");
      expect(await screen.findByText("No task from #2")).toBeInTheDocument();

      await user.keyboard("{Escape}");
      expect(screen.queryByText("No task from #2")).not.toBeInTheDocument();
      expect(screen.getByRole("complementary")).toBeInTheDocument();

      await user.keyboard("{Escape}");
      await waitFor(() => expect(screen.queryByRole("complementary")).not.toBeInTheDocument());
      expect(row(2)).toHaveFocus();
    });

    it("gives the focus back to the row of the card when it was in the panel", async () => {
      const { user } = view({ cards: [LOGIN, card(2, { action: "closed" })] });
      await user.click(row(12));
      within(screen.getByRole("complementary"))
        .getByRole("button", { name: /^Start task/ })
        .focus();

      await user.keyboard("{Escape}");

      await waitFor(() => expect(screen.queryByRole("complementary")).not.toBeInTheDocument());
      expect(row(12)).toHaveFocus();
    });

    it("leaves the mode when nothing else is open", async () => {
      const { user } = view();
      row(12).focus();
      await user.keyboard(" ");
      expect(screen.getByRole("toolbar", { name: "Selected cards" })).toBeInTheDocument();

      await user.keyboard("{Escape}");

      expect(screen.queryByRole("toolbar", { name: "Selected cards" })).not.toBeInTheDocument();
      expect(screen.getByRole("tree")).not.toHaveAttribute("aria-multiselectable");
    });

    it("is left to the app when there is nothing to close", async () => {
      const { user } = view();
      const seen = vi.fn((event: KeyboardEvent) => event.defaultPrevented);
      window.addEventListener("keydown", seen);
      row(12).focus();

      await user.keyboard("{Escape}");
      window.removeEventListener("keydown", seen);

      expect(seen).toHaveReturnedWith(false);
    });
  });
});
