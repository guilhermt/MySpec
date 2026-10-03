import { act, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BoardRow } from "@/features/boards/BoardRow";
import { api, type Board } from "@/lib/wails";
import { renderWithStore } from "@/test/render";
import { makeBoard, makeRepository, makeState } from "@/test/wails-mock";

const FAILURE = {
  reason: "missing_scope",
  message: "gh can't read projects. Run gh auth refresh -s read:project.",
  failedAt: "2026-09-16T11:45:00Z",
};

function row(board: Board = makeBoard()) {
  const state = makeState({
    boards: [board],
    repositories: [
      makeRepository({ id: "repo-1", owner: "dev", name: "web", fullName: "dev/web" }),
    ],
  });
  const rendered = renderWithStore(
    <ul>
      <BoardRow board={board} />
    </ul>,
    { state },
  );
  return { ...rendered, state };
}

function at(time: string) {
  vi.useFakeTimers({ now: Date.parse(time), shouldAdvanceTime: true });
}

afterEach(() => {
  vi.useRealTimers();
});

describe("BoardRow", () => {
  it("is a list item named by the board, its owner, its repositories and its reading", () => {
    at("2026-09-16T12:02:00Z");
    row();

    expect(
      screen.getByRole("listitem", { name: "Roadmap, dev, 1 repository, read 2m ago" }),
    ).toBeInTheDocument();
  });

  it("says the project, the repositories and what the statuses do", () => {
    at("2026-09-16T12:02:00Z");
    row(makeBoard({ newCardStatus: "todo" }));

    const item = screen.getByRole("listitem");
    expect(within(item).getByRole("link", { name: "dev/projects/3" })).toBeInTheDocument();
    expect(item).toHaveTextContent("Organization · 1 repository: web");
    expect(item).toHaveTextContent("Final: Done · New cards: Todo");
  });

  it("opens the project in the browser", async () => {
    const { user } = row();

    await user.click(screen.getByRole("link", { name: "dev/projects/3" }));

    expect(api.openExternal).toHaveBeenCalledWith("https://github.com/orgs/dev/projects/3");
  });

  it.each([
    ["Read 2m ago", { readAt: "2026-09-16T12:00:00Z" }, "2026-09-16T12:02:00Z"],
    ["Read 3h ago", { readAt: "2026-09-16T09:00:00Z" }, "2026-09-16T12:02:00Z"],
    ["Read 2d ago", { readAt: "2026-09-14T12:00:00Z" }, "2026-09-16T12:02:00Z"],
    ["Not read yet", { readAt: "" }, "2026-09-16T12:02:00Z"],
    ["Reading…", { reading: true }, "2026-09-16T12:02:00Z"],
  ])("tells the age of the reading: %s", (text, overrides, now) => {
    at(now);
    row(makeBoard(overrides));

    expect(screen.getByText(text)).toBeInTheDocument();
  });

  it("tells the age of a failed reading with the failure line under the row", () => {
    at("2026-09-16T12:03:00Z");
    row(makeBoard({ failure: FAILURE }));

    expect(screen.getByText("Read failed 18m ago")).toBeInTheDocument();
    expect(screen.getByText(/gh can't read projects/)).toHaveTextContent(
      "gh can't read projects. Run gh auth refresh -s read:project. The last reading stays in use.",
    );
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });

  it("does not announce a failure that was there when the page opened", () => {
    row(makeBoard({ failure: FAILURE }));

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("announces a failure that arrives with the page open", () => {
    const board = makeBoard();
    const { rerender } = row(board);

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    rerender(
      <ul>
        <BoardRow board={{ ...board, failure: FAILURE }} />
      </ul>,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("The last reading stays in use.");
  });

  it("reads the board again on Try again", async () => {
    const { user } = row(makeBoard({ failure: FAILURE }));

    await user.click(screen.getByRole("button", { name: "Try again" }));

    expect(api.refreshBoard).toHaveBeenCalledWith("board-1");
  });

  it("says Reading… in place of Try again while it reads", () => {
    row(makeBoard({ failure: FAILURE, reading: true }));

    expect(screen.queryByRole("button", { name: "Try again" })).not.toBeInTheDocument();
    expect(document.querySelector("[aria-busy=true]")).toHaveTextContent("Reading…");
  });

  it("has no failure line without a failure", () => {
    row();

    expect(screen.queryByRole("button", { name: "Try again" })).not.toBeInTheDocument();
  });

  it("edits the board, reading it again", async () => {
    const { user } = row();

    await user.click(screen.getByRole("button", { name: "Edit Roadmap" }));

    expect(await screen.findByRole("dialog", { name: "Edit board" })).toBeInTheDocument();
    expect(api.previewEditBoard).toHaveBeenCalledWith("board-1");
  });

  it("asks before removing the board", async () => {
    const { user } = row();

    await user.click(screen.getByRole("button", { name: "Remove Roadmap" }));

    expect(await screen.findByRole("alertdialog", { name: "Remove Roadmap?" })).toBeInTheDocument();
  });

  it("keeps the clock of the age running", () => {
    at("2026-09-16T12:02:00Z");
    row();

    act(() => {
      vi.advanceTimersByTime(180_000);
    });

    expect(screen.getByText("Read 5m ago")).toBeInTheDocument();
  });
});
