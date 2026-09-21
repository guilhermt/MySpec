import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ArchiveDiscussionDialog } from "@/features/discussion/ArchiveDiscussionDialog";
import { api } from "@/lib/wails";
import { renderWithStore } from "@/test/render";
import { makeDiscussion, makeState } from "@/test/wails-mock";

function dialog() {
  const onOpenChange = vi.fn();
  const view = renderWithStore(
    <ArchiveDiscussionDialog discussion={makeDiscussion()} open onOpenChange={onOpenChange} />,
    { state: makeState() },
  );
  return { ...view, onOpenChange };
}

describe("ArchiveDiscussionDialog", () => {
  it("says the conversation ends and what the history keeps", () => {
    dialog();

    expect(screen.getByRole("heading", { name: 'Archive "Invoices"?' })).toBeInTheDocument();
    expect(screen.getByText(/stay in the history/)).toBeInTheDocument();
  });

  it("archives the discussion and closes", async () => {
    const { user, onOpenChange } = dialog();

    await user.click(screen.getByRole("button", { name: "Archive" }));

    expect(api.archiveDiscussion).toHaveBeenCalledWith("discussion-1");
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
