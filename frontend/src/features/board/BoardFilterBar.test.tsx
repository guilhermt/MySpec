import { screen, within } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { BoardFilterBar } from "@/features/board/BoardFilterBar";
import { type BoardFilters, EMPTY_FILTERS, NO_STATUS } from "@/features/board/board-view";
import type { Board } from "@/lib/wails";
import { renderWithStore } from "@/test/render";
import { makeBoard, makeBoardCard, makeRepository, makeState } from "@/test/wails-mock";

const CARDS = [
  makeBoardCard({
    assignees: [
      { login: "tchen", avatarUrl: "" },
      { login: "dev", avatarUrl: "" },
    ],
  }),
  makeBoardCard({ key: "dev/web#7", number: 7, assignees: [{ login: "ana", avatarUrl: "" }] }),
];

/** Bar is the filter bar with its filters kept in state, as the view keeps them. */
function Bar({
  board,
  initial = EMPTY_FILTERS,
  onFilters,
}: {
  board: Board;
  initial?: BoardFilters;
  onFilters?: (filters: BoardFilters) => void;
}) {
  const [filters, setFilters] = useState(initial);
  return (
    <BoardFilterBar
      board={board}
      filters={filters}
      onChange={(next) => {
        setFilters(next);
        onFilters?.(next);
      }}
      searchRef={{ current: null }}
      onSearchEscape={() => {}}
      onSearchDown={() => {}}
    />
  );
}

function bar(
  overrides: Partial<Board> = {},
  initial?: BoardFilters,
  onFilters?: (filters: BoardFilters) => void,
) {
  const board = makeBoard({ cards: CARDS, ...overrides });
  return renderWithStore(
    <Bar board={board} {...(initial ? { initial } : {})} {...(onFilters ? { onFilters } : {})} />,
    {
      state: makeState({
        repositories: [makeRepository({ boardId: "board-1" })],
        boards: [board],
      }),
    },
  );
}

describe("BoardFilterBar", () => {
  it("is the search landmark, with a search box that declares none", () => {
    bar();

    const landmarks = screen.getAllByRole("search");
    expect(landmarks).toHaveLength(1);
    expect(landmarks[0]).toHaveAccessibleName("Filter the cards");
    expect(screen.getByRole("searchbox", { name: "Search cards" })).toBeInTheDocument();
  });

  it("searches as the user types, and clears the search", async () => {
    const onFilters = vi.fn();
    const { user } = bar({}, undefined, onFilters);

    await user.type(screen.getByRole("searchbox", { name: "Search cards" }), "log");
    expect(onFilters).toHaveBeenLastCalledWith(expect.objectContaining({ query: "log" }));

    await user.click(screen.getByRole("button", { name: "Clear search" }));
    expect(screen.getByRole("searchbox", { name: "Search cards" })).toHaveValue("");
  });

  it("hands Esc and ↓ of the search to the list", async () => {
    const onSearchEscape = vi.fn();
    const onSearchDown = vi.fn();
    const board = makeBoard({ cards: CARDS });
    const { user } = renderWithStore(
      <BoardFilterBar
        board={board}
        filters={EMPTY_FILTERS}
        onChange={() => {}}
        searchRef={{ current: null }}
        onSearchEscape={onSearchEscape}
        onSearchDown={onSearchDown}
      />,
      { state: makeState({ boards: [board] }) },
    );

    await user.click(screen.getByRole("searchbox", { name: "Search cards" }));
    await user.keyboard("{ArrowDown}{Escape}");

    expect(onSearchDown).toHaveBeenCalledOnce();
    expect(onSearchEscape).toHaveBeenCalledOnce();
  });

  it("toggles Assigned to me", async () => {
    const { user } = bar();

    const chip = screen.getByRole("button", { name: "Assigned to me" });
    expect(chip).toHaveAttribute("aria-pressed", "false");
    await user.click(chip);

    expect(chip).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Clear filters" })).toBeInTheDocument();
  });

  it("dashes Assigned to me when gh didn't say who the user is", async () => {
    const { user } = bar({ viewer: "" });

    const chip = screen.getByRole("button", { name: "Assigned to me" });
    expect(chip).toHaveAttribute("aria-disabled", "true");
    expect(chip).toHaveAccessibleDescription("gh didn't say who you are");
    await user.click(chip);
    expect(chip).toHaveAttribute("aria-pressed", "false");
  });

  it("offers a group for each filter, the status one only on a board with a Status field", async () => {
    const { user, unmount } = bar();
    await user.click(screen.getByRole("button", { name: "Filter" }));
    const menu = await screen.findByRole("menu");

    expect(within(menu).getByRole("group", { name: "Repository" })).toBeInTheDocument();
    expect(within(menu).getByRole("group", { name: "Assignee" })).toBeInTheDocument();
    expect(within(menu).getByRole("group", { name: "Status" })).toBeInTheDocument();
    expect(within(menu).getByRole("menuitemcheckbox", { name: "dev/web" })).toBeInTheDocument();
    expect(within(menu).getByRole("menuitemcheckbox", { name: "dev · you" })).toBeInTheDocument();
    expect(within(menu).getByRole("menuitemcheckbox", { name: "No status" })).toBeInTheDocument();
    unmount();

    const other = bar({ hasStatus: false, statuses: [] });
    await other.user.click(screen.getByRole("button", { name: "Filter" }));
    expect(
      within(await screen.findByRole("menu")).queryByRole("group", { name: "Status" }),
    ).not.toBeInTheDocument();
  });

  it("fills the id and the name of the filter chosen, and closes the menu at each choice", async () => {
    const onFilters = vi.fn();
    const { user } = bar({}, undefined, onFilters);

    await user.click(screen.getByRole("button", { name: "Filter" }));
    await user.click(await screen.findByRole("menuitemcheckbox", { name: "dev/web" }));
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(onFilters).toHaveBeenLastCalledWith(
      expect.objectContaining({ repository: "repo-1", repositoryName: "dev/web" }),
    );

    await user.click(screen.getByRole("button", { name: "Filter" }));
    await user.click(await screen.findByRole("menuitemcheckbox", { name: "In progress" }));
    expect(onFilters).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: "in-progress", statusName: "In progress" }),
    );

    await user.click(screen.getByRole("button", { name: "Filter" }));
    await user.click(await screen.findByRole("menuitemcheckbox", { name: "tchen" }));
    expect(onFilters).toHaveBeenLastCalledWith(expect.objectContaining({ assignee: "tchen" }));
  });

  it("shows a chip for each chosen filter, and its × clears that filter and its name", async () => {
    const onFilters = vi.fn();
    const { user } = bar(
      {},
      {
        ...EMPTY_FILTERS,
        repository: "repo-1",
        repositoryName: "dev/web",
        status: NO_STATUS,
        statusName: "No status",
        assignee: "tchen",
      },
      onFilters,
    );

    expect(screen.getByText("dev/web")).toBeInTheDocument();
    expect(screen.getByText("Assignee: tchen")).toBeInTheDocument();
    expect(screen.getByText("Status: No status")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Remove the filter Status: No status" }));
    expect(onFilters).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: "", statusName: "", assignee: "tchen" }),
    );
    await user.click(screen.getByRole("button", { name: "Remove the filter dev/web" }));
    expect(onFilters).toHaveBeenLastCalledWith(
      expect.objectContaining({ repository: "", repositoryName: "" }),
    );
  });

  it("marks a chip that no longer matches the board with the raw id and ◇", () => {
    bar({}, { ...EMPTY_FILTERS, repository: "repo-9" });

    expect(screen.getByRole("button", { name: "repo-9" })).toBeInTheDocument();
  });

  it("clears the five filters with Clear filters, which shows only while one is set", async () => {
    const onFilters = vi.fn();
    const { user } = bar(
      {},
      { ...EMPTY_FILTERS, query: "log", mine: true, assignee: "tchen" },
      onFilters,
    );

    await user.click(screen.getByRole("button", { name: "Clear filters" }));

    expect(onFilters).toHaveBeenLastCalledWith(EMPTY_FILTERS);
    expect(screen.queryByRole("button", { name: "Clear filters" })).not.toBeInTheDocument();
  });
});
