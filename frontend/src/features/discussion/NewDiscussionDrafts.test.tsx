import { screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { NewDiscussionDrafts } from "@/features/discussion/NewDiscussionDrafts";
import { renderWithStore } from "@/test/render";
import { makeNewDiscussionDraft } from "@/test/wails-mock";

const NOW = Date.parse("2026-10-27T10:30:00Z");

const drafts = [
  makeNewDiscussionDraft({
    id: "a",
    title: "Billing rules",
    text: "\nInvoices close monthly.\nMore.",
  }),
  makeNewDiscussionDraft({ id: "b", boardId: "board-2", title: "", text: "" }),
];

function list(showBoard: boolean, onPick = vi.fn()) {
  return renderWithStore(
    <NewDiscussionDrafts
      drafts={drafts}
      showBoard={showBoard}
      boardTitle={(id) => (id === "board-2" ? "Docs" : "Roadmap")}
      now={NOW}
      onPick={onPick}
    />,
  );
}

describe("NewDiscussionDrafts", () => {
  it("lists each draft with its title, its age and the first line of its text", () => {
    list(false);

    const rows = within(screen.getByRole("list", { name: "Drafts" })).getAllByRole("listitem");
    expect(rows).toHaveLength(2);
    expect(within(rows[0] as HTMLElement).getByText("Billing rules")).toBeInTheDocument();
    expect(within(rows[0] as HTMLElement).getByText("Invoices close monthly.")).toBeInTheDocument();
    expect(within(rows[0] as HTMLElement).getByText("30m ago")).toBeInTheDocument();
  });

  it("calls a draft without a title Untitled", () => {
    list(false);

    expect(screen.getByText("Untitled")).toBeInTheDocument();
  });

  it("names the board only when asked to", () => {
    const { unmount } = list(false);
    expect(screen.queryByText(/Roadmap/)).not.toBeInTheDocument();
    unmount();

    list(true);
    expect(screen.getByText("Roadmap · Invoices close monthly.")).toBeInTheDocument();
    expect(screen.getByText("Docs")).toBeInTheDocument();
  });

  it("picks the draft of the row and focuses the first row", async () => {
    const onPick = vi.fn();
    const { user } = list(false, onPick);

    expect(screen.getAllByRole("button")[0]).toHaveFocus();
    await user.click(screen.getAllByRole("button")[1] as HTMLElement);

    expect(onPick).toHaveBeenCalledWith(drafts[1]);
  });
});
