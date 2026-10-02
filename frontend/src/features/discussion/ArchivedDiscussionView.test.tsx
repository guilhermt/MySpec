import { screen, waitFor, within } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { ArchivedDiscussionView } from "@/features/discussion/ArchivedDiscussionView";
import { type ArchivedDiscussion, api } from "@/lib/wails";
import { useAppStore } from "@/store/app-store";
import { renderWithStore } from "@/test/render";
import {
  makeArchivedDiscussion,
  makeDraft,
  makeEntry,
  makeState,
  makeTranscript,
} from "@/test/wails-mock";

function view(overrides: Partial<ArchivedDiscussion> = {}) {
  const discussion = makeArchivedDiscussion(overrides);
  return renderWithStore(<ArchivedDiscussionView discussionId={discussion.id} />, {
    state: makeState({ discussionHistory: [discussion] }),
    ui: { location: { kind: "archived-discussion", id: discussion.id } },
  });
}

describe("ArchivedDiscussionView", () => {
  // The conversation follows its end as entries arrive, which jsdom cannot do.
  beforeAll(() => {
    Object.defineProperty(Element.prototype, "scrollTo", { value: vi.fn(), configurable: true });
  });

  it("names the discussion, says it is archived and what it published", () => {
    view({ publishedCount: 2 });

    expect(screen.getByRole("heading", { level: 1, name: "Invoices" })).toBeInTheDocument();
    expect(screen.getByText("Archived")).toBeInTheDocument();
    expect(screen.getByText("2 cards published")).toBeInTheDocument();
    expect(screen.getByText(/2026/)).toBeInTheDocument();
  });

  it("shows the document the discussion wrote", async () => {
    view();

    await waitFor(() => {
      expect(api.readDiscussionArtifact).toHaveBeenCalledWith("discussion-1", "discussion.md");
    });
    expect(await screen.findByTestId("markdown")).toHaveTextContent("# Discussion");
  });

  it("says when no document was written", async () => {
    vi.mocked(api.readDiscussionArtifact).mockRejectedValueOnce(new Error("no such file"));
    view();

    expect(await screen.findByText("No document was written.")).toBeInTheDocument();
  });

  it("lists the drafts with what became of them on GitHub", async () => {
    const { user } = view({
      drafts: [
        makeDraft({
          id: "draft-1",
          title: "Export the invoices",
          outcome: "created",
          number: 31,
          url: "https://github.com/dev/web/issues/31",
          published: true,
        }),
        makeDraft({ id: "draft-2", position: 2, kind: "update", title: "Fix the header" }),
      ],
    });

    const drafts = screen.getByRole("region", { name: "Drafts" });
    expect(within(drafts).getByText("New card")).toBeInTheDocument();
    expect(within(drafts).getByText("Export the invoices")).toBeInTheDocument();
    expect(within(drafts).getByText("Created")).toBeInTheDocument();
    expect(within(drafts).getByText("Update")).toBeInTheDocument();
    expect(within(drafts).getByText("Not published")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /dev\/web#31/ }));

    expect(api.openExternal).toHaveBeenCalledWith("https://github.com/dev/web/issues/31");
  });

  it("gathers the cards of an epic under it", () => {
    view({
      drafts: [
        makeDraft({ id: "epic-1", kind: "epic", title: "Invoicing" }),
        makeDraft({
          id: "draft-2",
          position: 2,
          title: "Export the invoices",
          epic: { draft: "epic-1", key: "", reference: "", title: "Invoicing", url: "" },
        }),
      ],
    });

    const epic = screen.getByRole("list", { name: "Epic Invoicing" });
    expect(within(epic).getByText("Invoicing")).toBeInTheDocument();
    expect(within(epic).getByText("Export the invoices")).toBeInTheDocument();
  });

  it("brings the conversation of the discussion back", async () => {
    vi.mocked(api.getTranscript).mockResolvedValueOnce(
      makeTranscript({
        taskId: "discussion-1",
        stage: "discussion",
        entries: [makeEntry("assistant")],
      }),
    );
    view();

    expect(api.getTranscript).toHaveBeenCalledWith("discussion-1", "discussion");
    expect(await screen.findByText("On it.")).toBeInTheDocument();
  });

  it("goes to the history through the breadcrumb", async () => {
    const { user } = view();

    await user.click(screen.getByRole("button", { name: "History" }));

    expect(useAppStore.getState().location).toEqual({ kind: "history" });
  });

  it("asks before deleting the discussion", async () => {
    const { user } = view();

    await user.click(screen.getByRole("button", { name: "Delete discussion" }));

    expect(await screen.findByRole("alertdialog")).toHaveTextContent('Delete "Invoices"?');
  });

  it("reads the conversation as a feed of the discussion agent", async () => {
    vi.mocked(api.getTranscript).mockResolvedValueOnce(
      makeTranscript({
        taskId: "discussion-1",
        stage: "discussion",
        entries: [makeEntry("user"), makeEntry("assistant")],
      }),
    );
    view();

    const feed = await screen.findByRole("feed", {
      name: "Conversation with the discussion agent",
    });
    expect(within(feed).getByRole("article", { name: /^You, / })).toBeInTheDocument();
    expect(within(feed).getByRole("article", { name: /^Discussion agent, / })).toHaveTextContent(
      "On it.",
    );
  });
});
