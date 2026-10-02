import { screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DeleteDiscussionDialog } from "@/features/discussion/DeleteDiscussionDialog";
import { api } from "@/lib/wails";
import { renderWithStore } from "@/test/render";
import { makeDraft, makeState } from "@/test/wails-mock";

function dialog(published = 2, archived = false) {
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

  it("leaves History out of the text of an archived discussion", () => {
    dialog(1, true);

    expect(
      screen.getByText(
        "The conversation, the document and the drafts go away. What was published on GitHub stays: 1 issue.",
      ),
    ).toBeInTheDocument();
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
});
