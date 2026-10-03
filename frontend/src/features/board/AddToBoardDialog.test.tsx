import { screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AddToBoardDialog } from "@/features/board/AddToBoardDialog";
import { api } from "@/lib/wails";
import { renderWithStore } from "@/test/render";
import { makeBoardRepositoryOption, makeRepository, makeState } from "@/test/wails-mock";

function dialog() {
  const onOpenChange = vi.fn();
  const onAdded = vi.fn();
  const rendered = renderWithStore(
    <AddToBoardDialog
      boardId="board-1"
      fullName="dev/web"
      open
      onOpenChange={onOpenChange}
      onAdded={onAdded}
    />,
    { state: makeState({ repositories: [makeRepository({ missing: true })] }) },
  );
  return { ...rendered, onOpenChange, onAdded };
}

describe("AddToBoardDialog", () => {
  it("checks the repository, shows how it ties, and adds it", async () => {
    vi.mocked(api.checkBoardRepository).mockResolvedValue(
      makeBoardRepositoryOption({ checked: false }),
    );
    const { user, onAdded } = dialog();

    expect(api.checkBoardRepository).toHaveBeenCalledWith("board-1", "dev/web");
    expect(await screen.findByRole("checkbox", { name: "dev/web 4 cards" })).toBeChecked();
    expect(
      screen.getByText("Registered · the clone at ~/projects/web is missing"),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^Add to board/ }));

    expect(api.addRepositoryToBoard).toHaveBeenCalledWith("board-1", {
      owner: "dev",
      name: "web",
      path: "",
    });
    await waitFor(() => {
      expect(onAdded).toHaveBeenCalled();
    });
  });
});
