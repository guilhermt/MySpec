import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { StartTaskAction } from "@/features/board/StartTaskAction";
import { useStartCard } from "@/features/board/useStartCard";
import { api, type BoardCard, type Repository } from "@/lib/wails";
import { useAppStore } from "@/store/app-store";
import { renderWithStore } from "@/test/render";
import {
  makeBoard,
  makeBoardCard,
  makeBoardRepositoryOption,
  makeRepository,
  makeState,
} from "@/test/wails-mock";

const BOARD = makeBoard();

function Harness({ card }: { card: BoardCard }) {
  const start = useStartCard(BOARD, card);
  return <StartTaskAction board={BOARD} card={card} start={start} />;
}

function action(card: BoardCard, repository: Partial<Repository> = {}) {
  return renderWithStore(<Harness card={card} />, {
    state: makeState({ repositories: [makeRepository(repository)], boards: [BOARD] }),
  });
}

describe("StartTaskAction", () => {
  it("opens the creation dialog for the card", async () => {
    const { user } = action(makeBoardCard());

    await user.click(screen.getByRole("button", { name: /^Start task/ }));

    expect(useAppStore.getState().newTaskOpen).toBe(true);
    expect(useAppStore.getState().newTaskCard).toEqual({ boardId: "board-1", key: "dev/web#12" });
  });

  it("offers to clone, then waits for the clone to open the dialog", async () => {
    const uncloned = { cloned: false, path: "" };
    const { user } = action(makeBoardCard({ action: "clone" }), uncloned);

    await user.click(screen.getByRole("button", { name: /^Start task/ }));
    expect(screen.getByText("dev/web isn't cloned yet.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Clone and continue" }));

    expect(api.cloneRepository).toHaveBeenCalledWith("repo-1");
    expect(useAppStore.getState().pendingStart).toEqual({
      boardId: "board-1",
      key: "dev/web#12",
      repositoryId: "repo-1",
    });
    expect(useAppStore.getState().newTaskOpen).toBe(false);
  });

  it("leaves nothing pending when choosing the clone folder is cancelled", async () => {
    vi.mocked(api.cloneRepository).mockResolvedValue(false);
    const { user } = action(makeBoardCard({ action: "clone" }), { cloned: false, path: "" });

    await user.click(screen.getByRole("button", { name: /^Start task/ }));
    await user.click(screen.getByRole("button", { name: "Clone and continue" }));

    expect(useAppStore.getState().pendingStart).toBeNull();
  });

  it("shows a refused clone where it was asked", async () => {
    vi.mocked(api.cloneRepository).mockRejectedValue(new Error("Choose a clone folder first."));
    const { user } = action(makeBoardCard({ action: "clone" }), { cloned: false, path: "" });

    await user.click(screen.getByRole("button", { name: /^Start task/ }));
    await user.click(screen.getByRole("button", { name: "Clone and continue" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Choose a clone folder first.");
  });

  it("shows the clone running and the error of the last one", () => {
    action(makeBoardCard({ action: "clone" }), {
      cloned: false,
      path: "",
      cloning: true,
      cloneError: "remote hung up",
    });

    expect(screen.getByRole("status")).toHaveTextContent("Cloning dev/web…");
    expect(screen.getByRole("alert")).toHaveTextContent("remote hung up");
    expect(screen.queryByRole("button", { name: /^Start task/ })).not.toBeInTheDocument();
  });

  it("disables Start task for a missing clone and offers to change the path", async () => {
    const { user } = action(makeBoardCard({ action: "clone_missing" }), { missing: true });

    expect(screen.getByRole("button", { name: /^Start task/ })).toBeDisabled();
    expect(screen.getByText("The clone at /home/dev/projects/web is missing.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Change path" }));

    expect(api.changeRepositoryPath).toHaveBeenCalledWith("repo-1");
  });

  it("disables Start task for a repository of another board", () => {
    action(makeBoardCard({ action: "other_board", otherBoard: "Platform" }));

    expect(screen.getByRole("button", { name: /^Start task/ })).toBeDisabled();
    expect(screen.getByText("dev/web belongs to the board Platform.")).toBeInTheDocument();
  });

  it("adds the repository to the board through the dialog", async () => {
    vi.mocked(api.checkBoardRepository).mockResolvedValue(
      makeBoardRepositoryOption({ link: "clone", path: "/home/dev/web", checked: false }),
    );
    const { user } = action(makeBoardCard({ action: "add_to_board", repositoryId: "" }));

    expect(screen.getByText("dev/web isn't managed by this board.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /^Start task/ }));
    expect(api.checkBoardRepository).toHaveBeenCalledWith("board-1", "dev/web");
    await screen.findByText("dev/web");
    await user.click(screen.getByRole("button", { name: "Add to board" }));

    expect(api.addRepositoryToBoard).toHaveBeenCalledWith("board-1", {
      owner: "dev",
      name: "web",
      path: "/home/dev/web",
    });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("keeps the dialog open with the reason when adding fails", async () => {
    vi.mocked(api.addRepositoryToBoard).mockRejectedValue(new Error("database is locked"));
    const { user } = action(makeBoardCard({ action: "add_to_board", repositoryId: "" }));

    await user.click(screen.getByRole("button", { name: /^Start task/ }));
    await screen.findByText("dev/web");
    await user.click(screen.getByRole("button", { name: "Add to board" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("database is locked");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("shows nothing for a card with a task or a closed issue", () => {
    const { unmount } = action(makeBoardCard({ action: "has_task" }));
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    unmount();

    action(makeBoardCard({ action: "closed", state: "closed" }));
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
