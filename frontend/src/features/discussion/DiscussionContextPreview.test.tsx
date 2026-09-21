import { screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DiscussionContextPreview } from "@/features/discussion/DiscussionContextPreview";
import { api } from "@/lib/wails";
import { renderWithStore } from "@/test/render";
import { makeBoardCard, makeState } from "@/test/wails-mock";

const FRESH = new Date(Date.now() - 60_000).toISOString();
const STALE = new Date(Date.now() - 10 * 60_000).toISOString();

const LOGIN = makeBoardCard({ readAt: FRESH });
const RESET = makeBoardCard({ key: "dev/web#13", number: 13, readAt: FRESH });

function preview(cards = [LOGIN], text = "") {
  return renderWithStore(<DiscussionContextPreview boardId="board-1" text={text} cards={cards} />, {
    state: makeState(),
  });
}

describe("DiscussionContextPreview", () => {
  it("folds the context the discussion will start with", async () => {
    const { user } = preview([LOGIN, RESET], "The login is slow");

    await waitFor(() => {
      expect(api.discussionContext).toHaveBeenCalledWith({
        boardId: "board-1",
        text: "The login is slow",
        cards: ["dev/web#12", "dev/web#13"],
      });
    });
    expect(screen.queryByTestId("markdown")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Context" }));

    expect(await screen.findByTestId("markdown")).toHaveTextContent("## Board");
    expect(api.refreshCard).not.toHaveBeenCalled();
  });

  it("refreshes the stale cards and reads the context again", async () => {
    preview([makeBoardCard({ readAt: STALE }), RESET]);

    expect(await screen.findByRole("status")).toHaveTextContent("Refreshing the cards…");

    await waitFor(() => {
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
    });
    expect(api.refreshCard).toHaveBeenCalledOnce();
    expect(api.refreshCard).toHaveBeenCalledWith("board-1", "dev/web#12");
    await waitFor(() => {
      expect(api.discussionContext).toHaveBeenCalledTimes(2);
    });
  });

  it("says the discussion will use the last reading when a refresh fails", async () => {
    vi.mocked(api.refreshCard).mockRejectedValue(new Error("GitHub rate limit reached."));

    preview([makeBoardCard({ readAt: STALE })]);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Couldn't refresh the cards: GitHub rate limit reached. The discussion will use the last reading.",
    );
  });

  it("reads the context again once the typing rests", async () => {
    const { rerender } = preview([LOGIN]);

    await waitFor(() => {
      expect(api.discussionContext).toHaveBeenCalledOnce();
    });

    rerender(<DiscussionContextPreview boardId="board-1" text="Billing" cards={[LOGIN]} />);

    await waitFor(() => {
      expect(api.discussionContext).toHaveBeenLastCalledWith({
        boardId: "board-1",
        text: "Billing",
        cards: ["dev/web#12"],
      });
    });
  });
});
