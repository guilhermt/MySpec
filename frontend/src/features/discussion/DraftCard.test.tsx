import { screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DraftCard } from "@/features/discussion/DraftCard";
import type { DiscussionSummary, Draft, DraftCurrent } from "@/lib/wails";
import { api } from "@/lib/wails";
import { useAppStore } from "@/store/app-store";
import { renderWithStore } from "@/test/render";
import { makeDiscussion, makeDraft, makeDraftRef, makeState } from "@/test/wails-mock";

const DAY_MS = 24 * 60 * 60 * 1000;

function makeCurrent(overrides: Partial<DraftCurrent> = {}): DraftCurrent {
  return {
    title: "Export the invoices",
    body: "A button that exports the list.",
    module: "",
    status: "",
    epic: null,
    dependencies: [],
    readAt: new Date().toISOString(),
    ...overrides,
  };
}

function card(
  draftOverrides: Partial<Draft> = {},
  discussionOverrides: Partial<DiscussionSummary> = {},
) {
  const draft = makeDraft(draftOverrides);
  const discussion = makeDiscussion({ drafts: [draft], ...discussionOverrides });
  return renderWithStore(<DraftCard discussion={discussion} draft={draft} />, {
    state: makeState({ discussions: [discussion] }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("DraftCard", () => {
  it("names the draft, what it does and the repository it goes to", () => {
    card();

    const article = screen.getByRole("article", { name: "Draft Export the invoices" });
    expect(article).toHaveTextContent("New card");
    expect(screen.getByRole("button", { name: "Repository: dev/web" })).toBeInTheDocument();
  });

  it("warns when the repository left the board", () => {
    card({ repositoryId: "" });

    expect(screen.getByText("dev/web is no longer managed by the board.")).toBeInTheDocument();
  });

  it("records the decision of the user", async () => {
    const { user } = card();

    await user.click(screen.getByRole("button", { name: "Approve" }));

    expect(api.decideDraft).toHaveBeenCalledWith("discussion-1", "draft-1", "approved");
  });

  it("fades a discarded draft", () => {
    card({ decision: "discarded" });

    expect(screen.getByRole("article", { name: "Draft Export the invoices" })).toHaveClass(
      "opacity-60",
    );
  });

  it("chooses the module of a card", async () => {
    const { user } = card();

    await user.click(screen.getByRole("button", { name: "Module: No module" }));
    await user.click(await screen.findByRole("menuitemradio", { name: "Billing" }));

    expect(api.setDraftModule).toHaveBeenCalledWith("discussion-1", "draft-1", "Billing");
  });

  it("puts a card under an epic of the discussion", async () => {
    const epic = makeDraft({ id: "draft-2", kind: "epic", title: "Invoices", position: 2 });
    const draft = makeDraft();
    const discussion = makeDiscussion({ drafts: [draft, epic] });
    const { user } = renderWithStore(<DraftCard discussion={discussion} draft={draft} />, {
      state: makeState({ discussions: [discussion] }),
    });

    await user.click(screen.getByRole("button", { name: "Epic: No epic" }));
    await user.click(await screen.findByRole("menuitemradio", { name: "Invoices" }));

    expect(api.setDraftEpic).toHaveBeenCalledWith("discussion-1", "draft-1", "draft-2");
  });

  it("puts a card under an issue that already exists", async () => {
    const { user } = card();

    await user.click(screen.getByRole("button", { name: "Epic: No epic" }));
    await user.click(await screen.findByRole("menuitem", { name: "Existing issue…" }));
    await user.type(screen.getByLabelText("Epic issue"), "dev/web#3{Enter}");

    expect(api.setDraftEpic).toHaveBeenCalledWith("discussion-1", "draft-1", "dev/web#3");
  });

  it("gives up on the existing issue with Escape or with nothing written", async () => {
    const { user } = card();

    await user.click(screen.getByRole("button", { name: "Epic: No epic" }));
    await user.click(await screen.findByRole("menuitem", { name: "Existing issue…" }));
    await user.type(screen.getByLabelText("Epic issue"), "dev{Escape}");

    expect(screen.queryByLabelText("Epic issue")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Epic: No epic" }));
    await user.click(await screen.findByRole("menuitem", { name: "Existing issue…" }));
    await user.type(screen.getByLabelText("Epic issue"), "{Enter}");

    expect(screen.queryByLabelText("Epic issue")).not.toBeInTheDocument();
    expect(api.setDraftEpic).not.toHaveBeenCalled();
  });

  it("names the module row of a card the same whatever the board calls the field", () => {
    card({}, { moduleField: "Área" });

    expect(screen.getByText("Module")).toBeInTheDocument();
    expect(screen.queryByText("Área")).not.toBeInTheDocument();
  });

  it("says what the card has now when the update leaves it different", () => {
    card({
      kind: "update",
      title: "Export the invoices as CSV",
      card: {
        key: "dev/web#12",
        repository: "dev/web",
        number: 12,
        title: "Export the invoices",
        url: "https://github.com/dev/web/issues/12",
      },
      current: makeCurrent(),
    });

    expect(screen.getByText("Current: Export the invoices")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /dev\/web#12/ })).toBeInTheDocument();
  });

  it("shows what an update does to the body", async () => {
    const { user } = card({
      kind: "update",
      body: "A button that exports the list as CSV.",
      current: makeCurrent(),
    });

    await user.click(screen.getByRole("button", { name: "Changes" }));

    const diff = screen.getByLabelText("Changes to the body");
    expect(diff).toHaveTextContent("+A button that exports the list as CSV.");
    expect(diff).toHaveTextContent("-A button that exports the list.");
  });

  it("keeps what a published update did to the body", async () => {
    const { user } = card({
      kind: "update",
      body: "A button that exports the list as CSV.",
      current: makeCurrent(),
      outcome: "updated",
      number: 12,
      url: "https://github.com/dev/web/issues/12",
      published: true,
      publishedAt: "2026-09-17T12:00:00Z",
      decision: "approved",
    });

    expect(screen.queryByLabelText("Body")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Changes" }));

    expect(screen.getByLabelText("Changes to the body")).toHaveTextContent(
      "+A button that exports the list as CSV.",
    );
  });

  it("says the card of an update is not in the last reading", () => {
    card({ kind: "update", current: null });

    expect(
      screen.getByText("This card isn't in the last reading of the board."),
    ).toBeInTheDocument();
  });

  it("reads the card of an update again when the reading is old", async () => {
    card({
      kind: "update",
      card: {
        key: "dev/web#12",
        repository: "dev/web",
        number: 12,
        title: "Export the invoices",
        url: "https://github.com/dev/web/issues/12",
      },
      current: makeCurrent({ readAt: new Date(Date.now() - DAY_MS).toISOString() }),
    });

    expect(screen.getByRole("status")).toHaveTextContent("Refreshing the card…");
    await waitFor(() => expect(api.refreshCard).toHaveBeenCalledWith("board-1", "dev/web#12"));
  });

  it("says why the publication failed and offers it again", async () => {
    const { user } = card({ publishError: "gh: rate limited" });

    expect(screen.getByText("gh: rate limited")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Retry" }));

    expect(api.retryPublish).toHaveBeenCalledWith("discussion-1", "draft-1");
  });

  it("offers the publication again when a step after the issue failed", async () => {
    const { user } = card({
      outcome: "created",
      number: 31,
      url: "https://github.com/dev/web/issues/31",
      decision: "approved",
      publishError: "Couldn't write to GitHub: gh: the board said no",
    });

    expect(screen.getByText("Created")).toBeInTheDocument();
    expect(screen.getByText("Couldn't write to GitHub: gh: the board said no")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Retry" }));

    expect(api.retryPublish).toHaveBeenCalledWith("discussion-1", "draft-1");
  });

  it("says it is publishing while the run carries the draft", () => {
    card({ decision: "approved", publishing: true }, { status: "publishing" });

    expect(screen.getByText("Publishing…")).toBeInTheDocument();
  });

  it("does not say publishing for an approved epic nobody asked to publish", () => {
    card({ kind: "epic", decision: "approved", publishing: false }, { status: "publishing" });

    expect(screen.queryByText("Publishing…")).not.toBeInTheDocument();
  });

  it("says what the draft waits for", () => {
    card({ waits: "Invoices", decision: "approved" });

    expect(screen.getByText("Waits for Invoices")).toBeInTheDocument();
  });

  it("carries the warnings of a draft", () => {
    card({ warnings: ["The body has no acceptance criteria."] });

    expect(screen.getByText("The body has no acceptance criteria.")).toBeInTheDocument();
  });

  it("changes nothing once the publication started", () => {
    card({
      outcome: "created",
      number: 31,
      url: "https://github.com/dev/web/issues/31",
      published: true,
      publishedAt: "2026-09-17T12:00:00Z",
      decision: "approved",
    });

    expect(screen.getByText("Created")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "dev/web#31" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Approve" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Title")).not.toBeInTheDocument();
    expect(screen.getByText(/^Published /)).toBeInTheDocument();
  });

  it("reads two spellings of the same epic as one", () => {
    card({
      kind: "update",
      epic: makeDraftRef({
        draft: "",
        key: "dev/web#3",
        reference: "Dev/Web#3",
        title: "Invoices",
      }),
      current: makeCurrent({
        epic: makeDraftRef({
          draft: "",
          key: "dev/web#3",
          reference: "dev/web#3",
          title: "Invoices",
        }),
      }),
    });

    expect(screen.queryByText(/^Current: /)).not.toBeInTheDocument();
  });

  it("writes the title the user leaves", async () => {
    const { user } = card();

    const input = screen.getByLabelText("Title");
    await user.clear(input);
    await user.type(input, "Export everything");
    await user.tab();

    expect(api.setDraftText).toHaveBeenCalledWith(
      "discussion-1",
      "draft-1",
      "Export everything",
      "A button that exports the list.",
    );
  });

  it("keeps the other text as the Go side has it now", async () => {
    const draft = makeDraft();
    const discussion = makeDiscussion({ drafts: [draft] });
    const { user } = renderWithStore(<DraftCard discussion={discussion} draft={draft} />, {
      state: makeState({ discussions: [discussion] }),
    });
    // The title was recorded a moment ago and the card has not been rendered
    // with it yet: the save of the body carries the title that stands now.
    useAppStore.setState({
      app: makeState({
        discussions: [makeDiscussion({ drafts: [makeDraft({ title: "Export everything" })] })],
      }),
    });

    const body = screen.getByLabelText("Body");
    await user.clear(body);
    await user.type(body, "A button.");
    await user.tab();

    expect(api.setDraftText).toHaveBeenCalledWith(
      "discussion-1",
      "draft-1",
      "Export everything",
      "A button.",
    );
  });

  it("leaves an epic without a module or dependencies", () => {
    card({ kind: "epic", title: "Invoices", epic: makeDraftRef() });

    expect(screen.queryByText("Module")).not.toBeInTheDocument();
    expect(screen.queryByText("Dependencies")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Repository: dev/web" })).toBeInTheDocument();
  });
});
