import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useGlobalShortcuts } from "@/app/useGlobalShortcuts";
import { DiscussionView } from "@/features/discussion/DiscussionView";
import { NewDiscussionDialog } from "@/features/discussion/NewDiscussionDialog";
import { api, type DiscussionSummary, type Draft, type Entry, type MarkerEntry } from "@/lib/wails";
import { type PanelId, useAppStore } from "@/store/app-store";
import { renderWithStore } from "@/test/render";
import {
  makeBoard,
  makeBoardCard,
  makeDiscussion,
  makeDiscussionCard,
  makeDraft,
  makeDraftRef,
  makeEntry,
  makeSituation,
  makeState,
} from "@/test/wails-mock";

const PLACE = { kind: "discussion", stage: "discussion", step: 0 };

const REPOSITORIES = [
  { id: "repo-billing", fullName: "acme/billing", cloned: true, missing: false },
  { id: "repo-web", fullName: "acme/web", cloned: true, missing: false },
  { id: "repo-gateway", fullName: "acme/gateway", cloned: true, missing: false },
];

const BILLING = { repository: "acme/billing", repositoryId: "repo-billing" };
const WEB = { repository: "acme/web", repositoryId: "repo-web" };
const EPIC = makeDraftRef({ draft: "d1", title: "Pricing tiers with metered overage" });
// WAITS is the epic that waits for the last of its cards to be decided.
const WAITS = { reason: "cards", title: "", left: 1, approved: 2, cards: 3 };

// round is round 1 of the material before the revision: the epic and its first card approved, the
// other two cards of the epic, the update of #461 and a loose card to decide. Only the update
// publishes on its own.
function round(): Draft[] {
  return [
    makeDraft({
      id: "d1",
      kind: "epic",
      position: 0,
      title: "Pricing tiers with metered overage",
      ...BILLING,
      decision: "approved",
      hold: WAITS,
    }),
    makeDraft({
      id: "d2",
      position: 1,
      title: "Tier limits and overage prices in the plans table",
      ...BILLING,
      module: "Billing",
      epic: EPIC,
      decision: "approved",
      hold: WAITS,
    }),
    makeDraft({
      id: "d3",
      position: 2,
      title: "Charge metered overage on the monthly invoice",
      ...BILLING,
      module: "Billing",
      epic: EPIC,
      approveHold: WAITS,
    }),
    makeDraft({
      id: "d4",
      position: 3,
      title: "Plan picker shows the tiers and the overage price",
      ...WEB,
      module: "Web app",
      epic: EPIC,
      approveHold: WAITS,
    }),
    makeDraft({
      id: "d5",
      kind: "update",
      position: 4,
      title: "Metering events per API key from the gateway",
      repository: "acme/gateway",
      repositoryId: "repo-gateway",
      module: "Gateway",
      card: makeDiscussionCard({
        key: "acme/gateway#461",
        repository: "acme/gateway",
        number: 461,
        title: "Metering events from the gateway",
        url: "https://github.com/acme/gateway/issues/461",
      }),
      approvePublishes: ["d5"],
    }),
    makeDraft({
      id: "d6",
      position: 5,
      title: "Support view of a workspace's metered usage",
      ...WEB,
      module: "Web app",
      approveHold: {
        reason: "draft",
        title: "Charge metered overage on the monthly invoice",
        left: 0,
        approved: 0,
        cards: 0,
      },
    }),
  ];
}

function marker(fields: Partial<MarkerEntry>): Entry {
  const entry = makeEntry("marker");
  return entry.marker === null ? entry : { ...entry, marker: { ...entry.marker, ...fields } };
}

// prompt is the message that opened the session: the context the discussion was given.
function prompt(): Entry {
  const entry = makeEntry("user");
  return entry.user === null
    ? entry
    : { ...entry, user: { ...entry.user, text: "## Board\n\nPlatform Roadmap", prompt: true } };
}

function said(text: string): Entry {
  const entry = makeEntry("assistant");
  return entry.assistant === null
    ? entry
    : { ...entry, assistant: { ...entry.assistant, text, messageId: `message-${entry.id}` } };
}

// conversation is the talk around the card: a speech before the drafts and one after them.
function conversation(): Entry[] {
  return [
    marker({
      type: "discussion_started",
      model: "claude-opus-5-5[1m]",
      effort: "high",
      board: "Platform Roadmap",
    }),
    prompt(),
    said("I read the cards and wrote the drafts."),
    marker({ type: "drafts_written", round: 1, count: 6 }),
    said("Approve them, or ask for changes."),
  ];
}

function discussionOf(overrides: Partial<DiscussionSummary> = {}): DiscussionSummary {
  return makeDiscussion({
    title: "Usage-based pricing tiers",
    board: "Platform Roadmap",
    cards: [
      makeDiscussionCard({
        key: "acme/billing#455",
        repository: "acme/billing",
        number: 455,
        title: "Usage-based pricing tiers",
      }),
      makeDiscussionCard({
        key: "acme/gateway#461",
        repository: "acme/gateway",
        number: 461,
        title: "Metering events from the gateway",
      }),
    ],
    status: "deciding",
    round: 1,
    drafts: round(),
    draftsRead: true,
    repositories: REPOSITORIES,
    moduleOptions: ["Billing", "Web app", "Gateway"],
    sessionStatus: "waiting",
    turnRunning: false,
    processRunning: false,
    situations: [
      makeSituation({ id: "s-drafts", taskId: "discussion-1", kind: "drafts", place: PLACE }),
    ],
    ...overrides,
  });
}

// Shell is the discussion screen with the shortcuts of the app and the dialog of a new discussion,
// which the app draws over every place.
function Shell() {
  useGlobalShortcuts();
  return (
    <>
      <DiscussionView discussionId="discussion-1" />
      <NewDiscussionDialog />
    </>
  );
}

function show(overrides: Partial<DiscussionSummary> = {}, panel: PanelId | null = null) {
  return renderWithStore(<Shell />, {
    state: makeState({
      discussions: [discussionOf(overrides)],
      boards: [
        makeBoard({
          id: "board-1",
          title: "Platform Roadmap",
          cards: [
            makeBoardCard({ key: "acme/api#474", repository: "acme/api", number: 474 }),
            makeBoardCard({
              key: "acme/api#470",
              repository: "acme/api",
              number: 470,
              title: "Overage email to the billing admins",
            }),
          ],
        }),
      ],
    }),
    ui: {
      location: { kind: "discussion", id: "discussion-1" },
      panel,
      transcripts: {
        "discussion-1|discussion": {
          status: "ready",
          error: "",
          entries: conversation(),
          pending: [],
          buffered: [],
        },
      },
    },
  });
}

const draft = (number: number) =>
  screen.getByRole("group", { name: new RegExp(`^Draft ${number} of \\d+: `) });

const speeches = () => screen.getAllByRole("article", { name: /^Discussion agent, / });

const composer = () => screen.getByRole("textbox", { name: "Reply to the agent" });

const focus = (element: HTMLElement) => act(() => element.focus());

afterEach(() => {
  vi.useRealTimers();
});

describe("DiscussionView, the decision keys", () => {
  it("decides with A a draft that publishes nothing and opens the next to decide", async () => {
    const { user } = show();
    await screen.findByRole("group", { name: "Drafts of round 1" });
    expect(draft(3)).toHaveAttribute("aria-expanded", "true");

    focus(draft(3));
    await user.keyboard("a");

    expect(api.decideDraft).toHaveBeenCalledExactlyOnceWith("discussion-1", "d3", "approved");
    expect(draft(4)).toHaveFocus();
    expect(draft(4)).toHaveAttribute("aria-expanded", "true");
    expect(draft(3)).toHaveAttribute("aria-expanded", "false");
  });

  it("leaves A and D inert for 900 ms after a decision, on the draft it opened", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-24T14:33:00"));
    const { user } = show();
    await screen.findByRole("group", { name: "Drafts of round 1" });

    focus(draft(3));
    await user.keyboard("d");
    expect(draft(4)).toHaveFocus();

    await user.keyboard("a");
    vi.advanceTimersByTime(899);
    await user.keyboard("d");
    expect(api.decideDraft).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(1);
    await user.keyboard("d");

    expect(api.decideDraft).toHaveBeenCalledTimes(2);
    expect(api.decideDraft).toHaveBeenLastCalledWith("discussion-1", "d4", "discarded");
    expect(draft(5)).toHaveFocus();
  });

  it("keeps the focus on a draft whose gesture line says Approve publishes", async () => {
    const { user } = show();
    await screen.findByRole("group", { name: "Drafts of round 1" });

    focus(draft(5));
    const approve = within(draft(5)).getByRole("button", { name: /^Approve/ });
    expect(approve).toHaveAccessibleDescription("Approve publishes this card to GitHub now.");
    await user.keyboard("a");

    expect(api.decideDraft).toHaveBeenCalledExactlyOnceWith("discussion-1", "d5", "approved");
    expect(draft(5)).toHaveFocus();
    expect(draft(5)).toHaveAttribute("aria-expanded", "true");
  });

  it("ignores the repeat of a key held down", async () => {
    show();
    await screen.findByRole("group", { name: "Drafts of round 1" });

    focus(draft(3));
    fireEvent.keyDown(draft(3), { key: "a", repeat: true });

    expect(api.decideDraft).not.toHaveBeenCalled();
    expect(draft(3)).toHaveFocus();
  });

  it("takes a double click on Approve as one decision", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-24T14:33:00"));
    const { user } = show();
    await screen.findByRole("group", { name: "Drafts of round 1" });

    focus(draft(5));
    await user.dblClick(within(draft(5)).getByRole("button", { name: /^Approve/ }));

    expect(api.decideDraft).toHaveBeenCalledExactlyOnceWith("discussion-1", "d5", "approved");
  });

  it("undoes the active decision with its key and stays on the draft", async () => {
    const { user } = show();
    await screen.findByRole("group", { name: "Drafts of round 1" });

    focus(draft(2));
    expect(within(draft(2)).getByRole("button", { name: /^Approve/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await user.keyboard("a");

    expect(api.decideDraft).toHaveBeenCalledExactlyOnceWith("discussion-1", "d2", "");
    expect(draft(2)).toHaveFocus();
    expect(draft(2)).toHaveAttribute("aria-expanded", "true");
  });
});

describe("DiscussionView, the edit keys", () => {
  it("edits with E, and gives the focus back to the draft with Esc and with Done", async () => {
    const { user } = show();
    await screen.findByRole("group", { name: "Drafts of round 1" });

    focus(draft(3));
    await user.keyboard("e");
    const title = screen.getByRole("textbox", { name: "Title" });
    expect(title).toHaveFocus();
    expect(title).toHaveValue("Charge metered overage on the monthly invoice");

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("textbox", { name: "Title" })).not.toBeInTheDocument();
    await waitFor(() => expect(draft(3)).toHaveFocus());

    await user.keyboard("e");
    await user.click(screen.getByRole("button", { name: "Done" }));
    expect(screen.queryByRole("textbox", { name: "Title" })).not.toBeInTheDocument();
    await waitFor(() => expect(draft(3)).toHaveFocus());
  });

  it("searches, walks and chooses in the listbox of the dependencies, and closes it with Esc", async () => {
    const { user } = show();
    await screen.findByRole("group", { name: "Drafts of round 1" });
    focus(draft(3));
    await user.keyboard("e");

    await user.click(screen.getByRole("button", { name: "Add a dependency" }));
    const list = screen.getByRole("listbox", { name: "Depend on" });
    const search = screen.getByRole("combobox", { name: "Search drafts and cards" });
    expect(search).toHaveFocus();
    await user.keyboard("overage");

    const active = () =>
      document.getElementById(search.getAttribute("aria-activedescendant") ?? "")?.textContent;
    expect(
      within(list)
        .getAllByRole("option")
        .map((option) => option.textContent),
    ).toEqual([
      "Tier limits and overage prices in the plans table acme/billing",
      "Plan picker shows the tiers and the overage price acme/web",
      "#470 Overage email to the billing admins",
    ]);
    expect(active()).toMatch(/^Tier limits/);
    await user.keyboard("{ArrowDown}{ArrowDown}");
    expect(active()).toMatch(/^#470/);
    await user.keyboard("{ArrowUp}");
    expect(active()).toMatch(/^Plan picker/);
    await user.keyboard("{Enter}");

    expect(api.addDraftDependency).toHaveBeenCalledExactlyOnceWith("discussion-1", "d3", "d4");

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("listbox", { name: "Depend on" })).not.toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Title" })).toBeInTheDocument();
  });
});

describe("DiscussionView, the arrows on the card", () => {
  it("opens the folded drafts with ↑, ↓ and Enter", async () => {
    const { user } = show();
    await screen.findByRole("group", { name: "Drafts of round 1" });

    focus(draft(3));
    await user.keyboard("{ArrowDown}");
    expect(draft(4)).toHaveFocus();
    expect(draft(4)).toHaveAttribute("aria-expanded", "true");
    expect(draft(3)).toHaveAttribute("aria-expanded", "false");

    await user.keyboard("{ArrowUp}{ArrowUp}");
    expect(draft(2)).toHaveFocus();
    expect(draft(2)).toHaveAttribute("aria-expanded", "true");

    expect(draft(6)).toHaveAttribute("aria-expanded", "false");
    fireEvent.keyDown(draft(6), { key: "Enter" });
    expect(draft(6)).toHaveFocus();
    expect(draft(6)).toHaveAttribute("aria-expanded", "true");
  });

  it("goes on along the conversation with ↑ on the first draft and ↓ on the last", async () => {
    const { user } = show();
    const card = await screen.findByRole("group", { name: "Drafts of round 1" });

    focus(draft(1));
    await user.keyboard("{ArrowUp}");
    expect(speeches()[0]).toHaveFocus();
    expect(card.contains(document.activeElement)).toBe(false);

    focus(draft(6));
    await user.keyboard("{ArrowDown}");
    expect(speeches()[1]).toHaveFocus();
  });

  it("goes on along the conversation with Home, End, Page Up and Page Down", async () => {
    const { user } = show();
    const card = await screen.findByRole("group", { name: "Drafts of round 1" });
    // The first stop of the conversation is the line of the context, which opens.
    const first = screen.getByRole("button", { name: /^Context · #455 and #461 · / });

    focus(draft(3));
    await user.keyboard("{End}");
    expect(speeches()[1]).toHaveFocus();

    focus(draft(3));
    await user.keyboard("{Home}");
    expect(first).toHaveFocus();

    focus(draft(3));
    await user.keyboard("{PageDown}");
    expect(speeches()[1]).toHaveFocus();

    focus(draft(3));
    await user.keyboard("{PageUp}");
    expect(first).toHaveFocus();
    expect(card.contains(document.activeElement)).toBe(false);
  });
});

describe("DiscussionView, Alt+↓ and Alt+↑", () => {
  it("goes to the next and the previous draft to decide from the composer", async () => {
    const { user } = show();
    await screen.findByRole("group", { name: "Drafts of round 1" });

    focus(composer());
    await user.keyboard("{Alt>}{ArrowDown}{/Alt}");
    expect(draft(4)).toHaveFocus();
    expect(draft(4)).toHaveAttribute("aria-expanded", "true");

    await user.keyboard("{Alt>}{ArrowUp}{/Alt}");
    expect(draft(3)).toHaveFocus();
  });

  it("goes round the drafts to decide from the header, past the decided ones", async () => {
    const { user } = show();
    await screen.findByRole("group", { name: "Drafts of round 1" });

    focus(screen.getByRole("button", { name: "Documents" }));
    await user.keyboard("{Alt>}{ArrowUp}{/Alt}");
    expect(draft(6)).toHaveFocus();

    await user.keyboard("{Alt>}{ArrowDown}{/Alt}");
    expect(draft(3)).toHaveFocus();
  });

  it("does nothing while a dialog is open", async () => {
    const { user } = show();
    await screen.findByRole("group", { name: "Drafts of round 1" });
    act(() => useAppStore.getState().openDiscussionDialog("discussion-1", "archive"));
    await screen.findByRole("alertdialog");

    await user.keyboard("{Alt>}{ArrowDown}{/Alt}");

    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(document.activeElement?.closest("[data-card-item]")).toBeNull();
  });
});

// ready is the round published, with the bar asking to archive.
const ready = (): Partial<DiscussionSummary> => ({
  status: "ready_to_archive",
  drafts: round().map((each, index) => ({
    ...each,
    decision: "approved",
    hold: { reason: "", title: "", left: 0, approved: 0, cards: 0 },
    outcome: each.kind === "update" ? "updated" : "created",
    number: 478 + index,
    url: `https://github.com/${each.repository}/issues/${478 + index}`,
    published: true,
    publishedAt: "2026-09-24T15:12:00Z",
  })),
  situations: [
    makeSituation({
      id: "s-ready",
      taskId: "discussion-1",
      kind: "ready_to_archive",
      group: "closing",
      place: PLACE,
    }),
  ],
});

describe("DiscussionView, Ctrl+Enter", () => {
  it("archives from the dialog of archiving", async () => {
    const { user } = show(ready());

    await user.click(screen.getByRole("button", { name: "Archive…" }));
    await screen.findByRole("alertdialog", { name: "Archive “Usage-based pricing tiers”?" });
    await user.keyboard("{Control>}{Enter}{/Control}");

    expect(api.archiveDiscussion).toHaveBeenCalledExactlyOnceWith("discussion-1");
  });

  it("groups from the dialog of grouping", async () => {
    const { user } = show();

    await user.click(screen.getByRole("button", { name: "More actions" }));
    await user.click(await screen.findByRole("menuitem", { name: "Group drafts into an epic…" }));
    const dialog = await screen.findByRole("dialog", { name: "Group drafts into an epic" });
    await user.type(
      within(dialog).getByRole("textbox", { name: "Title of the epic" }),
      "Metering for support",
    );
    await user.keyboard("{Control>}{Enter}{/Control}");

    expect(api.groupIntoEpic).toHaveBeenCalledExactlyOnceWith(
      "discussion-1",
      ["d5", "d6"],
      "Metering for support",
      expect.any(String),
    );
  });

  it("starts a discussion from the dialog of a new discussion", async () => {
    const { user } = show();
    act(() =>
      useAppStore
        .getState()
        .openNewDiscussion({ boardId: "board-1", cardKeys: [], askBoard: false }),
    );
    const dialog = await screen.findByRole("dialog", { name: "New discussion" });

    await user.type(within(dialog).getByRole("textbox", { name: "Title" }), "Usage alerts");
    await user.type(
      within(dialog).getByRole("textbox", { name: /^What to discuss/ }),
      "Alert at 80% of the tier",
    );
    await user.keyboard("{Control>}{Enter}{/Control}");

    await waitFor(() => expect(api.startDiscussion).toHaveBeenCalledOnce());
  });

  it("opens and confirms nothing from the conversation, the card or the composer", async () => {
    const { user } = show(ready());
    await screen.findByRole("group", { name: "Drafts of round 1" });

    for (const place of [speeches()[0], draft(3), composer()]) {
      focus(place as HTMLElement);
      await user.keyboard("{Control>}{Enter}{/Control}");
    }

    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(useAppStore.getState().discussionDialog).toBeNull();
    expect(api.archiveDiscussion).not.toHaveBeenCalled();
    expect(api.decideDraft).not.toHaveBeenCalled();
  });
});

describe("DiscussionView, the order of Esc", () => {
  it("closes the listbox, the field of Existing issue…, the edit and the panel, then takes the conversation to the composer", async () => {
    const { user } = show({}, "details");
    await screen.findByRole("group", { name: "Drafts of round 1" });
    const panel = () => screen.queryByRole("complementary", { name: "Details" });
    focus(draft(3));
    await user.keyboard("e");
    await user.click(
      screen.getByRole("button", { name: "Epic: Pricing tiers with metered overage" }),
    );
    await user.click(await screen.findByRole("menuitem", { name: /^Existing issue…/ }));
    expect(await screen.findByRole("textbox", { name: "Existing issue" })).toHaveFocus();
    await user.click(screen.getByRole("button", { name: "Add a dependency" }));
    expect(screen.getByRole("combobox", { name: "Search drafts and cards" })).toHaveFocus();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("listbox", { name: "Depend on" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add a dependency" })).toHaveFocus();
    expect(screen.getByRole("textbox", { name: "Existing issue" })).toBeInTheDocument();
    expect(panel()).toBeInTheDocument();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("textbox", { name: "Existing issue" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Epic: / })).toHaveFocus();
    expect(screen.getByRole("textbox", { name: "Title" })).toBeInTheDocument();
    expect(panel()).toBeInTheDocument();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("textbox", { name: "Title" })).not.toBeInTheDocument();
    await waitFor(() => expect(draft(3)).toHaveFocus());
    expect(panel()).toBeInTheDocument();

    await user.keyboard("{Escape}");
    expect(panel()).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Details" })).toHaveFocus();

    // The tooltip the button opened on its focus closes first: it would take the next Esc.
    focus(speeches()[1] as HTMLElement);
    await waitFor(() => expect(screen.queryByRole("tooltip")).not.toBeInTheDocument());
    await user.keyboard("{Escape}");
    expect(composer()).toHaveFocus();
  });

  it("closes the menu before the panel", async () => {
    const { user } = show({}, "details");

    await user.click(screen.getByRole("button", { name: "More actions" }));
    await screen.findByRole("menu");
    await user.keyboard("{Escape}");

    await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());
    expect(screen.getByRole("complementary", { name: "Details" })).toBeInTheDocument();
  });

  it("closes a menu of a dialog before the dialog", async () => {
    const { user } = show();
    act(() => useAppStore.getState().openDiscussionDialog("discussion-1", "group"));
    const dialog = await screen.findByRole("dialog", { name: "Group drafts into an epic" });

    await user.click(within(dialog).getByRole("button", { name: /^Repository of the epic/ }));
    await screen.findByRole("menu");
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());
    expect(dialog).toBeInTheDocument();

    await user.keyboard("{Escape}");
    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", { name: "Group drafts into an epic" }),
      ).not.toBeInTheDocument(),
    );
  });

  it("closes a dialog before the edit", async () => {
    const { user } = show();
    await screen.findByRole("group", { name: "Drafts of round 1" });
    focus(draft(3));
    await user.keyboard("e");
    act(() => useAppStore.getState().openDiscussionDialog("discussion-1", "archive"));
    const dialog = await screen.findByRole("alertdialog");
    await waitFor(() =>
      expect(within(dialog).getByRole("button", { name: "Cancel" })).toHaveFocus(),
    );

    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(screen.getByRole("textbox", { name: "Title" })).toBeInTheDocument();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("textbox", { name: "Title" })).not.toBeInTheDocument();
  });
});
