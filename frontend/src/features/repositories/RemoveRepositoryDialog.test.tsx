import { screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RemoveRepositoryDialog } from "@/features/repositories/RemoveRepositoryDialog";
import { api } from "@/lib/wails";
import { renderWithStore } from "@/test/render";
import { makeBoard, makeRepository, makeState } from "@/test/wails-mock";

function dialog(overrides = {}, state = makeState()) {
  const onOpenChange = vi.fn();
  const onRemoved = vi.fn();
  const rendered = renderWithStore(
    <RemoveRepositoryDialog
      repository={makeRepository(overrides)}
      open
      onOpenChange={onOpenChange}
      onRemoved={onRemoved}
    />,
    { state },
  );
  return { ...rendered, onOpenChange, onRemoved };
}

describe("RemoveRepositoryDialog", () => {
  it("says what removing does, and what it leaves alone", () => {
    dialog();

    expect(screen.getByRole("alertdialog", { name: "Remove dev/web?" })).toBeInTheDocument();
    expect(
      screen.getByText(
        "The repository leaves MySpec. Nothing is deleted on disk: the clone stays at ~/projects/web.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText(/A reading of the board/)).not.toBeInTheDocument();
  });

  it("names the board, and says a reading may suggest the repository again", () => {
    dialog({ boardId: "board-1" }, makeState({ boards: [makeBoard()] }));

    expect(
      screen.getByText(
        "The repository leaves MySpec and the board Roadmap. Nothing is deleted on disk: the clone stays at ~/projects/web.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText("A reading of the board suggests it again while its issues are there."),
    ).toBeInTheDocument();
  });

  it("says there is nothing on disk to keep for a repository without a clone", () => {
    dialog({ cloned: false, path: "" });

    expect(
      screen.getByText("The repository leaves MySpec. Nothing is deleted on disk."),
    ).toBeInTheDocument();
  });

  it("opens on Cancel", async () => {
    dialog();

    await waitFor(() => expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus());
  });

  it("removes the repository and closes", async () => {
    const { user, onOpenChange, onRemoved } = dialog();

    await user.click(screen.getByRole("button", { name: "Remove repository" }));

    expect(api.removeRepository).toHaveBeenCalledWith("repo-1");
    await waitFor(() => expect(onOpenChange).toHaveBeenLastCalledWith(false));
    expect(onRemoved).toHaveBeenCalledOnce();
  });

  it("stays open with Removing… until the call ends", async () => {
    let finish: () => void = () => {};
    vi.mocked(api.removeRepository).mockReturnValueOnce(
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
    );
    const { user, onOpenChange } = dialog();

    await user.click(screen.getByRole("button", { name: "Remove repository" }));

    expect(screen.getByRole("button", { name: "Removing…" })).toHaveAttribute("aria-busy", "true");
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("button", { name: "Close" })).toHaveAttribute("aria-disabled", "true");
    await user.keyboard("{Escape}");
    expect(onOpenChange).not.toHaveBeenCalledWith(false);

    finish();
    await waitFor(() => expect(onOpenChange).toHaveBeenLastCalledWith(false));
  });

  it("keeps the dialog open and shows the refusal in its footer", async () => {
    vi.mocked(api.removeRepository).mockRejectedValueOnce(new Error("It has a task."));
    const { user, onOpenChange, onRemoved } = dialog();

    await user.click(screen.getByRole("button", { name: "Remove repository" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("It has a task.");
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
    expect(onRemoved).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Remove repository" })).toBeEnabled();
  });

  it("leaves the repository alone on Cancel", async () => {
    const { user, onOpenChange } = dialog();

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(api.removeRepository).not.toHaveBeenCalled();
    expect(onOpenChange.mock.calls.at(-1)?.[0]).toBe(false);
  });
});
