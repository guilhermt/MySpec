import { act, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { bootstrap } from "@/app/bootstrap";
import { DiscussionView } from "@/features/discussion/DiscussionView";
import { api, type DiscussionSummary, type Draft, type Entry, type MarkerEntry } from "@/lib/wails";
import { useAppStore } from "@/store/app-store";
import { renderWithStore } from "@/test/render";
import {
  emitState,
  emitTranscript,
  makeDiscussion,
  makeDiscussionCard,
  makeDraft,
  makeDraftRef,
  makeEntry,
  makeSituation,
  makeState,
} from "@/test/wails-mock";

const PLACE = { kind: "discussion", stage: "discussion", step: 0 };

const BILLING = { repository: "acme/billing", repositoryId: "repo-billing" };
const EPIC = makeDraftRef({ draft: "d1", title: "Pricing tiers with metered overage" });

// at is a time of 2026-09-24, the day of the scenes, in the local zone the screen reads it in.
const at = (time: string) => new Date(`2026-09-24T${time}:00`).toISOString();

function published(draft: Draft, number: number, time: string): Draft {
  return {
    ...draft,
    decision: "approved",
    outcome: draft.kind === "update" ? "updated" : "created",
    number,
    url: `https://github.com/${draft.repository}/issues/${number}`,
    published: true,
    publishedAt: at(time),
  };
}

// roundOne is round 1 of the material, all of it on GitHub: the epic with its three cards created
// and the update of #461.
function roundOne(): Draft[] {
  return [
    published(
      makeDraft({
        id: "d1",
        kind: "epic",
        position: 0,
        title: "Pricing tiers with metered overage",
        ...BILLING,
      }),
      478,
      "15:10",
    ),
    published(
      makeDraft({
        id: "d2",
        position: 1,
        title: "Tier limits and overage prices",
        ...BILLING,
        epic: EPIC,
      }),
      479,
      "15:11",
    ),
    published(
      makeDraft({
        id: "d3",
        position: 2,
        title: "Overage on the monthly invoice",
        ...BILLING,
        epic: EPIC,
      }),
      480,
      "15:11",
    ),
    published(
      makeDraft({
        id: "d4",
        position: 3,
        title: "Plan picker with tiers and overage",
        repository: "acme/web",
        repositoryId: "repo-web",
        epic: EPIC,
      }),
      2302,
      "15:12",
    ),
    published(
      makeDraft({
        id: "d5",
        kind: "update",
        position: 4,
        title: "Metering events per API key from the gateway",
        repository: "acme/gateway",
        repositoryId: "repo-gateway",
        card: makeDiscussionCard({
          key: "acme/gateway#461",
          repository: "acme/gateway",
          number: 461,
          title: "Metering events from the gateway",
        }),
      }),
      461,
      "14:29",
    ),
  ];
}

// roundTwo is the card the user asked for after the publication.
const roundTwo = (): Draft =>
  makeDraft({
    id: "r2-1",
    position: 5,
    round: 2,
    title: "Keep current customers on their plan for 90 days",
    ...BILLING,
    module: "Billing",
  });

function discussionOf(overrides: Partial<DiscussionSummary>): DiscussionSummary {
  return makeDiscussion({
    title: "Usage-based pricing tiers",
    board: "Platform Roadmap",
    round: 1,
    draftsRead: true,
    sessionStatus: "waiting",
    turnRunning: false,
    processRunning: false,
    ...overrides,
  });
}

const readyToArchive = () =>
  discussionOf({
    status: "ready_to_archive",
    drafts: roundOne(),
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

const decidingRoundTwo = () =>
  discussionOf({
    status: "deciding",
    round: 2,
    drafts: [...roundOne(), roundTwo()],
    situations: [
      makeSituation({ id: "s-drafts", taskId: "discussion-1", kind: "drafts", place: PLACE }),
    ],
  });

function marker(fields: Partial<MarkerEntry>, time: string): Entry {
  const entry = makeEntry("marker", { createdAt: at(time) });
  return entry.marker === null ? entry : { ...entry, marker: { ...entry.marker, ...fields } };
}

function said(text: string, time: string): Entry {
  const entry = makeEntry("assistant", { createdAt: at(time) });
  return entry.assistant === null
    ? entry
    : { ...entry, assistant: { ...entry.assistant, text, messageId: `message-${entry.id}` } };
}

async function show(discussion: DiscussionSummary, entries: Entry[]) {
  const state = makeState({ discussions: [discussion] });
  vi.mocked(api.getState).mockResolvedValue(state);
  const view = renderWithStore(<DiscussionView discussionId="discussion-1" />, {
    state,
    ui: {
      location: { kind: "discussion", id: "discussion-1" },
      transcripts: {
        "discussion-1|discussion": {
          status: "ready",
          error: "",
          entries,
          pending: [],
          buffered: [],
        },
      },
    },
  });
  await act(async () => {
    await bootstrap(useAppStore);
  });
  return view;
}

const feed = () => screen.getByRole("feed", { name: "Conversation with the discussion agent" });

const stepper = () => screen.getByRole("list", { name: /^Progress/ });

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-09-24T15:40:00"));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("DiscussionView, a new round", () => {
  // roundOneTalk is the conversation of round 1, revised once and published.
  const roundOneTalk = () => [
    marker({ type: "discussion_started", board: "Platform Roadmap" }, "14:02"),
    marker({ type: "drafts_written", round: 1, count: 5 }, "14:27"),
    marker({ type: "drafts_published", round: 1 }, "14:29"),
    marker({ type: "drafts_revised", round: 1, changed: 1 }, "14:32"),
    said("Tell me if the board needs another card.", "15:13"),
  ];

  it("folds round 1 into one line when a reading brings round 2, which opens its list with the links", async () => {
    const { user } = await show(readyToArchive(), roundOneTalk());
    expect(await screen.findByRole("group", { name: "Drafts of round 1" })).toBeInTheDocument();
    expect(stepper()).toHaveAccessibleName(/^Progress · Round 1 · /);

    act(() => {
      emitTranscript({
        taskId: "discussion-1",
        stage: "discussion",
        kind: "entry",
        entry: marker({ type: "drafts_written", round: 2, count: 1 }, "15:38"),
        entryId: "",
        text: "",
      });
      emitState(makeState({ discussions: [decidingRoundTwo()] }));
    });

    const round = within(feed()).getByRole("button", {
      name: /^Round 1 · 5 drafts, revised once · 4 created, 1 updated/,
    });
    expect(within(feed()).queryByRole("article", { name: /^Drafts written · round 1/ })).toBeNull();
    expect(within(feed()).queryByRole("article", { name: /^Drafts revised/ })).toBeNull();
    expect(within(feed()).queryByRole("article", { name: /^Published · round 1/ })).toBeNull();
    expect(screen.queryByRole("group", { name: "Drafts of round 1" })).not.toBeInTheDocument();

    await user.click(round);
    expect(round).toHaveAttribute("aria-expanded", "true");
    // Each state of the list is its own link: Created web#2302, the issue in the words.
    for (const link of ["billing#478", "billing#479", "billing#480", "web#2302", "gateway#461"]) {
      expect(
        within(feed()).getByRole("link", { name: new RegExp(`^${link}`) }),
      ).toBeInTheDocument();
    }
    expect(
      within(feed())
        .getByRole("link", { name: /^web#2302/ })
        .closest("li"),
    ).toHaveTextContent(/Created web#2302/);
    expect(within(feed()).queryByRole("button", { name: "web#2302" })).toBeNull();
    await user.click(within(feed()).getByRole("link", { name: /^web#2302/ }));
    expect(api.openExternal).toHaveBeenCalledWith("https://github.com/acme/web/issues/2302");
  });

  it("names round 2 in the pill and draws its card after Drafts written · round 2 · 1 draft", async () => {
    await show(readyToArchive(), roundOneTalk());

    act(() => {
      emitTranscript({
        taskId: "discussion-1",
        stage: "discussion",
        kind: "entry",
        entry: marker({ type: "drafts_written", round: 2, count: 1 }, "15:38"),
        entryId: "",
        text: "",
      });
      emitState(makeState({ discussions: [decidingRoundTwo()] }));
    });

    expect(stepper()).toHaveAccessibleName(/^Progress · Round 2 · /);
    const written = within(feed()).getByRole("article", {
      name: /^Drafts written · round 2 · 1 draft/,
    });
    const card = within(feed()).getByRole("group", { name: "Drafts of round 2" });
    expect(written.compareDocumentPosition(card) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(card).getByRole("heading")).toHaveTextContent("Round 2 · drafts1");
    expect(
      within(card).getByRole("group", {
        name: /^Draft 1 of 1: New card\. Keep current customers on their plan for 90 days\./,
      }),
    ).toHaveAttribute("aria-expanded", "true");
  });

  it("derives round 1 right before Drafts written · round 2 in a discussion from before its markers", async () => {
    await show(decidingRoundTwo(), [
      marker({ type: "discussion_started" }, "14:02"),
      said("The drafts are in drafts.md.", "14:27"),
      said("Here is one more card.", "15:38"),
      marker({ type: "drafts_written", round: 2, count: 1 }, "15:38"),
    ]);

    const names = within(feed())
      .getAllByRole("article")
      .map((article) => article.getAttribute("aria-label") ?? "");
    const written = names.findIndex((name) =>
      name.startsWith("Drafts written · round 2 · 1 draft"),
    );
    expect(written).toBeGreaterThan(0);
    // The derived round was never an event of the conversation: it carries no time.
    expect(names[written - 1]).toBe("Round 1 · 5 drafts · 4 created, 1 updated");
    expect(stepper()).toHaveAccessibleName(/^Progress · Round 2 · /);
    expect(screen.getByRole("group", { name: "Drafts of round 2" })).toBeInTheDocument();
  });
});
