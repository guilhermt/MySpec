import { screen, waitFor, within } from "@testing-library/react";
import type { UserEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DiscussionView } from "@/features/discussion/DiscussionView";
import { NewDiscussionDialog } from "@/features/discussion/NewDiscussionDialog";
import {
  api,
  type BoardCard,
  type DiscussionSummary,
  type Draft,
  type DraftCurrent,
  type DraftDependency,
  type Entry,
  type Repository,
  type Situation,
} from "@/lib/wails";
import type { TranscriptState } from "@/store/transcript";
import { type RenderWithStoreResult, renderWithStore, type StoreOptions } from "@/test/render";
import {
  makeBoard,
  makeBoardCard,
  makeDiscussion,
  makeDiscussionCard,
  makeDraft,
  makeDraftRef,
  makeEntry,
  makeRepository,
  makeSituation,
  makeState,
} from "@/test/wails-mock";

// The screen of a discussion: discussion-1 of the board Roadmap, in round 1, resting on the
// situation it waits on, with a session and its conversation read.

const PLACE = { kind: "discussion", stage: "discussion", step: 0 };

function situation(kind: string, group = "waiting"): Situation {
  return makeSituation({ id: `s-${kind}`, taskId: "discussion-1", kind, group, place: PLACE });
}

// atRest is a discussion in round 1 whose agent rests.
function atRest(overrides: Partial<DiscussionSummary> = {}): DiscussionSummary {
  return makeDiscussion({
    sessionStatus: "waiting",
    turnRunning: false,
    processRunning: false,
    round: 1,
    contextPercent: 44,
    ...overrides,
  });
}

// conversation is the conversation of the discussion holding the entries given.
function conversation(...entries: Entry[]): Record<string, TranscriptState> {
  return {
    "discussion-1|discussion": { status: "ready", error: "", entries, pending: [], buffered: [] },
  };
}

// USAGE_ALERTS is a card of the last reading of the board, which a draft can depend on.
const USAGE_ALERTS = makeBoardCard({ key: "dev/web#474", number: 474, title: "Usage alerts" });

function view(
  overrides: Partial<DiscussionSummary> = {},
  ui: NonNullable<StoreOptions["ui"]> = {},
  repositories: Repository[] = [makeRepository()],
): () => RenderWithStoreResult {
  return () => {
    const summary = atRest(overrides);
    return renderWithStore(<DiscussionView discussionId={summary.id} />, {
      state: makeState({
        repositories,
        boards: [makeBoard({ cards: [USAGE_ALERTS] })],
        discussions: [summary],
      }),
      ui: { location: { kind: "discussion", id: summary.id }, transcripts: conversation(), ...ui },
    });
  };
}

// marker is a marker of the conversation of the discussion, with the fields given.
function marker(fields: Partial<NonNullable<Entry["marker"]>>): Entry {
  const entry = makeEntry("marker");
  return entry.marker === null ? entry : { ...entry, marker: { ...entry.marker, ...fields } };
}

// hold is what keeps an approved draft out of the publication.
function hold(reason: string, more: Partial<Draft["hold"]> = {}): Draft["hold"] {
  return { reason, title: "", left: 0, approved: 0, cards: 0, ...more };
}

// dependency is a dependency of a draft, with the fields given.
function dependency(overrides: Partial<DraftDependency>): DraftDependency {
  return {
    draft: "",
    key: "",
    reference: "",
    title: "",
    url: "",
    linked: false,
    dropped: "",
    detail: "",
    ...overrides,
  };
}

// current is the card an update changes, as the last reading of the board has it, read just now.
function current(overrides: Partial<DraftCurrent> = {}): DraftCurrent {
  return {
    title: "Export the invoices",
    body: "A button that exports the list.\n",
    module: "",
    status: "",
    epic: null,
    dependencies: [],
    readAt: new Date().toISOString(),
    ...overrides,
  };
}

// DECIDING is a round of three cards, the first discarded: Beta is the first to decide, open.
const DECIDING = {
  status: "deciding",
  situations: [situation("drafts")],
  drafts: [
    makeDraft({ id: "d1", position: 1, title: "Alpha", decision: "discarded" }),
    makeDraft({ id: "d2", position: 2, title: "Beta" }),
    makeDraft({ id: "d3", position: 3, title: "Gamma" }),
  ],
};

const BETA = /^Draft 2 of 3: New card\. Beta\./;

// deciding is DECIDING with Beta, the open draft, changed as given.
function deciding(beta: Partial<Draft>): Partial<DiscussionSummary> {
  return {
    ...DECIDING,
    drafts: DECIDING.drafts.map((draft) => (draft.id === "d2" ? { ...draft, ...beta } : draft)),
  };
}

// WIRED is Beta with a dependency of each kind: a draft of the round, an issue linked on GitHub,
// one discarded and dropped, one GitHub refused; the warnings are the Go side's.
const WIRED = deciding({
  dependencies: [
    dependency({ draft: "d3", title: "Gamma" }),
    dependency({
      key: "dev/web#7",
      reference: "dev/web#7",
      title: "Rate limits",
      url: "https://github.com/dev/web/issues/7",
      linked: true,
    }),
    dependency({ key: "dev/web#8", reference: "dev/web#8", title: "Audit", dropped: "discarded" }),
  ],
  warnings: [
    "The dependency on Audit was discarded and dropped.",
    "Couldn't record the dependency on Billing export: HTTP 422",
  ],
});

// UPDATE is an update of web#12 whose title, module and epic differ from the card's, with the body
// it changes, the dependency the card has on GitHub, and the card read just now.
const UPDATE = makeDraft({
  id: "u1",
  kind: "update",
  title: "Export the invoices as CSV",
  body: "A button that exports the list.\nAs CSV.\n",
  card: makeDiscussionCard(),
  current: current({
    module: "Billing",
    epic: makeDraftRef({ draft: "", key: "dev/web#3", reference: "dev/web#3", title: "Billing" }),
    dependencies: [dependency({ key: "dev/web#455", reference: "dev/web#455", title: "Plans" })],
  }),
});

// UPDATING is a round of the one update, to decide.
const UPDATING = { status: "deciding", situations: [situation("drafts")], drafts: [UPDATE] };

// PUBLISHED is a card created on GitHub on September 16, folded with nothing left to decide.
const PUBLISHED = makeDraft({
  id: "p1",
  title: "Alpha",
  decision: "approved",
  published: true,
  outcome: "created",
  number: 41,
  url: "https://github.com/dev/web/issues/41",
  publishedAt: "2026-09-16T12:00:00Z",
});

// UPDATED is UPDATE published on September 16: web#12 changed on GitHub.
const UPDATED: Draft = {
  ...UPDATE,
  decision: "approved",
  published: true,
  outcome: "updated",
  url: "https://github.com/dev/web/issues/12",
  publishedAt: "2026-09-16T12:00:00Z",
};

// ARCHIVE is the discussion ready to archive, with the one card it created.
const ARCHIVE = {
  status: "ready_to_archive",
  situations: [situation("ready_to_archive", "closing")],
  drafts: [PUBLISHED],
};

// FAILED is a publication that stopped at its one draft, which keeps the discussion from the archive.
const FAILED = {
  status: "publish_failed",
  canArchive: false,
  archiveHint: "A publication failed: Retry it, or discard the draft.",
  situations: [situation("publish_failed", "error")],
  drafts: [
    makeDraft({
      id: "f1",
      title: "Overage on the monthly invoice",
      decision: "approved",
      publishError: "Couldn't write to GitHub: the token expired.",
    }),
  ],
};

// PUBLISHING is a publication running, Alpha in it, with Beta still to decide.
const PUBLISHING = {
  status: "publishing",
  publishing: true,
  drafts: [
    makeDraft({ id: "p1", position: 1, title: "Alpha", decision: "approved", publishing: true }),
    makeDraft({ id: "p2", position: 2, title: "Beta" }),
  ],
};

// UNREADABLE is the drafts file the agent wrote and MySpec can't read, before any good reading.
const UNREADABLE = {
  status: "awaiting_drafts",
  round: 0,
  unreadableDrafts: "Draft invoice-overage: it has no ### Title.",
  situations: [situation("reply")],
};

// EPIC is the epic Pricing tiers, as its cards point at it.
const EPIC = makeDraftRef({ draft: "e1", title: "Pricing tiers" });

// HELD is an epic to decide with a card approved that waits for it.
const HELD = {
  status: "deciding",
  situations: [situation("drafts")],
  drafts: [
    makeDraft({ id: "e1", kind: "epic", position: 0, title: "Pricing tiers" }),
    makeDraft({
      id: "c1",
      position: 1,
      title: "Tier limits",
      epic: EPIC,
      decision: "approved",
      hold: hold("epic"),
    }),
  ],
};

// SHORT is an epic approved with one approved card of two: it can't publish.
const SHORT = {
  status: "epic_cant_publish",
  situations: [situation("epic_cant_publish")],
  drafts: [
    makeDraft({
      id: "e1",
      kind: "epic",
      position: 0,
      title: "Pricing tiers",
      decision: "approved",
      hold: hold("epic_short", { approved: 1, cards: 2 }),
    }),
    makeDraft({
      id: "c1",
      position: 1,
      title: "Tier limits",
      epic: EPIC,
      decision: "approved",
      hold: hold("epic"),
    }),
    makeDraft({ id: "c2", position: 2, title: "Overage", epic: EPIC, decision: "discarded" }),
  ],
};

// DISCARDED is an epic discarded whose two approved cards won't publish.
const DISCARDED = {
  status: "epic_discarded",
  situations: [situation("epic_discarded")],
  drafts: [
    makeDraft({
      id: "e1",
      kind: "epic",
      position: 0,
      title: "Pricing tiers",
      decision: "discarded",
    }),
    makeDraft({
      id: "c1",
      position: 1,
      title: "Tier limits",
      epic: EPIC,
      decision: "approved",
      hold: hold("epic_discarded"),
    }),
    makeDraft({
      id: "c2",
      position: 2,
      title: "Overage",
      epic: EPIC,
      decision: "approved",
      hold: hold("epic_discarded"),
    }),
  ],
};

// EPIC_CREATED is an epic created on GitHub with its card, the discussion ready to archive.
const EPIC_CREATED = {
  ...ARCHIVE,
  drafts: [
    { ...PUBLISHED, id: "e1", kind: "epic", position: 0, title: "Pricing tiers", number: 478 },
    { ...PUBLISHED, id: "c1", position: 1, title: "Tier limits", epic: EPIC, number: 479 },
  ].map((draft) => ({ ...draft, url: `https://github.com/dev/web/issues/${draft.number}` })),
};

// The dialog that starts a discussion, over the board Roadmap and its card #12 read just now.

const LOGIN = makeBoardCard({ readAt: new Date().toISOString() });

function start(
  cards: BoardCard[] = [LOGIN],
  repositories: Repository[] = [makeRepository()],
): () => RenderWithStoreResult {
  return () =>
    renderWithStore(<NewDiscussionDialog />, {
      state: makeState({ repositories, boards: [makeBoard({ cards })] }),
      ui: {
        newDiscussion: {
          boardId: "board-1",
          cardKeys: cards.map((card) => card.key),
          askBoard: false,
        },
      },
    });
}

// stale is the card #12 read ten minutes ago, which the dialog reads again as it opens.
const stale = () => makeBoardCard({ readAt: new Date(Date.now() - 10 * 60_000).toISOString() });

// pending makes the next call of an api function wait forever, so the screen stays on its way.
function pending(call: (typeof api)[keyof typeof api]) {
  vi.mocked(call).mockReturnValueOnce(new Promise(() => {}) as never);
}

const click =
  (role: Parameters<typeof screen.getByRole>[0], name: string | RegExp) =>
  async (user: UserEvent) => {
    await user.click(await screen.findByRole(role, { name }));
  };

// then runs the steps in their order.
const then =
  (...steps: ((user: UserEvent) => Promise<void>)[]) =>
  async (user: UserEvent) => {
    for (const step of steps) {
      await step(user);
    }
  };

const moreActions = click("button", "More actions");
const openDetails = click("button", "Details");
const openDocuments = click("button", "Documents");
const edit = click("button", "Edit");

/** Place is where a control is now. */
type Place =
  | "header"
  | "menu"
  | "bar"
  | "card"
  | "marker"
  | "composer"
  | "tooltip"
  | "details"
  | "documents"
  | "dialog"
  | "alertdialog";

/** Row is a control of the components that left, in a state it appeared in, and where it is now. */
interface Row {
  origin:
    | "DiscussionHeader"
    | "DiscussionBar"
    | "DraftsPanel"
    | "EpicGroup"
    | "DraftCard"
    | "DependencyList"
    | "DraftDiff"
    | "DocumentsPanel"
    | "ArchiveDiscussionDialog"
    | "DeleteDiscussionDialog"
    | "NewDiscussionDialog"
    | "DiscussionContextPreview";
  control: string;
  state: string;
  /** draw renders the screen that holds the new place, in the state of the row. */
  draw: () => RenderWithStoreResult;
  /** steps is what the user does before the new place shows. */
  steps?: (user: UserEvent) => Promise<void>;
  where: Place;
  /** holder names what holds the control in the card, a draft or an epic, or a marker. */
  holder?: RegExp;
  role?: Parameters<typeof screen.getByRole>[0];
  /** name is the accessible name in the new place. */
  name?: RegExp;
  /** text is what the new place says, for a control that became words. */
  text?: RegExp;
  disabled?: boolean;
  /** description is the accessible description of the control: the reason under it. */
  description?: string;
  /** check proves the rest of the new place: what the control there holds. */
  check?: (place: HTMLElement) => void;
}

// placeOf is the element of the new place, once the steps are done.
async function placeOf(where: Place, holder: RegExp | undefined): Promise<HTMLElement> {
  switch (where) {
    case "header":
      return screen.getByRole("banner");
    case "menu":
      return screen.findByRole("menu");
    case "bar":
      return screen.getByRole("region", { name: "Request" });
    case "card":
      return screen.findByRole("group", { name: holder ?? /^Drafts of round \d+$/ });
    case "marker":
      return screen.findByRole("article", { name: holder ?? /^$/ });
    case "composer": {
      const composer = screen
        .getByRole("textbox", { name: "Reply to the agent" })
        .closest<HTMLElement>("[data-slot=composer]");
      expect(composer).not.toBeNull();
      return composer ?? document.body;
    }
    case "tooltip":
      return screen.findByRole("tooltip");
    case "details":
      return screen.getByRole("complementary", { name: "Details" });
    case "documents":
      return screen.getByRole("complementary", { name: "Documents" });
    case "dialog":
      return screen.findByRole("dialog");
    case "alertdialog":
      return screen.findByRole("alertdialog");
  }
}

const ROWS: Row[] = [
  // The header of the discussion.
  {
    origin: "DiscussionHeader",
    control: "the state",
    state: "discussing",
    draw: view({ status: "discussing", round: 0, sessionStatus: "working", turnRunning: true }),
    where: "header",
    role: "list",
    name: /^Progress · Discussing · Discussion agent working$/,
  },
  {
    origin: "DiscussionHeader",
    control: "the state",
    state: "waiting for the drafts",
    draw: view(UNREADABLE),
    where: "header",
    role: "list",
    name: /^Progress · Discussing · waiting for you: waiting for the drafts$/,
  },
  {
    origin: "DiscussionHeader",
    control: "the state",
    state: "deciding",
    draw: view(DECIDING),
    where: "header",
    role: "list",
    name: /^Progress · Round 1 · waiting for you: decide drafts$/,
  },
  {
    origin: "DiscussionHeader",
    control: "the state",
    state: "publishing",
    draw: view(PUBLISHING),
    where: "header",
    role: "list",
    name: /^Progress · Round 1 · publishing$/,
  },
  {
    origin: "DiscussionHeader",
    control: "the state",
    state: "publish failed",
    draw: view(FAILED),
    where: "header",
    role: "list",
    name: /^Progress · Round 1 · error: publish failed$/,
  },
  {
    origin: "DiscussionHeader",
    control: "the state",
    state: "an epic that can't publish",
    draw: view(SHORT),
    where: "header",
    role: "list",
    name: /^Progress · Round 1 · waiting for you: epic can't publish$/,
  },
  {
    origin: "DiscussionHeader",
    control: "the state",
    state: "an epic discarded",
    draw: view(DISCARDED),
    where: "header",
    role: "list",
    name: /^Progress · Round 1 · waiting for you: epic discarded$/,
  },
  {
    origin: "DiscussionHeader",
    control: "the state",
    state: "ready to archive",
    draw: view(ARCHIVE),
    where: "header",
    role: "list",
    name: /^Progress · Round 1 · ready to archive$/,
  },
  {
    origin: "DiscussionHeader",
    control: "the state",
    state: "paused",
    draw: view({ ...DECIDING, sessionStatus: "paused", pausedAt: new Date().toISOString() }),
    where: "header",
    role: "list",
    name: /^Progress · Round 1 · paused since \d\d:\d\d$/,
  },
  {
    origin: "DiscussionHeader",
    control: "the context gauge",
    state: "with a session",
    draw: view(),
    where: "header",
    role: "meter",
    name: /^Context$/,
  },
  {
    origin: "DiscussionHeader",
    control: "Pause",
    state: "the agent working",
    draw: view({ sessionStatus: "working", turnRunning: true }),
    where: "header",
    name: /^Pause$/,
  },
  {
    origin: "DiscussionHeader",
    control: "Pause",
    state: "the session stopped on an error",
    draw: view({ sessionStatus: "error", lastError: "claude exited" }),
    where: "header",
    name: /^Pause$/,
    disabled: true,
    description: "Nothing is running to pause: the session stopped with an error. Retry it.",
  },
  {
    origin: "DiscussionHeader",
    control: "Resume",
    state: "the session paused",
    draw: view({ sessionStatus: "paused", pausedAt: new Date().toISOString() }),
    where: "header",
    name: /^Resume$/,
  },
  {
    origin: "DiscussionHeader",
    control: "Documents",
    state: "any",
    draw: view(),
    where: "header",
    name: /^Documents$/,
  },
  {
    origin: "DiscussionHeader",
    control: "Documents",
    state: "any",
    draw: view(),
    steps: openDocuments,
    where: "documents",
    name: /^Context$/,
  },
  {
    origin: "DiscussionHeader",
    control: "Archive",
    state: "ready to archive",
    draw: view(ARCHIVE),
    steps: moreActions,
    where: "menu",
    role: "menuitem",
    name: /^Archive…$/,
  },
  {
    origin: "DiscussionHeader",
    control: "Archive",
    state: "ready to archive",
    draw: view(ARCHIVE),
    where: "bar",
    name: /^Archive…$/,
  },
  {
    origin: "DiscussionHeader",
    control: "Archive, with the reason in its tooltip",
    state: "a publication failed",
    draw: view(FAILED),
    steps: moreActions,
    where: "menu",
    role: "menuitem",
    name: /^Archive… · a publication failed: Retry it, or discard the draft$/,
    disabled: true,
  },
  {
    origin: "DiscussionHeader",
    control: "Delete discussion",
    state: "any",
    draw: view(DECIDING),
    steps: moreActions,
    where: "menu",
    role: "menuitem",
    name: /^Delete discussion…$/,
  },
  {
    origin: "DiscussionHeader",
    control: "Delete discussion",
    state: "publishing",
    draw: view(PUBLISHING),
    steps: moreActions,
    where: "menu",
    role: "menuitem",
    name: /^Delete discussion… · a publication is running$/,
    disabled: true,
  },

  // The bar of the discussion.
  {
    origin: "DiscussionBar",
    control: "the live state",
    state: "discussing",
    draw: view({ status: "discussing", round: 0, sessionStatus: "working", turnRunning: true }),
    where: "header",
    role: "list",
    name: /^Progress · Discussing · Discussion agent working$/,
    // Nothing waits on the user, so no bar says it.
    check: () => expect(screen.queryByRole("region", { name: "Request" })).toBeNull(),
  },
  {
    origin: "DiscussionBar",
    control: "the live state",
    state: "waiting for the drafts",
    draw: view(UNREADABLE),
    where: "bar",
    text: /Waiting for the drafts.*Discussing.*ask the agent to fix drafts\.md below/,
  },
  {
    origin: "DiscussionBar",
    control: "the live state",
    state: "deciding",
    draw: view(DECIDING),
    where: "bar",
    text: /Decide drafts.*round 1/,
    name: /^Next to decide$/,
  },
  {
    origin: "DiscussionBar",
    control: "the live state",
    state: "publishing",
    draw: view(PUBLISHING),
    where: "header",
    role: "list",
    name: /^Progress · Round 1 · publishing$/,
  },
  {
    origin: "DiscussionBar",
    control: "the live state",
    state: "publish failed",
    draw: view(FAILED),
    where: "bar",
    text: /Publish failed.*round 1.*Stopped at Overage on the monthly invoice/,
    name: /^Show$/,
  },
  {
    origin: "DiscussionBar",
    control: "the live state, with the way out",
    state: "an epic that can't publish",
    draw: view(SHORT),
    where: "bar",
    text: /Epic can't publish.*1 of 2 cards approved · approve one more, or discard the epic/,
    name: /^Show$/,
  },
  {
    origin: "DiscussionBar",
    control: "the live state, with the way out",
    state: "an epic discarded",
    draw: view(DISCARDED),
    where: "bar",
    text: /Epic discarded.*2 approved cards of it won't publish · approve the epic again, or discard them/,
    name: /^Show$/,
  },
  {
    origin: "DiscussionBar",
    control: "the live state",
    state: "ready to archive",
    draw: view(ARCHIVE),
    where: "bar",
    text: /Ready to archive.*1 published · or ask the agent for more cards below/,
  },
  {
    origin: "DiscussionBar",
    control: "the reason of the drafts that can't be read",
    state: "waiting for the drafts",
    draw: view(UNREADABLE, {
      transcripts: conversation(
        marker({
          type: "drafts_unreadable",
          reason: "Draft invoice-overage: it has no ### Title.",
        }),
      ),
    }),
    where: "marker",
    holder: /^drafts\.md can't be read/,
    text: /Draft invoice-overage: it has no ### Title\./,
  },
  {
    origin: "DiscussionBar",
    control: "the reason of the drafts that can't be read",
    state: "waiting for the drafts",
    draw: view(UNREADABLE),
    steps: click("button", "Ask to fix the drafts"),
    where: "composer",
    // The pill starts the message with the reason, for the agent to fix the file.
    check: (place) =>
      expect(within(place).getByRole<HTMLTextAreaElement>("textbox").value).toContain(
        "drafts.md can't be read: Draft invoice-overage: it has no ### Title.",
      ),
  },
  {
    origin: "DiscussionBar",
    control: "Publishing…",
    state: "publishing",
    draw: view(PUBLISHING),
    where: "card",
    holder: /^Draft 1 of 2: New card\. Alpha\./,
    text: /Publishing…/,
    check: (place) => expect(within(place).getByRole("status")).toHaveTextContent("Publishing…"),
  },

  // The panel of the drafts.
  {
    origin: "DraftsPanel",
    control: "N of M decided",
    state: "deciding",
    draw: view(DECIDING),
    where: "bar",
    text: /1 of 3 decided/,
  },
  {
    origin: "DraftsPanel",
    control: "N of M decided",
    state: "deciding",
    draw: view(DECIDING),
    steps: openDetails,
    where: "details",
    text: /Round 1 · 3 drafts · nothing published · 1 of 3 decided/,
  },
  {
    origin: "DraftsPanel",
    control: "Group into an epic",
    state: "two loose drafts",
    draw: view(DECIDING),
    steps: moreActions,
    where: "menu",
    role: "menuitem",
    name: /^Group drafts into an epic…$/,
  },
  {
    origin: "DraftsPanel",
    control: "Group into an epic",
    state: "one loose draft",
    draw: view(UPDATING),
    steps: moreActions,
    where: "menu",
    role: "menuitem",
    name: /^Group drafts into an epic… · needs two loose drafts not published$/,
    disabled: true,
  },
  {
    origin: "DraftsPanel",
    control: "the boxes of the grouping",
    state: "two loose drafts",
    draw: view(DECIDING),
    steps: then(moreActions, click("menuitem", "Group drafts into an epic…")),
    where: "dialog",
    role: "checkbox",
    name: /^Beta/,
    // The loose drafts not discarded are the ones offered, the first two checked.
    check: (place) => {
      expect(within(place).getByRole("checkbox", { name: /^Beta/ })).toBeChecked();
      expect(within(place).getByRole("checkbox", { name: /^Gamma/ })).toBeChecked();
      expect(within(place).queryByRole("checkbox", { name: /^Alpha/ })).toBeNull();
    },
  },
  {
    origin: "DraftsPanel",
    control: "the opening on a new reading",
    state: "the agent revised the drafts",
    draw: view(DECIDING, {
      transcripts: conversation(
        marker({ type: "drafts_written", round: 1, count: 3 }),
        makeEntry("assistant"),
        marker({ type: "drafts_revised", round: 1, changed: 1 }),
      ),
    }),
    where: "card",
    // The card comes after the latest reading, with the first draft to decide open.
    check: (place) => {
      const revised = screen.getByRole("article", { name: /^Drafts revised · round 1/ });
      expect(revised.compareDocumentPosition(place) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0);
      expect(within(place).getByRole("group", { name: BETA })).toHaveAttribute(
        "aria-expanded",
        "true",
      );
    },
  },

  // The group of an epic.
  {
    origin: "EpicGroup",
    control: "the epic and its cards",
    state: "an epic with a card",
    draw: view(HELD),
    where: "card",
    holder: /^Epic Pricing tiers and its 1 card$/,
    role: "group",
    name: /^Draft 2 of 2: New card\. Tier limits\./,
  },
  {
    origin: "EpicGroup",
    control: "Discarded",
    state: "an epic discarded",
    draw: view(DISCARDED),
    where: "card",
    holder: /^Draft 1 of 3: Epic\. Pricing tiers\./,
    text: /Discarded/,
    name: /^Discard$/,
    check: (place) =>
      expect(within(place).getByRole("button", { name: /^Discard$/ })).toHaveAttribute(
        "aria-pressed",
        "true",
      ),
  },
  {
    origin: "EpicGroup",
    control: "the link of the result",
    state: "an epic created",
    draw: view(EPIC_CREATED),
    steps: click("group", /^Draft 1 of 2: Epic\./),
    where: "card",
    holder: /^Draft 1 of 2: Epic\./,
    role: "link",
    name: /^web#478$/,
    text: /Created web#478 · Sep 16/,
  },

  // The card of a draft.
  {
    origin: "DraftCard",
    control: "the kind",
    state: "a new card",
    draw: view(DECIDING),
    where: "card",
    holder: BETA,
    text: /New card/,
  },
  {
    origin: "DraftCard",
    control: "the kind",
    state: "an epic",
    draw: view(HELD),
    where: "card",
    holder: /^Draft 1 of 2: Epic\. Pricing tiers\./,
    text: /Epic/,
  },
  {
    origin: "DraftCard",
    control: "the kind, with the link of the card",
    state: "an update",
    draw: view(UPDATING),
    where: "card",
    holder: /^Draft 1 of 1: Update\./,
    role: "link",
    name: /^web#12$/,
    text: /Update/,
  },
  {
    origin: "DraftCard",
    control: "the result, with its link and its date",
    state: "a card created",
    draw: view(ARCHIVE),
    steps: click("group", /^Draft 1 of 1: /),
    where: "card",
    holder: /^Draft 1 of 1: /,
    role: "link",
    name: /^web#41$/,
    text: /Created web#41 · Sep 16.*To take it back, close web#41 on GitHub\./,
  },
  {
    origin: "DraftCard",
    control: "the result, with its link and its date",
    state: "a card updated",
    draw: view({ ...ARCHIVE, drafts: [UPDATED] }),
    steps: click("group", /^Draft 1 of 1: /),
    where: "card",
    holder: /^Draft 1 of 1: /,
    role: "link",
    name: /^web#12$/,
    text: /Updated web#12 · Sep 16.*To take it back, edit web#12 on GitHub\./,
  },
  {
    origin: "DraftCard",
    control: "the reason of the failure, with Retry",
    state: "publish failed",
    draw: view(FAILED),
    where: "card",
    holder: /^Draft 1 of 1: /,
    text: /Couldn't write to GitHub: the token expired\./,
    name: /^Retry$/,
  },
  {
    origin: "DraftCard",
    control: "the reason of the failure, with Retry",
    state: "a publication running",
    draw: view({ ...FAILED, publishing: true }),
    where: "card",
    holder: /^Draft 1 of 1: /,
    text: /Couldn't write to GitHub: the token expired\./,
    name: /^Retry$/,
    disabled: true,
    description: "A publication is running",
  },
  {
    origin: "DraftCard",
    control: "Publishing…",
    state: "publishing",
    draw: view(PUBLISHING),
    steps: click("group", /^Draft 1 of 2: /),
    where: "card",
    holder: /^Draft 1 of 2: /,
    // Open, the draft in the race says so beside its decision, which waits for the race.
    check: (place) => {
      expect(place).toHaveAttribute("aria-expanded", "true");
      expect(within(place).getByRole("status")).toHaveTextContent("Publishing…");
      expect(within(place).getByRole("button", { name: /^Approve/ })).toHaveAttribute(
        "aria-disabled",
        "true",
      );
    },
  },
  {
    origin: "DraftCard",
    control: "what holds it",
    state: "approved, waiting for the epic",
    draw: view(HELD),
    where: "card",
    holder: /^Draft 2 of 2: New card\. Tier limits\. dev\/web\. Approved, waits for the epic\.$/,
    text: /Approved · waits for the epic/,
  },
  {
    origin: "DraftCard",
    control: "what holds it",
    state: "an epic without two approved cards",
    draw: view(SHORT),
    where: "card",
    holder: /^Draft 1 of 3: Epic\./,
    text: /Approved · the epic needs two approved cards · 1 of 2/,
  },
  {
    origin: "DraftCard",
    control: "Repository",
    state: "a card",
    draw: view(DECIDING),
    where: "card",
    holder: BETA,
    text: /dev\/web/,
  },
  {
    origin: "DraftCard",
    control: "Repository",
    state: "a card",
    draw: view(DECIDING),
    steps: edit,
    where: "card",
    holder: BETA,
    name: /^Repository: dev\/web$/,
  },
  {
    origin: "DraftCard",
    control: "Repository",
    state: "an update",
    draw: view(UPDATING),
    steps: edit,
    where: "card",
    holder: /^Draft 1 of 1: Update\./,
    text: /dev\/web · the card's repository/,
  },
  {
    origin: "DraftCard",
    control: "Module",
    state: "a card",
    draw: view(deciding({ module: "Billing" })),
    where: "card",
    holder: BETA,
    text: /dev\/web · Billing/,
  },
  {
    origin: "DraftCard",
    control: "Module",
    state: "a card",
    draw: view(DECIDING),
    steps: edit,
    where: "card",
    holder: BETA,
    name: /^Module: No module$/,
  },
  {
    origin: "DraftCard",
    control: "Epic",
    state: "a card",
    draw: view(DECIDING),
    steps: edit,
    where: "card",
    holder: BETA,
    name: /^Epic: No epic$/,
  },
  {
    origin: "DraftCard",
    control: "Epic, Existing issue…",
    state: "a card",
    draw: view(DECIDING),
    steps: then(
      edit,
      click("button", "Epic: No epic"),
      click("menuitem", "Existing issue…. Enter opens it."),
    ),
    where: "card",
    holder: BETA,
    role: "textbox",
    name: /^Existing issue$/,
  },
  {
    origin: "DraftCard",
    control: "Current: of an update, the title, the module and the epic",
    state: "an update",
    draw: view(UPDATING),
    where: "card",
    holder: /^Draft 1 of 1: Update\./,
    text: /Now: Export the invoices · Module now: Billing · Epic now: web#3 Billing/,
  },
  {
    origin: "DraftCard",
    control: "Title, saved as it is typed",
    state: "a card",
    draw: view(DECIDING),
    steps: edit,
    where: "card",
    holder: BETA,
    role: "textbox",
    name: /^Title$/,
    text: /Saved as you type\./,
  },
  {
    origin: "DraftCard",
    control: "Title, saved as it is typed",
    state: "a card",
    draw: view(DECIDING),
    steps: then(edit, async (user) => {
      await user.type(screen.getByRole("textbox", { name: "Title" }), " v2");
      await user.tab();
    }),
    where: "card",
    holder: BETA,
    check: () =>
      expect(api.setDraftText).toHaveBeenLastCalledWith(
        "discussion-1",
        "d2",
        "Beta v2",
        "A button that exports the list.",
      ),
  },
  {
    origin: "DraftCard",
    control: "Title, never empty",
    state: "a card",
    draw: view(DECIDING),
    steps: then(edit, async (user) => user.clear(screen.getByRole("textbox", { name: "Title" }))),
    where: "card",
    holder: BETA,
    text: /Write a title\./,
    check: (place) => {
      expect(within(place).getByRole("textbox", { name: "Title" })).toBeInvalid();
      expect(api.setDraftText).not.toHaveBeenCalled();
    },
  },
  {
    origin: "DraftCard",
    control: "Body, saved as it is typed",
    state: "a card",
    draw: view(DECIDING),
    steps: edit,
    where: "card",
    holder: BETA,
    role: "textbox",
    name: /^Body$/,
  },
  {
    origin: "DraftCard",
    control: "Body, saved as it is typed",
    state: "a card",
    draw: view(DECIDING),
    steps: then(edit, async (user) => {
      await user.type(screen.getByRole("textbox", { name: "Body" }), " As CSV.");
      await user.tab();
    }),
    where: "card",
    holder: BETA,
    check: () =>
      expect(api.setDraftText).toHaveBeenLastCalledWith(
        "discussion-1",
        "d2",
        "Beta",
        "A button that exports the list. As CSV.",
      ),
  },
  {
    origin: "DraftCard",
    control: "Body, never empty",
    state: "a card",
    draw: view(DECIDING),
    steps: then(edit, async (user) => user.clear(screen.getByRole("textbox", { name: "Body" }))),
    where: "card",
    holder: BETA,
    text: /Write the body\./,
    check: (place) => expect(within(place).getByRole("textbox", { name: "Body" })).toBeInvalid(),
  },
  {
    origin: "DraftCard",
    control: "Edit and Changes of an update",
    state: "an update",
    draw: view(UPDATING),
    where: "card",
    holder: /^Draft 1 of 1: Update\./,
    role: "radio",
    name: /^Changes/,
  },
  {
    origin: "DraftCard",
    control: "Edit and Changes of an update",
    state: "an update published",
    draw: view({ ...ARCHIVE, drafts: [UPDATED] }),
    steps: then(click("group", /^Draft 1 of 1: /), click("radio", /^Changes/)),
    where: "card",
    holder: /^Draft 1 of 1: /,
    role: "group",
    name: /^Changes to the body$/,
    text: /As CSV\./,
  },
  {
    origin: "DraftCard",
    control: "the toggled decision, which undoes",
    state: "a draft approved",
    draw: view(deciding({ decision: "approved", hold: hold("epic") })),
    steps: click("group", BETA),
    where: "card",
    holder: BETA,
    name: /^Approve$/,
    text: /click again to undo/,
    check: (place) =>
      expect(within(place).getByRole("button", { name: /^Approve$/ })).toHaveAttribute(
        "aria-pressed",
        "true",
      ),
  },
  {
    origin: "DraftCard",
    control: "the toggled decision, which undoes",
    state: "a draft approved, clicked again",
    draw: view(deciding({ decision: "approved", hold: hold("epic") })),
    steps: then(click("group", BETA), click("button", /^Approve$/)),
    where: "card",
    holder: BETA,
    check: () => expect(api.decideDraft).toHaveBeenCalledWith("discussion-1", "d2", ""),
  },
  {
    origin: "DraftCard",
    control: "Approve",
    state: "a draft to decide",
    draw: view(DECIDING),
    where: "card",
    holder: BETA,
    name: /^Approve$/,
  },
  {
    origin: "DraftCard",
    control: "Discard",
    state: "a draft to decide",
    draw: view(DECIDING),
    where: "card",
    holder: BETA,
    name: /^Discard$/,
  },
  {
    origin: "DraftCard",
    control: "This card isn't in the last reading of the board.",
    state: "an update whose card left the reading",
    draw: view({ ...UPDATING, drafts: [{ ...UPDATE, current: null }] }),
    where: "card",
    holder: /^Draft 1 of 1: Update\./,
    text: /This card isn't in the last reading of the board\./,
  },
  {
    origin: "DraftCard",
    control: "Refreshing the card…",
    state: "an update read long ago",
    draw: () => {
      pending(api.refreshCard);
      const old = current({ readAt: new Date(Date.now() - 10 * 60_000).toISOString() });
      return view({ ...UPDATING, drafts: [{ ...UPDATE, current: old }] })();
    },
    where: "card",
    holder: /^Draft 1 of 1: Update\./,
    check: (place) =>
      expect(within(place).getByRole("status")).toHaveTextContent("Refreshing the card…"),
  },
  {
    origin: "DraftCard",
    control: "the refresh that failed",
    state: "an update read long ago",
    draw: () => {
      vi.mocked(api.refreshCard).mockRejectedValueOnce(new Error("gh is not authenticated."));
      const old = current({ readAt: new Date(Date.now() - 10 * 60_000).toISOString() });
      return view({ ...UPDATING, drafts: [{ ...UPDATE, current: old }] })();
    },
    where: "card",
    holder: /^Draft 1 of 1: Update\./,
    text: /Couldn't refresh the card: gh is not authenticated\. The draft shows the last reading\./,
  },
  {
    origin: "DraftCard",
    control: "the warnings",
    state: "a draft with warnings",
    draw: view(deciding({ warnings: ["The module Ops is no longer an option of the board."] })),
    where: "card",
    holder: BETA,
    text: /The module Ops is no longer an option of the board\./,
  },
  {
    origin: "DraftCard",
    control: "the warnings",
    state: "a repository that left the board",
    draw: view(deciding({ repository: "dev/old", repositoryId: "" })),
    where: "card",
    holder: /^Draft 2 of 3: New card\. Beta\. dev\/old\./,
    text: /dev\/old is no longer managed by the board\./,
  },

  // The dependencies of a card.
  {
    origin: "DependencyList",
    control: "a dependency",
    state: "a draft of the round",
    draw: view(WIRED),
    where: "card",
    holder: BETA,
    role: "link",
    name: /^Gamma$/,
    text: /Depends on Gamma, Rate limits/,
  },
  {
    origin: "DependencyList",
    control: "Linked",
    state: "a dependency recorded on GitHub",
    draw: view(WIRED),
    steps: async (user) => user.hover(screen.getByRole("link", { name: "Rate limits" })),
    where: "tooltip",
    text: /^Linked on GitHub$/,
  },
  {
    origin: "DependencyList",
    control: "Dropped: discarded",
    state: "a dependency discarded",
    draw: view(WIRED),
    where: "card",
    holder: BETA,
    text: /The dependency on Audit was discarded and dropped\./,
    // The one that left is in the warning only.
    check: (place) => expect(within(place).queryByRole("link", { name: "Audit" })).toBeNull(),
  },
  {
    origin: "DependencyList",
    control: "Couldn't record: …",
    state: "a dependency GitHub refused",
    draw: view(WIRED),
    where: "card",
    holder: BETA,
    text: /Couldn't record the dependency on Billing export: HTTP 422/,
  },
  {
    origin: "DependencyList",
    control: "On GitHub",
    state: "an update whose card has dependencies",
    draw: view(UPDATING),
    where: "card",
    holder: /^Draft 1 of 1: Update\./,
    text: /On GitHub: #455/,
  },
  {
    origin: "DependencyList",
    control: "×",
    state: "a dependency of the draft",
    draw: view(WIRED),
    steps: edit,
    where: "card",
    holder: BETA,
    name: /^Remove the dependency on Gamma$/,
    // The one recorded on GitHub can't be taken out.
    check: (place) =>
      expect(
        within(place).queryByRole("button", { name: "Remove the dependency on Rate limits" }),
      ).toBeNull(),
  },
  {
    origin: "DependencyList",
    control: "the adding",
    state: "a draft of the round or a card of the board",
    draw: view(DECIDING),
    steps: then(edit, click("button", "Add a dependency")),
    where: "card",
    holder: BETA,
    role: "option",
    name: /#474 Usage alerts/,
    check: (place) =>
      expect(within(place).getByRole("option", { name: /^Gamma/ })).toBeInTheDocument(),
  },
  {
    origin: "DependencyList",
    control: "the adding",
    state: "owner/name#N",
    draw: view(DECIDING),
    steps: then(edit, click("button", "Add a dependency"), async (user) =>
      user.type(screen.getByRole("combobox"), "dev/api#99"),
    ),
    where: "card",
    holder: BETA,
    role: "option",
    name: /^Depend on dev\/api#99/,
  },

  // The change of the body of an update.
  {
    origin: "DraftDiff",
    control: "what the update adds and takes away",
    state: "an update",
    draw: view(UPDATING),
    steps: click("radio", /^Changes/),
    where: "card",
    holder: /^Draft 1 of 1: Update\./,
    role: "group",
    name: /^Changes to the body$/,
    text: /As CSV\./,
  },

  // The panel of the documents.
  {
    origin: "DocumentsPanel",
    control: "Context and Document",
    state: "before the document",
    draw: view(),
    steps: openDocuments,
    where: "documents",
    name: /^Context$/,
    text: /Document/,
    // The document the agent hasn't written yet is no choice.
    check: (place) => expect(within(place).queryByRole("button", { name: "Document" })).toBeNull(),
  },
  {
    origin: "DocumentsPanel",
    control: "Context and Document",
    state: "with the document",
    draw: view({ hasDocument: true, documentRevision: 1 }),
    steps: openDocuments,
    where: "documents",
    name: /^Document$/,
    check: (place) =>
      expect(within(place).getByRole("button", { name: "Document" })).toHaveAttribute(
        "aria-pressed",
        "true",
      ),
  },
  {
    origin: "DocumentsPanel",
    control: "Context and Document",
    state: "with the document",
    draw: view({ hasDocument: true, documentRevision: 1 }),
    steps: openDetails,
    where: "details",
    name: /^Document · discussion\.md$/,
  },
  {
    origin: "DocumentsPanel",
    control: "the skeleton",
    state: "a document being read",
    draw: () => {
      pending(api.readDiscussionArtifact);
      return view()();
    },
    steps: openDocuments,
    where: "documents",
    role: "status",
    name: /^Reading the document$/,
  },
  {
    origin: "DocumentsPanel",
    control: "the error of the reading",
    state: "a document that can't be read",
    draw: () => {
      vi.mocked(api.readDiscussionArtifact).mockRejectedValueOnce(new Error("The file is gone."));
      return view()();
    },
    steps: openDocuments,
    where: "documents",
    text: /Couldn't read the document.*The file is gone\./,
    name: /^Try again$/,
  },

  // The dialogs of the discussion.
  {
    origin: "ArchiveDiscussionDialog",
    control: "the dialog, with what History keeps",
    state: "ready to archive",
    draw: view(ARCHIVE),
    steps: click("button", "Archive…"),
    where: "alertdialog",
    name: /^Archive$/,
    text: /stay in History\..*Published: 1 issue in round 1: 1 created/,
  },
  {
    origin: "ArchiveDiscussionDialog",
    control: "the refusal",
    state: "a publication started meanwhile",
    draw: () => {
      vi.mocked(api.archiveDiscussion).mockRejectedValueOnce(
        new Error("A publication is running."),
      );
      return view(ARCHIVE)();
    },
    steps: then(click("button", "Archive…"), click("button", /^Archive/)),
    where: "alertdialog",
    text: /A publication is running\./,
  },
  {
    origin: "DeleteDiscussionDialog",
    control: "the dialog, with what stays on GitHub",
    state: "with a card published",
    draw: view(ARCHIVE),
    steps: then(moreActions, click("menuitem", "Delete discussion…")),
    where: "alertdialog",
    name: /^Delete discussion$/,
    text: /doesn't go to History\. What was published on GitHub stays: 1 issue\./,
  },
  {
    origin: "DeleteDiscussionDialog",
    control: "the refusal",
    state: "a publication started meanwhile",
    draw: () => {
      vi.mocked(api.deleteDiscussion).mockRejectedValueOnce(new Error("A publication is running."));
      return view(ARCHIVE)();
    },
    steps: then(
      moreActions,
      click("menuitem", "Delete discussion…"),
      click("button", "Delete discussion"),
    ),
    where: "alertdialog",
    text: /A publication is running\./,
  },

  // The dialog that starts a discussion.
  {
    origin: "NewDiscussionDialog",
    control: "the board",
    state: "from the board",
    draw: start(),
    where: "dialog",
    text: /Roadmap\s*dev · project 3 · web/,
  },
  {
    origin: "NewDiscussionDialog",
    control: "the board",
    state: "from the Home, with several boards",
    draw: () =>
      renderWithStore(<NewDiscussionDialog />, {
        state: makeState({
          boards: [makeBoard(), makeBoard({ id: "board-2", title: "Platform" })],
        }),
        ui: { newDiscussion: { boardId: "board-1", cardKeys: [], askBoard: true } },
      }),
    where: "dialog",
    name: /^Board: Roadmap$/,
  },
  {
    origin: "NewDiscussionDialog",
    control: "Title, with the count",
    state: "a long title",
    draw: start([{ ...LOGIN, title: "a".repeat(104) }]),
    where: "dialog",
    role: "textbox",
    name: /^Title/,
    text: /104 of 120/,
  },
  {
    origin: "NewDiscussionDialog",
    control: "Title, Use at most 120 characters.",
    state: "a title too long",
    draw: start([{ ...LOGIN, title: "a".repeat(130) }]),
    where: "dialog",
    name: /^Start discussion$/,
    disabled: true,
    description: "Use at most 120 characters.",
    check: (place) => expect(within(place).getByRole("textbox", { name: /^Title/ })).toBeInvalid(),
  },
  {
    origin: "NewDiscussionDialog",
    control: "What to discuss",
    state: "with a card",
    draw: start(),
    where: "dialog",
    role: "textbox",
    name: /^What to discuss/,
    text: /optional with cards/,
  },
  {
    origin: "NewDiscussionDialog",
    control: "What to discuss, with Ctrl+Enter",
    state: "with a card",
    draw: () => {
      pending(api.startDiscussion);
      return start()();
    },
    steps: async (user) => {
      await user.click(screen.getByRole("textbox", { name: /^What to discuss/ }));
      await user.keyboard("Break it into cards{Control>}{Enter}{/Control}");
    },
    where: "dialog",
    name: /^Starting…$/,
    check: () => expect(api.startDiscussion).toHaveBeenCalledOnce(),
  },
  {
    origin: "NewDiscussionDialog",
    control: "the cards, with ×",
    state: "with a card",
    draw: start(),
    where: "dialog",
    name: /^Remove #12 from the discussion$/,
  },
  {
    origin: "NewDiscussionDialog",
    control: "Model",
    state: "the default",
    draw: start(),
    where: "dialog",
    name: /^Discussion model: /,
    text: /From Defaults/,
  },
  {
    origin: "NewDiscussionDialog",
    control: "Repositories without a clone, Clone",
    state: "a repository without a clone",
    draw: start([LOGIN], [makeRepository({ cloned: false })]),
    where: "dialog",
    text: /dev\/web isn't cloned\.\s*The conversation reads the code of the cloned repositories only\./,
    name: /^Clone$/,
  },
  {
    origin: "NewDiscussionDialog",
    control: "Repositories without a clone, Clone",
    state: "a repository without a clone",
    draw: view(
      {
        repositories: [{ id: "repo-1", fullName: "dev/web", cloned: false, missing: false }],
      },
      {},
      [makeRepository({ cloned: false })],
    ),
    steps: openDetails,
    where: "details",
    text: /Not cloned/,
    name: /^Clone$/,
  },
  {
    origin: "NewDiscussionDialog",
    control: "Cloning…",
    state: "the clone running",
    draw: start([LOGIN], [makeRepository({ cloned: false, cloning: true })]),
    where: "dialog",
    check: (place) =>
      expect(within(place).getByRole("status")).toHaveTextContent("Cloning dev/web…"),
  },
  {
    origin: "NewDiscussionDialog",
    control: "Change path, with the warning of the clone that is missing",
    state: "the clone missing",
    draw: start([LOGIN], [makeRepository({ missing: true })]),
    where: "dialog",
    text: /The clone of dev\/web at \/home\/dev\/projects\/web is missing\./,
    name: /^Change path…$/,
  },
  {
    origin: "NewDiscussionDialog",
    control: "the error of the clone",
    state: "the clone failed",
    draw: start([LOGIN], [makeRepository({ cloned: false, cloneError: "gh: not found" })]),
    where: "dialog",
    text: /gh: not found/,
    name: /^Try the clone again$/,
  },
  {
    origin: "NewDiscussionDialog",
    control: "Start discussion, with the reason",
    state: "nothing to discuss",
    draw: start([]),
    where: "dialog",
    name: /^Start discussion$/,
    disabled: true,
    description: "Write what to discuss or select at least one card.",
  },
  {
    origin: "NewDiscussionDialog",
    control: "Starting…",
    state: "the discussion starting",
    draw: () => {
      pending(api.startDiscussion);
      return start()();
    },
    steps: click("button", "Start discussion"),
    where: "dialog",
    name: /^Starting…$/,
    text: /Starting the conversation…/,
  },
  {
    origin: "NewDiscussionDialog",
    control: "the error",
    state: "the session that didn't start",
    draw: () => {
      vi.mocked(api.startDiscussion).mockRejectedValueOnce(
        new Error("Claude Code isn't logged in. The discussion was undone."),
      );
      return start()();
    },
    steps: click("button", "Start discussion"),
    where: "dialog",
    text: /Claude Code isn't logged in\. The discussion was undone\./,
    name: /^Start discussion$/,
  },

  // The context of the dialog.
  {
    origin: "DiscussionContextPreview",
    control: "Context, read only",
    state: "with a card",
    draw: start(),
    steps: click("button", "Show"),
    where: "dialog",
    role: "region",
    name: /^The context of the discussion$/,
    text: /From the card: #12 · \d+ characters/,
  },
  {
    origin: "DiscussionContextPreview",
    control: "the reading again of the cards",
    state: "a card read long ago",
    draw: () => {
      pending(api.refreshCard);
      return start([stale()])();
    },
    where: "dialog",
    name: /^Show$/,
    disabled: true,
    description: "The cards are being read again.",
    check: (place) =>
      expect(within(place).getByRole("status")).toHaveTextContent("Refreshing the cards…"),
  },
  {
    origin: "DiscussionContextPreview",
    control: "the reading again of the cards",
    state: "a reading that failed",
    draw: () => {
      vi.mocked(api.refreshCard).mockRejectedValueOnce(new Error("GitHub rate limit reached."));
      return start([stale()])();
    },
    where: "dialog",
    text: /Couldn't refresh the cards: GitHub rate limit reached\. The discussion will use the last reading\./,
  },
];

describe("where the controls of the components that left went", () => {
  it.each(ROWS)(
    "$origin: $control, $state, is in the $where",
    async ({ draw, steps, where, holder, role, name, text, disabled, description, check }) => {
      const { user } = draw();
      await steps?.(user);
      const place = await placeOf(where, holder);

      if (text !== undefined) {
        await waitFor(() => expect(place).toHaveTextContent(text));
      }
      check?.(place);
      if (name === undefined) {
        return;
      }
      const [found] = await within(place).findAllByRole(role ?? "button", { name });
      expect(found).toBeDefined();
      if (disabled) {
        expect(found).toHaveAttribute("aria-disabled", "true");
      } else {
        expect(found).not.toHaveAttribute("aria-disabled", "true");
      }
      if (description !== undefined) {
        expect(found).toHaveAccessibleDescription(description);
      }
    },
  );
});

// ── The primaries ──────────────────────────────────────────────────────────────────────────────

// WRITTEN is a message written in the composer of the discussion, so Send could be a primary too.
const WRITTEN = { "discussion-1|discussion": "go on" };

/** Scene is a moment of the discussion screen, and the one primary it has with a message written. */
interface Scene {
  name: string;
  discussion: Partial<DiscussionSummary>;
  transcripts?: Record<string, TranscriptState>;
  /** primary is the one primary of the screen; null for none. */
  primary: RegExp | null;
}

// SEND is the primary of the composer, with a message written and nothing else asking.
const SEND = /^Send$/;

// The situations of the bar, and the moments without one: the screen draws one primary at most.
const BAR: Scene[] = [
  {
    name: "question",
    discussion: { situations: [situation("question")] },
    transcripts: conversation(makeEntry("question")),
    primary: /^Answer/,
  },
  {
    name: "permission",
    discussion: { situations: [situation("permission")] },
    transcripts: conversation(makeEntry("permission")),
    primary: /^Allow$/,
  },
  {
    name: "session_error, the session stopped",
    discussion: {
      sessionStatus: "error",
      lastError: "claude exited",
      situations: [situation("session_error", "error")],
    },
    primary: /^Retry$/,
  },
  {
    name: "session_error, a turn that failed",
    discussion: { turnFailed: true, situations: [situation("session_error", "error")] },
    primary: SEND,
  },
  {
    name: "reply, before the drafts",
    discussion: { round: 0, situations: [situation("reply")] },
    primary: SEND,
  },
  { name: "reply, the drafts that can't be read", discussion: UNREADABLE, primary: SEND },
  { name: "drafts", discussion: DECIDING, primary: SEND },
  { name: "epic_cant_publish", discussion: SHORT, primary: SEND },
  { name: "epic_discarded", discussion: DISCARDED, primary: SEND },
  { name: "publish_failed", discussion: FAILED, primary: /^Retry$/ },
  { name: "ready_to_archive", discussion: ARCHIVE, primary: /^Archive…$/ },
  { name: "paused, deciding", discussion: { ...DECIDING, sessionStatus: "paused" }, primary: SEND },
  {
    name: "paused, ready to archive",
    discussion: { ...ARCHIVE, sessionStatus: "paused" },
    primary: /^Archive…$/,
  },
  { name: "publishing, with no bar", discussion: PUBLISHING, primary: SEND },
  {
    name: "the agent working, with no bar",
    discussion: { status: "discussing", round: 0, sessionStatus: "working", turnRunning: true },
    primary: null,
  },
];

// The states of the card: each one with the open draft, Beta, in it.
const CARD: Scene[] = [
  { name: "not decided", discussion: DECIDING, primary: SEND },
  {
    name: "not decided, with a chain",
    discussion: deciding({ approvePublishes: ["d2", "d3"] }),
    primary: SEND,
  },
  {
    name: "approved, waiting",
    discussion: deciding({ decision: "approved", hold: hold("epic") }),
    primary: SEND,
  },
  {
    name: "approved, publishing next",
    discussion: deciding({ decision: "approved" }),
    primary: SEND,
  },
  {
    name: "revised, the approval cleared",
    discussion: deciding({ approvalCleared: true, revised: true }),
    primary: SEND,
  },
  { name: "publishing", discussion: PUBLISHING, primary: SEND },
  { name: "on GitHub", discussion: ARCHIVE, primary: /^Archive…$/ },
  { name: "failed", discussion: FAILED, primary: /^Retry$/ },
  {
    name: "failed, a publication running",
    discussion: { ...FAILED, publishing: true },
    primary: /^Retry$/,
  },
  { name: "discarded", discussion: deciding({ decision: "discarded" }), primary: SEND },
  {
    name: "blocked by its repository",
    discussion: deciding({ repository: "dev/old", repositoryId: "" }),
    primary: SEND,
  },
  { name: "untitled", discussion: deciding({ title: "" }), primary: SEND },
  { name: "an epic that can't publish", discussion: SHORT, primary: SEND },
  { name: "an update", discussion: UPDATING, primary: SEND },
];

// primaries are the primaries of the top layer: the dialog open, or else the whole screen.
function primaries(container: HTMLElement): HTMLElement[] {
  const layer = screen.queryByRole("dialog") ?? screen.queryByRole("alertdialog") ?? container;
  return [...layer.querySelectorAll<HTMLElement>("button[data-variant=primary]")];
}

// expectPrimary says the top layer has the one primary named, or none.
function expectPrimary(container: HTMLElement, primary: RegExp | null) {
  const found = primaries(container);
  expect(found.length).toBe(primary === null ? 0 : 1);
  if (primary !== null) {
    expect(found[0]).toHaveAccessibleName(primary);
  }
}

describe("the primary of the discussion screen", () => {
  it.each(BAR)(
    "is one at most in the bar of $name",
    async ({ discussion, transcripts, primary }) => {
      const { container } = view(discussion, {
        drafts: WRITTEN,
        ...(transcripts === undefined ? {} : { transcripts }),
      })();

      if (transcripts !== undefined) {
        await waitFor(() => expect(container.querySelector("[data-pending-card]")).not.toBeNull());
      }
      expectPrimary(container, primary);
    },
  );

  it.each(CARD)("is one at most with a draft $name", async ({ discussion, primary }) => {
    const { container } = view(discussion, { drafts: WRITTEN })();

    await screen.findByRole("group", { name: /^Drafts of round 1$/ });
    expectPrimary(container, primary);
  });

  it("is none with a draft in edit, and nothing written", async () => {
    const { user, container } = view(DECIDING)();

    await edit(user);

    expect(await screen.findByRole("textbox", { name: "Title" })).toBeInTheDocument();
    expectPrimary(container, null);
  });

  describe("with a dialog open, the top layer", () => {
    it("has Archive as the one primary of the archive, over the bar", async () => {
      const { user, container } = view(ARCHIVE, { drafts: WRITTEN })();
      await user.click(screen.getByRole("button", { name: "Archive…" }));

      await screen.findByRole("alertdialog");
      expectPrimary(container, /^Archive$/);
    });

    it("has no primary in the deletion, whose action is dangerous", async () => {
      const { user, container } = view(ARCHIVE, { drafts: WRITTEN })();
      await moreActions(user);
      await user.click(await screen.findByRole("menuitem", { name: "Delete discussion…" }));

      await screen.findByRole("alertdialog");
      expectPrimary(container, null);
    });

    it("has Group 2 drafts as the one primary of the grouping, dashed until the title", async () => {
      const { user, container } = view(DECIDING, { drafts: WRITTEN })();
      await moreActions(user);
      await user.click(await screen.findByRole("menuitem", { name: "Group drafts into an epic…" }));

      await screen.findByRole("dialog", { name: "Group drafts into an epic" });
      expectPrimary(container, /^Group 2 drafts$/);
      expect(screen.getByRole("button", { name: "Group 2 drafts" })).toHaveAttribute(
        "aria-disabled",
        "true",
      );
    });

    it.each<[string, () => RenderWithStoreResult]>([
      ["from the board", start()],
      [
        "from the Home, asking the board",
        () =>
          renderWithStore(<NewDiscussionDialog />, {
            state: makeState({ boards: [makeBoard(), makeBoard({ id: "board-2", title: "B" })] }),
            ui: { newDiscussion: { boardId: "board-1", cardKeys: [], askBoard: true } },
          }),
      ],
      [
        "over a board that left",
        () =>
          renderWithStore(<NewDiscussionDialog />, {
            state: makeState({ boards: [] }),
            ui: { newDiscussion: { boardId: "board-1", cardKeys: [], askBoard: false } },
          }),
      ],
    ])("has Start discussion as the one primary of the new discussion, %s", async (_name, draw) => {
      const { container } = draw();

      await screen.findByRole("dialog", { name: "New discussion" });
      expectPrimary(container, /^Start discussion$/);
    });

    it("keeps Starting… the one primary while the discussion starts", async () => {
      pending(api.startDiscussion);
      const { user, container } = start()();
      await user.click(screen.getByRole("button", { name: "Start discussion" }));

      await screen.findByRole("button", { name: "Starting…" });
      expectPrimary(container, /^Starting…$/);
    });
  });
});
