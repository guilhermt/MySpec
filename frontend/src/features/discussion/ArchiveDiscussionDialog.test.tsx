import { screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ArchiveDiscussionDialog } from "@/features/discussion/ArchiveDiscussionDialog";
import { api } from "@/lib/wails";
import { renderWithStore } from "@/test/render";
import { makeDraft, makeState } from "@/test/wails-mock";

function dialog() {
  const onOpenChange = vi.fn();
  const discussion = {
    id: "discussion-1",
    title: "Invoices",
    drafts: [
      makeDraft({ id: "a", published: true, outcome: "created", round: 1 }),
      makeDraft({ id: "b", title: "Overage", decision: "approved" }),
    ],
  };
  const view = renderWithStore(
    <ArchiveDiscussionDialog discussion={discussion} open onOpenChange={onOpenChange} />,
    { state: makeState() },
  );
  return { ...view, onOpenChange };
}

describe("ArchiveDiscussionDialog", () => {
  it("says the conversation ends, what was published and what was not", () => {
    dialog();

    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Archive “Invoices”?" })).toBeInTheDocument();
    expect(screen.getByText(/stay in History/)).toBeInTheDocument();
    expect(
      screen.getByText("Published: 1 issue in round 1: 1 created · Not published: Overage"),
    ).toBeInTheDocument();
  });

  it("opens on Cancel, not on the archive", async () => {
    dialog();

    await waitFor(() => expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus());
  });

  it("archives the discussion and closes", async () => {
    const { user, onOpenChange } = dialog();

    await user.click(screen.getByRole("button", { name: /^Archive/ }));

    expect(api.archiveDiscussion).toHaveBeenCalledWith("discussion-1");
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it("archives with Ctrl+Enter", async () => {
    const { user } = dialog();
    await waitFor(() => expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus());

    await user.keyboard("{Control>}{Enter}{/Control}");

    expect(api.archiveDiscussion).toHaveBeenCalledWith("discussion-1");
  });

  it("stays open with the refusal in the footer", async () => {
    vi.mocked(api.archiveDiscussion).mockRejectedValueOnce(new Error("A publication is running."));
    const { user, onOpenChange } = dialog();

    await user.click(screen.getByRole("button", { name: /^Archive/ }));

    expect(await screen.findByRole("alert")).toHaveTextContent("A publication is running.");
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("keeps Cancel, × and Esc inert while it archives, and archives once", async () => {
    let finish: () => void = () => {};
    vi.mocked(api.archiveDiscussion).mockReturnValueOnce(
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
    );
    const { user, onOpenChange } = dialog();

    await user.click(screen.getByRole("button", { name: /^Archive/ }));

    const busy = await screen.findByRole("button", { name: "Archiving…" });
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("button", { name: "Close" })).toHaveAttribute("aria-disabled", "true");
    await user.keyboard("{Escape}");
    await user.click(screen.getByRole("button", { name: "Close" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await user.click(busy);
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(api.archiveDiscussion).toHaveBeenCalledOnce();

    finish();
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });
});
