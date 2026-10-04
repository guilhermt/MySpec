import { screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DeleteDiscussionDialog } from "@/features/discussion/DeleteDiscussionDialog";
import { api } from "@/lib/wails";
import { useAppStore } from "@/store/app-store";
import { renderWithStore } from "@/test/render";
import { makeDraft, makeState } from "@/test/wails-mock";

function dialog(published = 2, archived = false, neighbor: string | null = null) {
  const onOpenChange = vi.fn();
  const discussion = {
    id: "discussion-1",
    title: "Invoices",
    drafts: Array.from({ length: published }, (_, index) =>
      makeDraft({ id: `draft-${index}`, published: true }),
    ),
  };
  const view = renderWithStore(
    <DeleteDiscussionDialog
      discussion={discussion}
      archived={archived}
      neighbor={neighbor}
      open
      onOpenChange={onOpenChange}
    />,
    { state: makeState() },
  );
  return { ...view, onOpenChange };
}

describe("DeleteDiscussionDialog", () => {
  it("says what the deletion takes and what it leaves on GitHub", () => {
    dialog();

    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Delete “Invoices”?" })).toBeInTheDocument();
    expect(
      screen.getByText(
        "The conversation, the document and the drafts go away, and the discussion doesn't go to History. What was published on GitHub stays: 2 issues.",
      ),
    ).toBeInTheDocument();
  });

  it("leaves the sentence about GitHub out when nothing was published", () => {
    dialog(0);

    expect(screen.queryByText(/GitHub/)).not.toBeInTheDocument();
  });

  it.each([
    [
      0,
      "Nothing changes on GitHub. A task started from one of its cards loses the document in its context.",
    ],
    [
      1,
      "Nothing changes on GitHub: the issue it published stays. A task started from one of its cards loses the document in its context.",
    ],
    [
      4,
      "Nothing changes on GitHub: the 4 issues it published stay. A task started from one of its cards loses the document in its context.",
    ],
  ])(
    "says what the deletion of an archived discussion with %i published leaves",
    (published, line) => {
      dialog(published, true);

      expect(
        screen.getByText(
          "This removes the archived discussion, its document, its drafts and its conversation from History. It can't be undone.",
        ),
      ).toBeInTheDocument();
      expect(screen.getByText(line)).toBeInTheDocument();
    },
  );

  it("deletes an archived discussion for good, with the row that takes its place", async () => {
    const { user, onOpenChange } = dialog(1, true, "discussion-2");

    await user.click(screen.getByRole("button", { name: "Delete discussion" }));

    expect(api.deleteDiscussion).toHaveBeenCalledWith("discussion-1");
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(useAppStore.getState().historyFocus).toBe("discussion-2");
  });

  it("says Couldn't delete it when the archived one is refused", async () => {
    vi.mocked(api.deleteDiscussion).mockRejectedValueOnce(new Error("the database is locked"));
    const { user } = dialog(1, true);

    await user.click(screen.getByRole("button", { name: "Delete discussion" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Couldn't delete it: the database is locked",
    );
  });

  it("opens on Cancel, not on the deletion", async () => {
    dialog();

    await waitFor(() => expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus());
  });

  it("does not delete with Ctrl+Enter", async () => {
    const { user } = dialog();
    await waitFor(() => expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus());

    await user.keyboard("{Control>}{Enter}{/Control}");

    expect(api.deleteDiscussion).not.toHaveBeenCalled();
  });

  it("deletes the discussion and closes", async () => {
    const { user, onOpenChange } = dialog();

    await user.click(screen.getByRole("button", { name: "Delete discussion" }));

    expect(api.deleteDiscussion).toHaveBeenCalledWith("discussion-1");
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it("stays open with the refusal in the footer", async () => {
    vi.mocked(api.deleteDiscussion).mockRejectedValueOnce(new Error("A publication is running."));
    const { user, onOpenChange } = dialog();

    await user.click(screen.getByRole("button", { name: "Delete discussion" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("A publication is running.");
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("keeps Cancel, × and Esc inert while it deletes, and deletes once", async () => {
    let finish: () => void = () => {};
    vi.mocked(api.deleteDiscussion).mockReturnValueOnce(
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
    );
    const { user, onOpenChange } = dialog();

    await user.click(screen.getByRole("button", { name: "Delete discussion" }));

    const busy = await screen.findByRole("button", { name: "Deleting…" });
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("button", { name: "Close" })).toHaveAttribute("aria-disabled", "true");
    await user.keyboard("{Escape}");
    await user.click(screen.getByRole("button", { name: "Close" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await user.click(busy);
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(api.deleteDiscussion).toHaveBeenCalledOnce();

    finish();
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });
});
