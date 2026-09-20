import { screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BoardsPage } from "@/features/boards/BoardsPage";
import { api, type State } from "@/lib/wails";
import { renderWithStore } from "@/test/render";
import { makeBoard, makeState } from "@/test/wails-mock";

function page(state: State = makeState({ boards: [makeBoard()] })) {
  return renderWithStore(<BoardsPage />, { state });
}

describe("BoardsPage", () => {
  it("says there are no boards yet", () => {
    page(makeState({ boards: [] }));

    expect(screen.getByRole("heading", { name: "Boards" })).toBeInTheDocument();
    expect(screen.getByText("No boards yet.")).toBeInTheDocument();
  });

  it("lists each board with its owner, link, repositories, statuses and last reading", () => {
    vi.useFakeTimers({ now: Date.parse("2026-09-16T12:03:00Z"), shouldAdvanceTime: true });
    page(
      makeState({
        boards: [
          makeBoard({ newCardStatus: "todo" }),
          makeBoard({
            id: "board-2",
            title: "Support",
            owner: "ana",
            ownerType: "user",
            url: "https://github.com/users/ana/projects/1",
            repositoryIds: [],
            failure: {
              reason: "missing_scope",
              message: "gh can't read projects. Run gh auth refresh -s read:project.",
              failedAt: "2026-09-16T12:00:00Z",
            },
          }),
        ],
      }),
    );
    vi.useRealTimers();

    const [roadmap, support] = screen.getAllByRole("listitem");
    if (roadmap === undefined || support === undefined) {
      throw new Error("expected two boards");
    }
    expect(roadmap).toHaveTextContent("Roadmap");
    expect(roadmap).toHaveTextContent("dev · Organization · 1 repository");
    expect(
      within(roadmap).getByRole("link", { name: "https://github.com/orgs/dev/projects/3" }),
    ).toBeInTheDocument();
    expect(roadmap).toHaveTextContent("Final: Done · New cards: Todo");
    expect(roadmap).toHaveTextContent("Updated 3 min ago");
    expect(support).toHaveTextContent("ana · User · 0 repositories");
    expect(support).toHaveTextContent(
      "gh can't read projects. Run gh auth refresh -s read:project.",
    );
  });

  it("opens the link of a board in the browser", async () => {
    const { user } = page();

    await user.click(screen.getByRole("link", { name: "https://github.com/orgs/dev/projects/3" }));

    expect(api.openExternal).toHaveBeenCalledWith("https://github.com/orgs/dev/projects/3");
  });

  it("opens the dialog that adds a board", async () => {
    const { user } = page();

    await user.click(screen.getByRole("button", { name: "Add board" }));

    expect(await screen.findByRole("dialog", { name: "Add board" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Board URL" })).toBeInTheDocument();
  });

  it("edits a board, reading it again", async () => {
    const { user } = page();

    await user.click(screen.getByRole("button", { name: "Edit" }));

    expect(await screen.findByRole("dialog", { name: "Edit board" })).toBeInTheDocument();
    expect(api.previewEditBoard).toHaveBeenCalledWith("board-1");
  });

  it("asks before removing a board", async () => {
    const { user } = page();

    await user.click(screen.getByRole("button", { name: "Remove" }));

    expect(await screen.findByText("Remove Roadmap?")).toBeInTheDocument();
  });
});
