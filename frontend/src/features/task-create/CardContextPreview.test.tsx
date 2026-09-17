import { screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CardContextPreview } from "@/features/task-create/CardContextPreview";
import { api } from "@/lib/wails";
import { renderWithStore } from "@/test/render";
import { makeBoardCard, makeState } from "@/test/wails-mock";

const FRESH = () => new Date(Date.now() - 60_000).toISOString();
const STALE = () => new Date(Date.now() - 10 * 60_000).toISOString();

function preview(readAt: string) {
  return renderWithStore(
    <CardContextPreview boardId="board-1" card={makeBoardCard({ readAt })} />,
    { state: makeState() },
  );
}

describe("CardContextPreview", () => {
  it("folds the context of the card, read from the board", async () => {
    const { user } = preview(FRESH());

    await waitFor(() => {
      expect(api.cardContext).toHaveBeenCalledWith("board-1", "dev/web#12");
    });
    expect(screen.queryByTestId("markdown")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Context from the card" }));

    expect(await screen.findByTestId("markdown")).toHaveTextContent(
      "### Card: Add the login screen",
    );
    expect(api.refreshCard).not.toHaveBeenCalled();
  });

  it("refreshes a stale card and reads the context again", async () => {
    let finish = () => {};
    vi.mocked(api.refreshCard).mockReturnValue(
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
    );

    preview(STALE());

    expect(await screen.findByRole("status")).toHaveTextContent("Refreshing the card…");
    expect(api.refreshCard).toHaveBeenCalledOnce();
    expect(api.refreshCard).toHaveBeenCalledWith("board-1", "dev/web#12");

    vi.mocked(api.cardContext).mockResolvedValue("### Card: Refreshed\n");
    finish();

    await waitFor(() => {
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
    });
    await waitFor(() => {
      expect(api.cardContext).toHaveBeenCalledTimes(2);
    });
  });

  it("says the task will use the last reading when the refresh fails", async () => {
    vi.mocked(api.refreshCard).mockRejectedValue(new Error("GitHub rate limit reached."));

    preview(STALE());

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Couldn't refresh the card: GitHub rate limit reached. The task will use the last reading.",
    );
  });
});
