import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RemoveBoardDialog } from "@/features/boards/RemoveBoardDialog";
import { api } from "@/lib/wails";
import { renderWithStore } from "@/test/render";
import { makeBoard, makeState } from "@/test/wails-mock";

function dialog() {
  const onOpenChange = vi.fn();
  const rendered = renderWithStore(
    <RemoveBoardDialog board={makeBoard()} open onOpenChange={onOpenChange} />,
    { state: makeState({ boards: [makeBoard()] }) },
  );
  return { ...rendered, onOpenChange };
}

describe("RemoveBoardDialog", () => {
  it("says what removing does to the repositories of the board", async () => {
    vi.mocked(api.previewRemoveBoard).mockResolvedValue({ toNoBoard: 3, removed: 1 });
    dialog();

    expect(screen.getByText("Remove Roadmap?")).toBeInTheDocument();
    expect(
      await screen.findByText(
        "3 repositories move to No board and 1 leaves MySpec. Tasks keep their cards, and nothing changes on GitHub or on disk.",
      ),
    ).toBeInTheDocument();
    expect(api.previewRemoveBoard).toHaveBeenCalledWith("board-1");
  });

  it("removes the board and closes", async () => {
    const { user, onOpenChange } = dialog();

    await user.click(screen.getByRole("button", { name: "Remove board" }));

    expect(api.removeBoard).toHaveBeenCalledWith("board-1");
    expect(onOpenChange.mock.calls.at(-1)?.[0]).toBe(false);
  });

  it("stays open with the reason when removing fails", async () => {
    vi.mocked(api.removeBoard).mockRejectedValue(new Error("database is locked"));
    const { user, onOpenChange } = dialog();

    await user.click(screen.getByRole("button", { name: "Remove board" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("database is locked");
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  it("leaves the board alone on Cancel", async () => {
    const { user, onOpenChange } = dialog();

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(api.removeBoard).not.toHaveBeenCalled();
    expect(onOpenChange.mock.calls.at(-1)?.[0]).toBe(false);
  });
});
