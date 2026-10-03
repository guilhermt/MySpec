import { act, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CardDraft } from "@/features/discussion/CardDraft";
import { cardEntries } from "@/features/discussion/drafts-card";
import { STALE_CARD_MS } from "@/lib/boards";
import { api, type DiscussionSummary, type Draft, type DraftCurrent } from "@/lib/wails";
import { renderWithStore } from "@/test/render";
import { makeDiscussion, makeDiscussionCard, makeDraft, makeState } from "@/test/wails-mock";

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

function update(overrides: Partial<Draft> = {}): Draft {
  return makeDraft({
    kind: "update",
    card: makeDiscussionCard({ key: "dev/web#12", number: 12 }),
    current: makeCurrent(),
    ...overrides,
  });
}

function draw(drafts: Draft[], overrides: Partial<DiscussionSummary> = {}) {
  const summary = makeDiscussion({ drafts, round: 1, ...overrides });
  const entry = cardEntries(summary)[0] as ReturnType<typeof cardEntries>[number];
  const element = (discussion: DiscussionSummary) => (
    <CardDraft
      discussion={discussion}
      entry={cardEntries(discussion).find((each) => each.draft.id === entry.draft.id) ?? entry}
      total={cardEntries(discussion).length}
      now={Date.now()}
      target={null}
      editing={false}
      decide={vi.fn()}
      onEdit={vi.fn()}
      onDone={vi.fn()}
    />
  );
  const view = renderWithStore(element(summary), { state: makeState({ discussions: [summary] }) });
  return { ...view, summary, redraw: (next: DiscussionSummary) => view.rerender(element(next)) };
}

const old = () => new Date(Date.now() - STALE_CARD_MS - 1000).toISOString();

beforeEach(() => {
  vi.clearAllMocks();
});

describe("CardDraft, the reading again of the card of an update", () => {
  it("reads the card again when its reading is old, once per revision", async () => {
    let finish = () => {};
    vi.mocked(api.refreshCard).mockImplementationOnce(
      () => new Promise<void>((resolve) => (finish = resolve)),
    );
    const draft = update({ current: makeCurrent({ readAt: old() }) });
    const { summary, redraw } = draw([draft]);

    expect(api.refreshCard).toHaveBeenCalledExactlyOnceWith("board-1", "dev/web#12");
    expect(screen.getByRole("status")).toHaveTextContent("Refreshing the card…");

    await act(async () => finish());
    expect(screen.queryByText("Refreshing the card…")).not.toBeInTheDocument();

    redraw({ ...summary });
    expect(api.refreshCard).toHaveBeenCalledTimes(1);

    redraw({ ...summary, drafts: [{ ...draft, revision: 2 }] });
    expect(api.refreshCard).toHaveBeenCalledTimes(2);
  });

  it("leaves a recent reading alone", () => {
    draw([update()]);

    expect(api.refreshCard).not.toHaveBeenCalled();
  });

  it("says the draft shows the last reading when the refresh fails", async () => {
    vi.mocked(api.refreshCard).mockRejectedValueOnce(new Error("gh is not authenticated."));
    draw([update({ current: makeCurrent({ readAt: old() }) })]);

    expect(
      await screen.findByText(
        "Couldn't refresh the card: gh is not authenticated. The draft shows the last reading.",
      ),
    ).toBeInTheDocument();
  });

  it("says when the card isn't in the last reading of the board", () => {
    draw([update({ current: null })]);

    expect(
      screen.getByText("This card isn't in the last reading of the board."),
    ).toBeInTheDocument();
    expect(api.refreshCard).not.toHaveBeenCalled();
  });
});

describe("CardDraft, Body and Changes", () => {
  it("reads the body of a card with no choice of reading", () => {
    draw([makeDraft({ body: "A button that exports the list." })]);

    expect(screen.getByText("A button that exports the list.")).toBeInTheDocument();
    expect(screen.queryByRole("radiogroup", { name: "What to read" })).not.toBeInTheDocument();
  });

  it("offers Changes on an update, with what it adds and takes away", async () => {
    const { user } = draw([
      update({
        body: "One\nThree\nFour\n",
        current: makeCurrent({ body: "One\nTwo\n" }),
      }),
    ]);

    const reading = screen.getByRole("radiogroup", { name: "What to read" });
    expect(within(reading).getByRole("radio", { name: /^Changes/ })).toHaveTextContent("+2 −1");

    await user.click(within(reading).getByRole("radio", { name: /^Changes/ }));

    const changes = screen.getByRole("group", { name: "Changes to the body" });
    expect(changes).toHaveTextContent("Two");
    expect(changes).toHaveTextContent("Four");
  });
});

describe("CardDraft, Retry", () => {
  const failed = () => makeDraft({ publishError: "Couldn't write to GitHub." });

  it("publishes the draft again, with Retrying… while it runs", async () => {
    let finish = () => {};
    vi.mocked(api.retryPublish).mockImplementationOnce(
      () => new Promise<void>((resolve) => (finish = resolve)),
    );
    const { user } = draw([failed()]);

    await user.click(screen.getByRole("button", { name: "Retry" }));

    expect(api.retryPublish).toHaveBeenCalledExactlyOnceWith("discussion-1", "draft-1");
    expect(await screen.findByRole("button", { name: "Retrying…" })).toBeInTheDocument();

    await act(async () => finish());
    await waitFor(() => expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument());
  });

  it("dashes Retry during a publication", () => {
    draw([failed()], { publishing: true });

    expect(screen.getByRole("button", { name: /^Retry/ })).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("button", { name: /^Retry/ })).toHaveAccessibleDescription(
      "A publication is running",
    );
  });
});

describe("CardDraft, the dependencies", () => {
  const dependency = (overrides: Record<string, unknown>) => ({
    draft: "",
    key: "",
    reference: "",
    title: "",
    url: "",
    linked: false,
    dropped: "",
    detail: "",
    ...overrides,
  });

  it("opens a draft of the round in the card and an issue on GitHub", async () => {
    const other = makeDraft({ id: "draft-2", position: 2, title: "Group the invoices" });
    const first = makeDraft({
      dependencies: [
        dependency({ draft: "draft-2", title: "Group the invoices" }),
        dependency({
          key: "dev/web#7",
          reference: "dev/web#7",
          title: "Rate limits",
          url: "https://github.com/dev/web/issues/7",
        }),
      ],
    });
    const { user } = draw([first, other]);
    // The card the first is in holds the other one.
    const target = document.createElement("div");
    target.setAttribute("data-decision-card", "");
    target.innerHTML = `<button data-card-item="draft-2"></button>`;
    document.body.append(target);

    await user.click(screen.getByRole("link", { name: "Group the invoices" }));
    expect(target.querySelector("button")).toHaveFocus();

    await user.click(screen.getByRole("link", { name: "Rate limits" }));
    expect(api.openExternal).toHaveBeenCalledExactlyOnceWith("https://github.com/dev/web/issues/7");
    target.remove();
  });

  it("says which dependencies the card has on GitHub beyond the draft", () => {
    draw([
      update({
        current: makeCurrent({
          dependencies: [
            dependency({ key: "dev/web#455", reference: "dev/web#455", title: "A" }),
          ] as DraftCurrent["dependencies"],
        }),
      }),
    ]);

    expect(screen.getByText("On GitHub: #455")).toBeInTheDocument();
  });
});
