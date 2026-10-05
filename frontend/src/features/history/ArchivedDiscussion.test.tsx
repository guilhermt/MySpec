import { screen, waitFor, within } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { ArchivedDiscussion } from "@/features/history/ArchivedDiscussion";
import { ARTIFACT_MISSING } from "@/lib/errors";
import { olderKey } from "@/lib/history";
import { type ArchivedDiscussion as ArchivedDiscussionItem, api, type Entry } from "@/lib/wails";
import { useAppStore } from "@/store/app-store";
import { renderWithStore } from "@/test/render";
import {
  makeArchivedDiscussion,
  makeBoard,
  makeDraft,
  makeEntry,
  makeState,
  makeTranscript,
} from "@/test/wails-mock";

function view(
  overrides: Partial<ArchivedDiscussionItem> = {},
  ui: Parameters<typeof renderWithStore>[1] = {},
) {
  const discussion = makeArchivedDiscussion(overrides);
  return renderWithStore(<ArchivedDiscussion discussionId={discussion.id} />, {
    state: makeState({
      discussionHistory: [discussion],
      boards: [makeBoard({ id: "board-1", title: "Roadmap" })],
    }),
    ...ui,
    ui: { location: { kind: "archived-discussion", id: discussion.id }, ...ui.ui },
  });
}

function transcriptOf(entries: Entry[]) {
  vi.mocked(api.getTranscript).mockResolvedValueOnce(
    makeTranscript({ taskId: "discussion-1", stage: "discussion", entries }),
  );
}

describe("ArchivedDiscussion", () => {
  // The conversation follows its end as entries arrive, which jsdom cannot do.
  beforeAll(() => {
    Object.defineProperty(Element.prototype, "scrollTo", { value: vi.fn(), configurable: true });
  });

  it("names the discussion, says it is archived and opens the board", async () => {
    const { user } = view();

    expect(screen.getByRole("heading", { level: 1, name: "Invoices" })).toBeInTheDocument();
    expect(screen.getByText("Archived", { selector: "span" })).toHaveAttribute(
      "data-variant",
      "default",
    );
    await user.click(screen.getByRole("button", { name: "Roadmap" }));

    expect(useAppStore.getState().location).toEqual({ kind: "board", id: "board-1" });
  });

  it("leaves the board button out when the board was removed", () => {
    renderWithStore(<ArchivedDiscussion discussionId="discussion-1" />, {
      state: makeState({ discussionHistory: [makeArchivedDiscussion()], boards: [] }),
      ui: { location: { kind: "archived-discussion", id: "discussion-1" } },
    });

    expect(screen.queryByRole("button", { name: "Roadmap" })).not.toBeInTheDocument();
  });

  it("says the facts, with what the discussion published", () => {
    view({ drafts: [makeDraft({ outcome: "created", published: true, number: 31 })] });

    const facts = screen.getByText("Board", { selector: "dt" }).closest("dl");
    expect(facts).toHaveTextContent("Roadmap · from web#1");
    expect(facts).toHaveTextContent("1 of 1 draft: 1 created");
  });

  it("puts the focus on the title on arrival", async () => {
    view({}, { ui: { pendingFocus: "title" } });

    await waitFor(() =>
      expect(screen.getByRole("heading", { level: 1, name: "Invoices" })).toHaveFocus(),
    );
  });

  it("lists what it published, the cards of an epic under it, and opens an issue", async () => {
    const { user } = view({
      drafts: [
        makeDraft({ id: "epic-1", kind: "epic", title: "Invoicing", position: 1 }),
        makeDraft({
          id: "draft-2",
          position: 2,
          title: "Export the invoices",
          outcome: "created",
          number: 31,
          url: "https://github.com/dev/web/issues/31",
          published: true,
          epic: { draft: "epic-1", key: "", reference: "", title: "Invoicing", url: "" },
        }),
        makeDraft({ id: "draft-3", position: 3, kind: "update", title: "Fix the header" }),
      ],
    });

    const section = screen.getByRole("heading", { name: "What it published" }).closest("section");
    const rows = within(section as HTMLElement).getAllByRole("listitem");
    expect(rows.map((row) => row.textContent)).toEqual([
      "EpicInvoicingNot published · not decided",
      "New cardExport the invoicesCreated web#31",
      "UpdateFix the headerNot published · not decided",
    ]);
    expect(within(section as HTMLElement).getByText("New card")).toHaveAttribute(
      "data-variant",
      "default",
    );
    await user.click(screen.getByRole("link", { name: "Created web#31" }));

    expect(api.openExternal).toHaveBeenCalledWith("https://github.com/dev/web/issues/31");
  });

  it("opens the document the discussion wrote in place, with no way on to a panel", async () => {
    const { user } = view();

    await user.click(await screen.findByRole("button", { name: /^discussion\.md/ }));

    await waitFor(() => {
      expect(api.readDiscussionArtifact).toHaveBeenCalledWith("discussion-1", "discussion.md");
    });
    expect(await screen.findByText("# Discussion")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Open in Documents" })).not.toBeInTheDocument();
  });

  it("says when no document was written, on a line that doesn't open", async () => {
    vi.mocked(api.readDiscussionArtifact).mockRejectedValueOnce(
      new Error(`${ARTIFACT_MISSING}: discussion.md`),
    );
    view();

    expect(await screen.findByText("No document was written.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^No document/ })).not.toBeInTheDocument();
  });

  it("says a document it couldn't read, and reads it again on Try again", async () => {
    vi.mocked(api.readDiscussionArtifact).mockRejectedValueOnce(
      new Error("open /data/discussion-1/discussion.md: permission denied"),
    );
    const { user } = view();

    expect(await screen.findByText("Couldn't read discussion.md")).toBeInTheDocument();
    expect(screen.getByText(/permission denied/)).toBeInTheDocument();
    expect(screen.queryByText("No document was written.")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Try again" }));

    expect(await screen.findByRole("button", { name: /^discussion\.md/ })).toBeInTheDocument();
    expect(screen.queryByText("Couldn't read discussion.md")).not.toBeInTheDocument();
  });

  it("links the cards it started from to GitHub", async () => {
    const { user } = view();

    await user.click(screen.getByRole("link", { name: "web#12" }));

    expect(api.openExternal).toHaveBeenCalledWith("https://github.com/dev/web/issues/12");
  });

  it("opens the whole conversation, read only, from its line", async () => {
    transcriptOf([makeEntry("user"), makeEntry("assistant")]);
    const { user } = view();

    const line = await screen.findByRole("button", { name: /^Conversation/ });
    await waitFor(() => expect(line).toHaveTextContent("2 messages, read only"));
    expect(line).toHaveAttribute("aria-expanded", "false");
    expect(api.getTranscript).toHaveBeenCalledWith("discussion-1", "discussion");
    expect(screen.queryByText("On it.")).not.toBeInTheDocument();

    await user.click(line);

    expect(line).toHaveAttribute("aria-expanded", "true");
    expect(await screen.findByText("On it.")).toBeInTheDocument();
    await user.click(line);
    expect(line).toHaveAttribute("aria-expanded", "false");
  });

  it("opens and folds the conversation with → and ←", async () => {
    transcriptOf([makeEntry("assistant")]);
    const { user } = view();
    const line = await screen.findByRole("button", { name: /^Conversation/ });
    line.focus();

    await user.keyboard("{ArrowRight}");
    expect(line).toHaveAttribute("aria-expanded", "true");
    await user.keyboard("{ArrowLeft}");

    expect(line).toHaveAttribute("aria-expanded", "false");
  });

  it("goes to the history through the breadcrumb", async () => {
    const { user } = view();

    await user.click(screen.getByRole("button", { name: "History" }));

    expect(useAppStore.getState().location).toEqual({ kind: "history" });
  });

  it("asks before deleting, on Cancel, and gives the focus back to ⋯", async () => {
    const { user } = view();
    await user.click(screen.getByRole("button", { name: "More actions" }));
    await user.click(await screen.findByRole("menuitem", { name: "Delete…" }));

    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveTextContent("Delete “Invoices”?");
    await waitFor(() =>
      expect(within(dialog).getByRole("button", { name: "Cancel" })).toHaveFocus(),
    );
    await user.tab();
    await user.tab();
    await user.tab();
    await expect.poll(() => dialog.contains(document.activeElement)).toBe(true);
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));

    await waitFor(() => expect(screen.getByRole("button", { name: "More actions" })).toHaveFocus());
    expect(api.deleteDiscussion).not.toHaveBeenCalled();
  });

  it("deletes the discussion and goes back to History, the focus on the row that took its place", async () => {
    const newer = makeArchivedDiscussion({
      id: "discussion-1",
      archivedAt: "2026-09-17T12:00:00Z",
    });
    const older = makeArchivedDiscussion({
      id: "discussion-2",
      archivedAt: "2026-09-16T12:00:00Z",
    });
    const { user } = view(
      {},
      {
        state: makeState({ discussionHistory: [], boards: [makeBoard({ id: "board-1" })] }),
        ui: {
          olderArchived: {
            tasks: {},
            reviews: {},
            discussions: { "discussion-1": newer, "discussion-2": older },
          },
          olderLists: {
            [olderKey("", "")]: {
              ids: ["discussion-1", "discussion-2"],
              next: null,
              matched: 2,
              status: "idle",
              error: "",
            },
          },
        },
      },
    );
    await user.click(screen.getByRole("button", { name: "More actions" }));
    await user.click(await screen.findByRole("menuitem", { name: "Delete…" }));

    await user.click(await screen.findByRole("button", { name: "Delete discussion" }));

    await waitFor(() => expect(useAppStore.getState().location).toEqual({ kind: "history" }));
    expect(api.deleteDiscussion).toHaveBeenCalledWith("discussion-1");
    expect(useAppStore.getState().historyFocus).toBe("discussion-2");
  });
});
