import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DeleteDiscussionDialog } from "@/features/discussion/DeleteDiscussionDialog";
import { api } from "@/lib/wails";
import { renderWithStore } from "@/test/render";
import { makeDiscussion, makeState } from "@/test/wails-mock";

function dialog() {
  const onOpenChange = vi.fn();
  const view = renderWithStore(
    <DeleteDiscussionDialog discussion={makeDiscussion()} open onOpenChange={onOpenChange} />,
    { state: makeState() },
  );
  return { ...view, onOpenChange };
}

describe("DeleteDiscussionDialog", () => {
  it("says what the deletion takes and what it leaves on GitHub", () => {
    dialog();

    expect(screen.getByRole("heading", { name: 'Delete "Invoices"?' })).toBeInTheDocument();
    expect(screen.getByText(/What was published on GitHub stays/)).toBeInTheDocument();
  });

  it("deletes the discussion and closes", async () => {
    const { user, onOpenChange } = dialog();

    await user.click(screen.getByRole("button", { name: "Delete" }));

    expect(api.deleteDiscussion).toHaveBeenCalledWith("discussion-1");
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
