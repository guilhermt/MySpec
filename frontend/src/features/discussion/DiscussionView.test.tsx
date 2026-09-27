import { screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DiscussionView } from "@/features/discussion/DiscussionView";
import { api, type DiscussionSummary } from "@/lib/wails";
import { renderWithStore } from "@/test/render";
import { makeDiscussion, makeDraft, makeState } from "@/test/wails-mock";

function view(overrides: Partial<DiscussionSummary> = {}) {
  return renderWithStore(<DiscussionView discussionId="discussion-1" />, {
    state: makeState({ discussions: [makeDiscussion(overrides)] }),
    ui: { location: { kind: "discussion", id: "discussion-1" } },
  });
}

describe("DiscussionView", () => {
  it("puts the header, the bar and the conversation together", async () => {
    view();

    expect(screen.getByText("Invoices")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Discussing");
    expect(screen.getByRole("button", { name: "Documents" })).toBeInTheDocument();
    await waitFor(() => {
      expect(api.getTranscript).toHaveBeenCalledWith("discussion-1", "discussion");
    });
  });

  it("puts the drafts above the conversation", () => {
    view({ status: "deciding", drafts: [makeDraft()] });

    expect(screen.getByText("Drafts")).toBeInTheDocument();
    expect(screen.getByRole("article", { name: "Draft Export the invoices" })).toBeInTheDocument();
  });

  it("opens the documents panel from its button, and closes it with ×", async () => {
    const { user } = view();
    const button = () => screen.getByRole("button", { name: "Documents" });
    expect(screen.queryByRole("complementary", { name: "Documents" })).not.toBeInTheDocument();

    await user.click(button());
    expect(button()).toHaveAttribute("aria-pressed", "true");
    const panel = screen.getByRole("complementary", { name: "Documents" });
    expect(panel).toBeInTheDocument();

    await user.click(within(panel).getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("complementary", { name: "Documents" })).not.toBeInTheDocument();
    expect(button()).toHaveFocus();
  });

  it("shows nothing at all for a discussion that is no longer there", () => {
    const { container } = renderWithStore(<DiscussionView discussionId="discussion-9" />, {
      state: makeState({ discussions: [makeDiscussion()] }),
    });

    expect(container.querySelector("header")).toBeNull();
  });

  it("lets nothing but the conversation scroll in its column", () => {
    view();

    const column = screen.getByRole("textbox").closest(".overflow-clip");
    expect(column).not.toBeNull();
  });
});
