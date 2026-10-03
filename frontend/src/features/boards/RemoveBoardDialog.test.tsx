import { screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RemoveBoardDialog } from "@/features/boards/RemoveBoardDialog";
import { api } from "@/lib/wails";
import { renderWithStore } from "@/test/render";
import { makeBoard, makeBoardRemoval, makeState } from "@/test/wails-mock";

const TRAILER = "Tasks keep their cards, and nothing changes on GitHub or on disk.";

function dialog() {
  const onOpenChange = vi.fn();
  const onRemoved = vi.fn();
  const rendered = renderWithStore(
    <RemoveBoardDialog
      board={makeBoard()}
      open
      onOpenChange={onOpenChange}
      onRemoved={onRemoved}
    />,
    { state: makeState({ boards: [makeBoard()] }) },
  );
  return { ...rendered, onOpenChange, onRemoved };
}

describe("RemoveBoardDialog", () => {
  it("says what removing does, with a line for each destination", async () => {
    vi.mocked(api.previewRemoveBoard).mockResolvedValue(
      makeBoardRemoval({
        toNoBoard: 2,
        removed: 1,
        toNoBoardNames: ["dev/web", "dev/api"],
        removedNames: ["dev/billing"],
      }),
    );
    dialog();

    expect(screen.getByRole("alertdialog", { name: "Remove Roadmap?" })).toBeInTheDocument();
    expect(
      await screen.findByText(`2 repositories move to No board and 1 leaves MySpec. ${TRAILER}`),
    ).toBeInTheDocument();
    expect(screen.getByText("To No board:")).toBeInTheDocument();
    expect(screen.getByText("Leaves MySpec:")).toBeInTheDocument();
    expect(screen.getByText(/billing, with no clone, tasks or reviews/)).toBeInTheDocument();
    expect(api.previewRemoveBoard).toHaveBeenCalledWith("board-1");
  });

  it("has no part for zero and no line for a destination without names", async () => {
    vi.mocked(api.previewRemoveBoard).mockResolvedValue(
      makeBoardRemoval({ toNoBoard: 1, toNoBoardNames: ["dev/api"] }),
    );
    dialog();

    expect(
      await screen.findByText(`1 repository moves to No board. ${TRAILER}`),
    ).toBeInTheDocument();
    expect(screen.queryByText("Leaves MySpec:")).not.toBeInTheDocument();
  });

  it("says the board has no repositories", async () => {
    vi.mocked(api.previewRemoveBoard).mockResolvedValue(makeBoardRemoval());
    dialog();

    expect(
      await screen.findByText(`The board has no repositories. ${TRAILER}`),
    ).toBeInTheDocument();
  });

  it("says the board leaves MySpec while the preview is read, and Remove board is enabled", () => {
    vi.mocked(api.previewRemoveBoard).mockReturnValue(new Promise(() => {}));
    dialog();

    expect(screen.getByText("The board leaves MySpec.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove board" })).toBeEnabled();
  });

  it("keeps that sentence and says why when the preview fails, and still removes", async () => {
    vi.mocked(api.previewRemoveBoard).mockRejectedValue(new Error("database is locked"));
    const { user, onOpenChange } = dialog();

    expect(
      await screen.findByText("Couldn't tell what happens to its repositories: database is locked"),
    ).toBeInTheDocument();
    expect(screen.getByText("The board leaves MySpec.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Remove board" }));

    expect(api.removeBoard).toHaveBeenCalledWith("board-1");
    await waitFor(() => expect(onOpenChange.mock.calls.at(-1)?.[0]).toBe(false));
  });

  it("removes the board, tells the page and closes", async () => {
    const { user, onOpenChange, onRemoved } = dialog();

    await user.click(screen.getByRole("button", { name: "Remove board" }));

    expect(api.removeBoard).toHaveBeenCalledWith("board-1");
    await waitFor(() => expect(onOpenChange.mock.calls.at(-1)?.[0]).toBe(false));
    expect(onRemoved).toHaveBeenCalledTimes(1);
  });

  it("stays open with the refusal in the footer when removing fails", async () => {
    vi.mocked(api.removeBoard).mockRejectedValue(new Error("database is locked"));
    const { user, onOpenChange, onRemoved } = dialog();

    await user.click(screen.getByRole("button", { name: "Remove board" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("database is locked");
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
    expect(onRemoved).not.toHaveBeenCalled();
  });

  it("says Removing… and holds the ways out while it removes", async () => {
    vi.mocked(api.removeBoard).mockReturnValue(new Promise(() => {}));
    const { user } = dialog();

    await user.click(screen.getByRole("button", { name: "Remove board" }));

    expect(await screen.findByRole("button", { name: "Removing…" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("button", { name: "Close" })).toHaveAttribute("aria-disabled", "true");
  });

  it("opens on Cancel and leaves the board alone on it", async () => {
    const { user, onOpenChange } = dialog();

    await waitFor(() => expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus());
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(api.removeBoard).not.toHaveBeenCalled();
    expect(onOpenChange.mock.calls.at(-1)?.[0]).toBe(false);
  });

  it("does not confirm on Ctrl+Enter", async () => {
    const { user } = dialog();

    await user.keyboard("{Control>}{Enter}{/Control}");

    expect(api.removeBoard).not.toHaveBeenCalled();
  });
});
