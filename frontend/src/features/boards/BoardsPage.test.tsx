import { screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BoardsPage } from "@/features/boards/BoardsPage";
import { api, type State } from "@/lib/wails";
import { renderWithStore } from "@/test/render";
import { makeBoard, makeBoardRemoval, makeRepository, makeState } from "@/test/wails-mock";

function page(state: State = makeState({ boards: [makeBoard()] })) {
  return renderWithStore(<BoardsPage />, { state });
}

afterEach(() => {
  vi.useRealTimers();
});

describe("BoardsPage", () => {
  it("says there are no boards yet, with Add board under the text", () => {
    page(makeState({ boards: [] }));

    expect(screen.getByRole("heading", { name: "Boards", level: 2 })).toBeInTheDocument();
    expect(screen.getByText("No boards yet")).toBeInTheDocument();
    expect(
      screen.getByText("Add a board to start tasks from the cards of a GitHub project."),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Add board" })).toHaveLength(2);
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });

  it("lists the boards in the order of the state, each named", () => {
    vi.useFakeTimers({ now: Date.parse("2026-09-16T12:03:00Z"), shouldAdvanceTime: true });
    page(
      makeState({
        boards: [
          makeBoard({ title: "Alpha" }),
          makeBoard({ id: "board-2", title: "Support", owner: "ana", repositoryIds: [] }),
        ],
        repositories: [makeRepository()],
      }),
    );

    const names = within(screen.getByRole("list", { name: "Boards" }))
      .getAllByRole("listitem")
      .map((item) => item.getAttribute("aria-label"));
    expect(names).toEqual([
      "Alpha, dev, 1 repository, read 3m ago",
      "Support, ana, 0 repositories, read 3m ago",
    ]);
    expect(screen.getAllByRole("button", { name: "Add board" })).toHaveLength(1);
  });

  it("opens the dialog that adds a board", async () => {
    const { user } = page();

    await user.click(screen.getByRole("button", { name: "Add board" }));

    expect(await screen.findByRole("dialog", { name: "Add board" })).toBeInTheDocument();
  });

  it("opens the dialog that edits a board", async () => {
    const { user } = page();

    await user.click(screen.getByRole("button", { name: "Edit Roadmap" }));

    expect(await screen.findByRole("dialog", { name: "Edit board" })).toBeInTheDocument();
  });

  it("takes the focus to the title when a board is removed", async () => {
    vi.mocked(api.previewRemoveBoard).mockResolvedValue(makeBoardRemoval());
    const { user } = page();

    await user.click(screen.getByRole("button", { name: "Remove Roadmap" }));
    await user.click(await screen.findByRole("button", { name: "Remove board" }));

    await waitFor(() => expect(screen.getByRole("heading", { name: "Boards" })).toHaveFocus());
  });
});
