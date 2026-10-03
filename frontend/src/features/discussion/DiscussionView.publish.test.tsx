import { act, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { bootstrap } from "@/app/bootstrap";
import { DiscussionView } from "@/features/discussion/DiscussionView";
import { api, type DiscussionSummary, type Draft, type Entry, type MarkerEntry } from "@/lib/wails";
import { useAppStore } from "@/store/app-store";
import { renderWithStore } from "@/test/render";
import {
  emitState,
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
const EPIC = makeDraftRef({ draft: "d1", title: "Pricing tiers with metered overage" });
const NO_HOLD = { reason: "", title: "", left: 0, approved: 0, cards: 0 };
const WAITS_FOR_EPIC = { ...NO_HOLD, reason: "epic" };
const FAILURE = "gh can't write to this repository. Run gh auth refresh -s repo.";

// at is a time of 2026-09-24, the day of the scenes, in the local zone the screen reads it in.
const at = (time: string) => new Date(`2026-09-24T${time}:00`).toISOString();

function published(draft: Draft, number: number, time: string): Draft {
  return {
    ...draft,
    outcome: draft.kind === "update" ? "updated" : "created",
    number,
    url: `https://github.com/${draft.repository}/issues/${number}`,
    published: true,
    publishedAt: at(time),
    publishing: false,
    hold: NO_HOLD,
  };
}

// before is round 1 of the scene publish: the update of #461 published at 14:29, the epic and two of
// its cards approved, waiting for the last card, which approving publishes with them.
function before(): Draft[] {
  return [
    makeDraft({
      id: "d1",
      kind: "epic",
      position: 0,
      title: "Pricing tiers with metered overage",
      ...BILLING,
      decision: "approved",
      hold: { ...NO_HOLD, reason: "cards", left: 1, cards: 3 },
    }),
    makeDraft({
      id: "d2",
      position: 1,
      title: "Tier limits and overage prices",
      ...BILLING,
      module: "Billing",
      epic: EPIC,
      decision: "approved",
      hold: WAITS_FOR_EPIC,
    }),
    makeDraft({
      id: "d3",
      position: 2,
      title: "Overage on the monthly invoice",
      ...BILLING,
      module: "Billing",
      epic: EPIC,
      decision: "approved",
      hold: WAITS_FOR_EPIC,
    }),
    makeDraft({
      id: "d4",
      position: 3,
      title: "Plan picker with tiers and overage",
      repository: "acme/web",
      repositoryId: "repo-web",
      module: "Web app",
      epic: EPIC,
      approvePublishes: ["d1", "d2", "d3", "d4"],
    }),
    published(
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
        decision: "approved",
      }),
      461,
      "14:29",
    ),
  ];
}

// approved is the round as approving draft 4 left it: everything approved, nothing held.
function approved(): Draft[] {
  return before().map((draft) =>
    draft.published
      ? draft
      : { ...draft, decision: "approved", hold: NO_HOLD, approvePublishes: [] },
  );
}

// raced changes the drafts of the round by id.
function raced(drafts: Draft[], change: Record<string, (draft: Draft) => Draft>): Draft[] {
  return drafts.map((draft) => change[draft.id]?.(draft) ?? draft);
}

// inRace puts the drafts of the round that aren't on GitHub yet in the publication under way.
const inRace = (draft: Draft) => (draft.published ? draft : { ...draft, publishing: true });

// The moments of the race: the epic created at 15:10 with its cards on their way, then the two cards
// of billing created, then draft 4 created at 15:12.
const epicCreated = () =>
  raced(approved(), { d1: (draft) => published(draft, 478, "15:10") }).map(inRace);
const billingCreated = () =>
  raced(epicCreated(), {
    d2: (draft) => published(draft, 479, "15:11"),
    d3: (draft) => published(draft, 480, "15:11"),
  });
const allPublished = () =>
  raced(billingCreated(), { d4: (draft) => published(draft, 2302, "15:12") });

function situation(kind: string, group = "waiting") {
  return makeSituation({
    id: `s-${kind}`,
    taskId: "discussion-1",
    kind,
    group,
    place: PLACE,
    startedAt: at("15:10"),
  });
}

function discussionOf(overrides: Partial<DiscussionSummary>): DiscussionSummary {
  return makeDiscussion({
    title: "Usage-based pricing tiers",
    board: "Platform Roadmap",
    status: "deciding",
    round: 1,
    draftsRead: true,
    repositories: REPOSITORIES,
    moduleOptions: ["Billing", "Web app", "Gateway"],
    sessionStatus: "waiting",
    turnRunning: false,
    processRunning: false,
    situations: [situation("drafts")],
    ...overrides,
  });
}

const deciding = (drafts = before()) => discussionOf({ drafts });
const racing = (drafts: Draft[]) =>
  discussionOf({ status: "publishing", publishing: true, situations: [], drafts });
const archivable = () =>
  discussionOf({
    status: "ready_to_archive",
    drafts: allPublished(),
    situations: [situation("ready_to_archive", "closing")],
  });

function marker(fields: Partial<MarkerEntry>, time: string): Entry {
  const entry = makeEntry("marker", { createdAt: at(time) });
  return entry.marker === null ? entry : { ...entry, marker: { ...entry.marker, ...fields } };
}

// conversation is the talk of the scene: the start, the drafts written and their first publication.
function conversation(): Entry[] {
  return [
    marker({ type: "discussion_started", board: "Platform Roadmap" }, "14:02"),
    marker({ type: "drafts_written", round: 1, count: 5 }, "14:27"),
    marker({ type: "drafts_published", round: 1 }, "14:29"),
  ];
}

async function show(discussion: DiscussionSummary) {
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
          entries: conversation(),
          pending: [],
          buffered: [],
        },
      },
    },
  });
  await act(async () => {
    await bootstrap(useAppStore);
  });
  await screen.findByRole("group", { name: "Drafts of round 1" });
  return view;
}

// next delivers the state:changed of the discussion as the Go side sends it.
const next = (discussion: DiscussionSummary) =>
  act(() => emitState(makeState({ discussions: [discussion] })));

const draft = (number: number) =>
  screen.getByRole("group", { name: new RegExp(`^Draft ${number} of \\d+: `) });

const publication = () => screen.getByRole("article", { name: /^(Published|Publication) / });

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(`2026-09-24T15:10:00`));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("DiscussionView, publishing the drafts", () => {
  it("keeps the focus on the last card of the epic from Approve to Created", async () => {
    const { user } = await show(deciding());
    expect(publication()).toHaveAccessibleName(/^Published · round 1 · 1 so far/);

    act(() => draft(4).focus());
    expect(within(draft(4)).getByRole("button", { name: /^Approve/ })).toHaveAccessibleDescription(
      "Approve publishes the epic, Tier limits and overage prices, Overage on the monthly invoice and this card to GitHub now.",
    );
    await user.keyboard("a");
    expect(api.decideDraft).toHaveBeenCalledExactlyOnceWith("discussion-1", "d4", "approved");
    expect(draft(4)).toHaveFocus();

    next(deciding(approved()));
    expect(draft(4)).toHaveFocus();
    expect(draft(4)).toHaveTextContent("Approved · publishing next");

    next(racing(epicCreated()));
    expect(draft(4)).toHaveFocus();
    expect(within(draft(4)).getByRole("status")).toHaveTextContent("Publishing…");
    expect(publication()).toHaveAccessibleName(/^Published · round 1 · 2 so far/);

    next(racing(billingCreated()));
    expect(draft(4)).toHaveFocus();
    expect(publication()).toHaveAccessibleName(/^Published · round 1 · 4 so far/);

    vi.setSystemTime(new Date(`2026-09-24T15:12:30`));
    next(archivable());

    expect(draft(4)).toHaveFocus();
    expect(draft(4)).toHaveAttribute("aria-expanded", "true");
    expect(draft(4)).toHaveTextContent("Created web#2302 · 15:12");
    expect(within(draft(4)).getByText("To take it back, close web#2302 on GitHub.")).toBeVisible();
    expect(within(draft(4)).queryByRole("button", { name: /^Approve/ })).not.toBeInTheDocument();
    expect(publication()).toHaveAccessibleName(/^Published · round 1 · 4 created, 1 updated/);
  });

  it("keeps the focus on the draft approved with a click once its decision leaves", async () => {
    const { user } = await show(deciding());

    await user.click(within(draft(4)).getByRole("button", { name: /^Approve/ }));
    expect(api.decideDraft).toHaveBeenCalledExactlyOnceWith("discussion-1", "d4", "approved");

    next(deciding(approved()));
    next(racing(epicCreated()));
    next(racing(billingCreated()));
    next(archivable());

    expect(draft(4)).toHaveTextContent("Created web#2302");
    expect(draft(4)).toHaveFocus();
  });

  it("stops the publication with the reason on the draft, the marker and the bar", async () => {
    const { user } = await show(deciding());
    act(() => draft(4).focus());
    await user.keyboard("a");
    next(racing(epicCreated()));

    next(
      discussionOf({
        status: "publish_failed",
        situations: [situation("publish_failed", "error")],
        drafts: raced(epicCreated(), {
          d2: (draft) => published(draft, 479, "15:11"),
          d3: (draft) => ({ ...draft, publishing: false, publishError: FAILURE }),
          d4: (draft) => ({
            ...draft,
            publishing: false,
            hold: { ...NO_HOLD, reason: "draft", title: "Overage on the monthly invoice" },
          }),
        }),
      }),
    );

    expect(publication()).toHaveAccessibleName(
      /^Publication stopped · round 1 · 3 published · Overage on the monthly invoice failed/,
    );
    expect(draft(3)).toHaveAccessibleName(/Couldn't write to GitHub, open it to Retry\.$/);
    expect(draft(4)).toHaveTextContent("Approved · waits for Overage on the monthly invoice");
    const bar = screen.getByRole("region", { name: "Request" });
    expect(within(bar).getByRole("status")).toHaveTextContent("Publish failed");

    await user.click(within(bar).getByRole("button", { name: "Show" }));

    expect(draft(3)).toHaveTextContent(FAILURE);
    await waitFor(() =>
      expect(within(draft(3)).getByRole("button", { name: "Retry" })).toHaveFocus(),
    );
  });

  it("says the state of an approved draft that waits for its turn in the race, not the reason", async () => {
    const { user } = await show(deciding(approved()));
    next(racing(raced(epicCreated(), { d4: (draft) => ({ ...draft, publishing: false }) })));

    await user.click(draft(4));

    const running = "A publication is running · the decision waits for it";
    expect(draft(4)).toHaveTextContent("Approved · publishing next");
    expect(within(draft(4)).getByText(running)).toHaveClass("sr-only");
    expect(within(draft(4)).getByRole("button", { name: /^Approve/ })).toHaveAccessibleDescription(
      running,
    );
  });

  it("dashes the decision of the drafts outside a running publication, with the reason", async () => {
    const loose = makeDraft({
      id: "d6",
      position: 5,
      title: "Support view of a workspace's metered usage",
      repository: "acme/web",
      repositoryId: "repo-web",
      module: "Web app",
      approvePublishes: ["d6"],
    });
    const { user } = await show(deciding([...before(), loose]));
    act(() => draft(4).focus());
    await user.keyboard("a");

    next(racing([...epicCreated(), loose]));

    const running = "A publication is running · the decision waits for it";
    // A draft in the race says where it stands in the place of the reason.
    await user.click(draft(3));
    expect(within(draft(3)).getByRole("status")).toHaveTextContent("Publishing…");

    await user.click(draft(6));
    const approve = within(draft(6)).getByRole("button", { name: /^Approve/ });
    const discard = within(draft(6)).getByRole("button", { name: /^Discard/ });
    expect(approve).toHaveAttribute("aria-disabled", "true");
    expect(discard).toHaveAttribute("aria-disabled", "true");
    expect(approve).toHaveAccessibleDescription(running);
    expect(discard).toHaveAccessibleDescription(running);
    expect(draft(6)).toHaveTextContent(running);

    vi.setSystemTime(new Date(`2026-09-24T15:11:00`));
    act(() => draft(6).focus());
    await user.keyboard("a");
    await user.click(approve);
    expect(api.decideDraft).toHaveBeenCalledTimes(1);
  });
});
