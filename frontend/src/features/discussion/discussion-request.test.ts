import { describe, expect, it } from "vitest";
import {
  type DiscussionRequestModel,
  discussionAnnouncement,
  discussionComposerContext,
  discussionOtherPrimary,
  discussionRequestOf,
  discussionStarters,
} from "@/features/discussion/discussion-request";
import type { DiscussionSummary, Draft, Situation } from "@/lib/wails";
import { makeDiscussion, makeDraft, makeDraftRef, makeSituation } from "@/test/wails-mock";

const NOW = Date.parse("2026-09-24T15:00:00Z");
const SIX_MINUTES_AGO = new Date(NOW - 6 * 60_000).toISOString();
const PLACE = { kind: "discussion", stage: "discussion", step: 0 };

function situation(kind: string, group = "waiting", form = ""): Situation {
  return makeSituation({
    id: `s-${kind}`,
    taskId: "discussion-1",
    kind,
    group,
    form,
    place: PLACE,
    startedAt: SIX_MINUTES_AGO,
  });
}

const draftOf = (id: string, overrides: Partial<Draft> = {}) =>
  makeDraft({ id, title: `Title of ${id}`, position: Number(id.replace(/\D/g, "")), ...overrides });

// A discussion at rest in round 1, with the drafts given.
function discussion(
  drafts: Draft[],
  overrides: Partial<DiscussionSummary> = {},
): DiscussionSummary {
  return makeDiscussion({
    title: "Usage-based pricing tiers",
    sessionStatus: "waiting",
    turnRunning: false,
    processRunning: false,
    round: 1,
    drafts,
    ...overrides,
  });
}

const waiting = (
  found: Situation,
  drafts: Draft[] = [],
  overrides: Partial<DiscussionSummary> = {},
) => discussion(drafts, { situations: [found], ...overrides });

const WAIT = { short: "6m", long: "6 minutes", tone: "wait" } as const;
const ERROR = { short: "6m", long: "6 minutes", tone: "error" } as const;
const CLOSE = { short: "6m", long: "6 minutes", tone: "close" } as const;

const NEXT_TO_DECIDE = {
  action: "nextToDecide",
  label: "Next to decide",
  variant: "secondary",
  shortcut: "Alt ↓",
  tooltip: "The next draft to decide · Alt+↓",
  loadingLabel: "",
} as const;

const SHOW = { action: "show", label: "Show", variant: "secondary", loadingLabel: "" } as const;

const ARCHIVE = {
  action: "archive",
  label: "Archive…",
  variant: "primary",
  loadingLabel: "Archive…",
} as const;

const inEpic = (id: string): Partial<Draft> => ({ epic: makeDraftRef({ draft: id }) });

describe("discussionRequestOf, the situations of the drafts", () => {
  const five = [
    draftOf("d1", { decision: "approved" }),
    draftOf("d2", { decision: "discarded" }),
    draftOf("d3"),
    draftOf("d4"),
    draftOf("d5"),
  ];

  it("asks to decide the drafts of the current round, and goes to the first to decide", () => {
    expect(discussionRequestOf(waiting(situation("drafts"), five), NOW, null)).toEqual({
      form: "decision",
      glyph: "wait",
      label: "Decide drafts",
      place: "round 1",
      time: WAIT,
      progress: "2 of 5 decided",
      status: "Decide drafts · round 1",
      actions: [NEXT_TO_DECIDE],
      situationId: "s-drafts",
      focus: "draft",
      target: { draft: "d3", retry: false, approve: false },
    });
  });

  it("counts only the round it is in, and takes the first to decide in the order of the card", () => {
    const drafts = [
      draftOf("d1", { round: 1, decision: "approved", published: true, outcome: "created" }),
      draftOf("d2", { round: 2, position: 2 }),
      draftOf("d3", { round: 2, position: 1, decision: "approved" }),
    ];

    const bar = discussionRequestOf(waiting(situation("drafts"), drafts, { round: 2 }), NOW, null);

    expect(bar).toMatchObject({
      place: "round 2",
      progress: "1 of 2 decided",
      target: { draft: "d2", retry: false, approve: false },
    });
  });

  it("has no target when nothing is left to decide", () => {
    const bar = discussionRequestOf(
      waiting(situation("drafts"), [draftOf("d1", { decision: "approved" })]),
      NOW,
      null,
    );

    expect(bar?.target).toBeNull();
  });

  it("says the epic that can't publish, and goes to it", () => {
    const epic = draftOf("d1", {
      kind: "epic",
      decision: "approved",
      hold: { reason: "epic_short", title: "", left: 0, approved: 1, cards: 3 },
    });
    const card = draftOf("d2", { decision: "approved", ...inEpic("d1") });
    const bar = discussionRequestOf(
      waiting(situation("epic_cant_publish"), [card, epic]),
      NOW,
      null,
    );

    expect(bar).toEqual({
      form: "tinted",
      glyph: "wait",
      label: "Epic can't publish",
      place: "round 1",
      time: WAIT,
      progress: "1 of 3 cards approved · approve one more, or discard the epic",
      status: "Epic can't publish · round 1",
      actions: [{ ...SHOW, tooltip: "Go to the epic" }],
      situationId: "s-epic_cant_publish",
      focus: "draft",
      target: { draft: "d1", retry: false, approve: false },
    });
  });

  it("says the epic discarded, and goes to it", () => {
    const epic = draftOf("d1", { kind: "epic", decision: "discarded" });
    const cards = [
      draftOf("d2", {
        decision: "approved",
        hold: { reason: "epic_discarded", title: "", left: 0, approved: 0, cards: 0 },
        ...inEpic("d1"),
      }),
      draftOf("d3", {
        decision: "approved",
        hold: { reason: "epic_discarded", title: "", left: 0, approved: 0, cards: 0 },
        ...inEpic("d1"),
      }),
    ];
    const bar = discussionRequestOf(
      waiting(situation("epic_discarded"), [epic, ...cards]),
      NOW,
      null,
    );

    expect(bar).toEqual({
      form: "tinted",
      glyph: "wait",
      label: "Epic discarded",
      place: "round 1",
      time: WAIT,
      progress: "2 approved cards of it won't publish · approve the epic again, or discard them",
      status: "Epic discarded · round 1",
      actions: [SHOW],
      situationId: "s-epic_discarded",
      focus: "draft",
      target: { draft: "d1", retry: false, approve: true },
    });
  });

  it("goes to the epic discarded that holds an approved card, not the first discarded", () => {
    const quiet = draftOf("d1", { kind: "epic", decision: "discarded", position: 1 });
    const held = draftOf("d2", { kind: "epic", decision: "discarded", position: 2 });
    const card = draftOf("d3", {
      decision: "approved",
      hold: { reason: "epic_discarded", title: "", left: 0, approved: 0, cards: 0 },
      position: 3,
      ...inEpic("d2"),
    });
    const bar = discussionRequestOf(
      waiting(situation("epic_discarded"), [quiet, held, card]),
      NOW,
      null,
    );

    expect(bar?.target).toEqual({ draft: "d2", retry: false, approve: true });
  });

  it("says where the publication stopped, the first that failed in the order of the card, and goes to its Retry", () => {
    const drafts = [
      draftOf("d1", { decision: "approved", published: true, outcome: "created" }),
      draftOf("d3", { decision: "approved", publishError: "Couldn't set the epic.", position: 5 }),
      draftOf("d2", {
        title: "Overage on the monthly invoice",
        decision: "approved",
        publishError: "Rate limited.",
        position: 3,
      }),
    ];
    const bar = discussionRequestOf(
      waiting(situation("publish_failed", "error"), drafts),
      NOW,
      null,
    );

    expect(bar).toEqual({
      form: "error",
      glyph: "error",
      label: "Publish failed",
      place: "round 1",
      time: ERROR,
      progress: "Stopped at Overage on the monthly invoice",
      status: "Publish failed · round 1",
      actions: [
        {
          ...SHOW,
          tooltip: "Go to the draft where the publication stopped; Retry is there",
        },
      ],
      situationId: "s-publish_failed",
      focus: "draft",
      target: { draft: "d2", retry: true, approve: false },
    });
  });

  it.each<[string, Draft[], Partial<DiscussionSummary>, string]>([
    [
      "five published in one round",
      Array.from({ length: 5 }, (_, i) =>
        draftOf(`d${i + 1}`, { decision: "approved", published: true, outcome: "created" }),
      ),
      {},
      "5 published · or ask the agent for more cards below",
    ],
    [
      "seven published in three rounds",
      Array.from({ length: 7 }, (_, i) =>
        draftOf(`d${i + 1}`, {
          round: (i % 3) + 1,
          decision: "approved",
          published: true,
          outcome: "created",
        }),
      ),
      { round: 3 },
      "7 published in 3 rounds · or ask the agent for more cards below",
    ],
    [
      "everything discarded",
      [draftOf("d1", { decision: "discarded" })],
      {},
      "nothing published · or ask the agent for more cards below",
    ],
    [
      "everything discarded after rounds",
      [draftOf("d1", { round: 2, decision: "discarded" })],
      { round: 2 },
      "nothing published · or ask the agent for more cards below",
    ],
  ])("is ready to archive with %s", (_name, drafts, overrides, progress) => {
    const bar = discussionRequestOf(
      waiting(situation("ready_to_archive", "closing"), drafts, overrides),
      NOW,
      null,
    );

    expect(bar).toMatchObject({
      form: "closing",
      glyph: "close",
      label: "Ready to archive",
      progress,
      actions: [ARCHIVE],
      focus: "primary",
      time: CLOSE,
      target: null,
    });
  });
});

describe("discussionRequestOf, the situations of the conversation", () => {
  it.each<[string, DiscussionSummary, DiscussionRequestModel]>([
    [
      "a question",
      waiting(situation("question"), [draftOf("d1")]),
      {
        form: "quiet",
        glyph: "wait",
        label: "Question",
        place: "round 1",
        time: WAIT,
        progress: "2 questions",
        status: "Question · round 1",
        actions: [SHOW],
        situationId: "s-question",
        focus: "question",
        target: null,
      },
    ],
    [
      "a permission before the drafts",
      waiting(situation("permission"), [], { round: 0 }),
      {
        form: "quiet",
        glyph: "wait",
        label: "Permission",
        place: "Discussing",
        time: WAIT,
        status: "Permission · Discussing",
        actions: [SHOW],
        situationId: "s-permission",
        focus: "permission",
        target: null,
      },
    ],
    [
      "a session that stopped",
      waiting(situation("session_error", "error"), [], {
        round: 0,
        lastError: "claude exited with status 1",
      }),
      {
        form: "error",
        glyph: "error",
        label: "Session error",
        place: "Discussing",
        time: ERROR,
        status: "Session error · Discussing",
        actions: [
          {
            action: "retrySession",
            label: "Retry",
            variant: "primary",
            loadingLabel: "Retrying…",
            tooltip: "Opens the session again where it stopped",
            stage: "discussion",
          },
        ],
        situationId: "s-session_error",
        focus: "primary",
        target: null,
      },
    ],
    [
      "a turn that failed: the way is the composer",
      waiting(situation("session_error", "error"), [draftOf("d1")]),
      {
        form: "error",
        glyph: "error",
        label: "Session error",
        place: "round 1",
        time: ERROR,
        status: "Session error · round 1",
        actions: [],
        situationId: "s-session_error",
        focus: "composer",
        target: null,
      },
    ],
    [
      "the wait for the first reply",
      waiting(situation("reply"), [], { round: 0 }),
      {
        form: "tinted",
        glyph: "wait",
        label: "Waiting for reply",
        place: "Discussing",
        time: WAIT,
        status: "Waiting for reply · Discussing",
        actions: [],
        situationId: "s-reply",
        focus: "composer",
        target: null,
      },
    ],
    [
      "the drafts that can't be read",
      waiting(situation("reply"), [draftOf("d1")], {
        unreadableDrafts: "Draft invoice-overage: it has no ### Title.",
      }),
      {
        form: "tinted",
        glyph: "wait",
        label: "Waiting for the drafts",
        place: "round 1",
        time: WAIT,
        progress: "ask the agent to fix drafts.md below",
        progressTooltip: "ask the agent to fix drafts.md below",
        status: "Waiting for the drafts · round 1",
        actions: [],
        situationId: "s-reply",
        focus: "composer",
        target: null,
      },
    ],
    [
      "the drafts that can't be read before a good reading",
      waiting(situation("reply"), [], {
        round: 0,
        unreadableDrafts: "Draft invoice-overage: it has no ### Title.",
      }),
      {
        form: "tinted",
        glyph: "wait",
        label: "Waiting for the drafts",
        place: "Discussing",
        time: WAIT,
        progress: "ask the agent to fix drafts.md below",
        progressTooltip: "ask the agent to fix drafts.md below",
        status: "Waiting for the drafts · Discussing",
        actions: [],
        situationId: "s-reply",
        focus: "composer",
        target: null,
      },
    ],
  ])("draws %s", (_name, found, bar) => {
    expect(discussionRequestOf(found, NOW, { kind: "question", questions: 2 })).toEqual(bar);
  });
});

describe("discussionRequestOf, paused and at rest", () => {
  const five = [draftOf("d1", { decision: "approved" }), draftOf("d2")];

  it("draws the bar of the state, quiet, without a chip, while paused", () => {
    const paused = discussion(five, {
      status: "deciding",
      sessionStatus: "paused",
      situations: [situation("question")],
    });

    expect(discussionRequestOf(paused, NOW, null)).toEqual({
      form: "quiet",
      glyph: "paused",
      label: "Decide drafts",
      place: "round 1",
      progress: "1 of 2 decided",
      status: "Decide drafts · round 1",
      actions: [NEXT_TO_DECIDE],
      situationId: null,
      focus: "draft",
      target: { draft: "d2", retry: false, approve: false },
    });
  });

  const shortEpic = draftOf("d1", {
    kind: "epic",
    decision: "approved",
    hold: { reason: "epic_short", title: "", left: 0, approved: 1, cards: 3 },
  });
  const discardedEpic = [
    draftOf("d1", { kind: "epic", decision: "discarded" }),
    draftOf("d2", {
      decision: "approved",
      ...inEpic("d1"),
      hold: { reason: "epic_discarded", title: "", left: 0, approved: 0, cards: 0 },
    }),
  ];
  const failed = [draftOf("d1", { decision: "approved", publishError: "Couldn't set the epic." })];
  const published = [
    draftOf("d1", { decision: "approved", published: true, outcome: "created" }),
    draftOf("d2", { decision: "discarded" }),
  ];

  it.each<[string, Draft[], string, string, string]>([
    [
      "epic_cant_publish",
      [shortEpic, draftOf("d2")],
      "Epic can't publish",
      "1 of 3 cards approved · approve one more, or discard the epic",
      "Show",
    ],
    [
      "epic_discarded",
      discardedEpic,
      "Epic discarded",
      "1 approved card of it won't publish · approve the epic again, or discard it",
      "Show",
    ],
    ["publish_failed", failed, "Publish failed", "Stopped at Title of d1", "Show"],
    [
      "ready_to_archive",
      published,
      "Ready to archive",
      "1 published · or ask the agent for more cards below",
      "Archive…",
    ],
  ])("draws the state %s while paused", (status, drafts, label, progress, action) => {
    const bar = discussionRequestOf(
      discussion(drafts, { status, sessionStatus: "paused" }),
      NOW,
      null,
    );

    expect(bar).toMatchObject({
      form: "quiet",
      glyph: "paused",
      label,
      progress,
      situationId: null,
      target: action === "Show" ? { draft: "d1", retry: status === "publish_failed" } : null,
    });
    expect(bar?.actions.map((one) => one.label)).toEqual([action]);
    expect(bar?.time).toBeUndefined();
  });

  it.each<[string, Partial<DiscussionSummary>]>([
    ["paused while discussing", { status: "discussing", sessionStatus: "paused" }],
    ["paused waiting for the drafts", { status: "awaiting_drafts", sessionStatus: "paused" }],
    ["paused during a run", { status: "publishing", sessionStatus: "paused" }],
    ["at rest without a situation", { status: "discussing" }],
    ["publishing without a situation", { status: "publishing", publishing: true }],
    ["the agent working", { sessionStatus: "working" }],
  ])("draws nothing %s", (_name, overrides) => {
    expect(discussionRequestOf(discussion(five, overrides), NOW, null)).toBeNull();
  });
});

describe("discussionAnnouncement", () => {
  it.each<[string, DiscussionSummary, string]>([
    [
      "drafts to decide",
      waiting(situation("drafts"), [draftOf("d1")]),
      "Usage-based pricing tiers: waiting for you: decide drafts in round 1",
    ],
    [
      "a publication that failed",
      waiting(situation("publish_failed", "error"), [draftOf("d1", { publishError: "No." })]),
      "Usage-based pricing tiers: error: publish failed in round 1",
    ],
    [
      "a question before the drafts",
      waiting(situation("question"), [], { round: 0 }),
      "Usage-based pricing tiers: waiting for you: question",
    ],
  ])("says %s", (_name, found, text) => {
    const request = discussionRequestOf(found, NOW, null);

    expect(request).not.toBeNull();
    expect(request === null ? "" : discussionAnnouncement(found, request)).toBe(text);
  });
});

describe("discussionComposerContext", () => {
  const base = {
    findings: false,
    askForChange: false,
    reviseFindings: false,
    item: "discussion",
    who: "agent",
  };

  it.each<[string, DiscussionSummary, string | null]>([
    ["nothing before the drafts", discussion([], { round: 0 }), null],
    [
      "a file that can't be read",
      discussion([draftOf("d1")], { unreadableDrafts: "Draft x: it has no ### Title." }),
      "unreadable",
    ],
    [
      "the file that can't be read, before the changes",
      discussion([], { round: 0, unreadableDrafts: "Draft x: it has no ### Title." }),
      "unreadable",
    ],
    ["drafts to decide", discussion([draftOf("d1")]), "changes"],
    [
      "a draft approved and waiting",
      discussion([draftOf("d1", { decision: "approved" })]),
      "changes",
    ],
    [
      "drafts on GitHub and discarded, nothing more to change, ready to archive",
      discussion(
        [
          draftOf("d1", { published: true, outcome: "created", decision: "approved" }),
          draftOf("d2", { decision: "discarded" }),
        ],
        { status: "ready_to_archive" },
      ),
      "archive",
    ],
    [
      "everything decided but not ready to archive",
      discussion([draftOf("d1", { decision: "discarded" })], { status: "deciding" }),
      null,
    ],
  ])("is %s", (_name, found, drafts) => {
    expect(discussionComposerContext(found)).toEqual({ ...base, drafts });
  });

  it("asks only of the current round", () => {
    const found = discussion(
      [draftOf("d1", { round: 1 }), draftOf("d2", { round: 2, decision: "discarded" })],
      { round: 2, status: "ready_to_archive" },
    );

    expect(discussionComposerContext(found).drafts).toBe("archive");
  });
});

describe("discussionStarters", () => {
  it("offers to fix the drafts, with the reason in the text", () => {
    const found = discussion([draftOf("d1")], {
      unreadableDrafts: "Draft invoice-overage: it has no ### Title.",
    });

    expect(discussionStarters(found)).toEqual([
      {
        label: "Ask to fix the drafts",
        tooltip: "Starts the message: the agent rewrites drafts.md in the format MySpec reads",
        text: "drafts.md can't be read: Draft invoice-overage: it has no ### Title. Rewrite it in the format MySpec reads. ",
      },
    ]);
  });

  it("offers to ask for changes while a draft of the round isn't on GitHub or discarded", () => {
    expect(discussionStarters(discussion([draftOf("d1")]))).toEqual([
      {
        label: "Ask for changes",
        tooltip:
          "Starts the message: the agent revises the drafts and keeps your decisions on the ones it doesn't change",
        text: "Change the drafts: ",
      },
    ]);
  });

  it.each<[string, DiscussionSummary]>([
    ["before the drafts", discussion([], { round: 0 })],
    [
      "ready to archive",
      discussion([draftOf("d1", { decision: "discarded" })], { status: "ready_to_archive" }),
    ],
  ])("offers nothing %s", (_name, found) => {
    expect(discussionStarters(found)).toEqual([]);
  });

  it.each<[string, Partial<DiscussionSummary>]>([
    ["paused", { sessionStatus: "paused" }],
    ["with the session stopped on an error", { sessionStatus: "error" }],
    ["with the error the session stopped on", { lastError: "exit 1" }],
    ["after a turn that failed", { turnFailed: true }],
    ["with a question pending", { sessionStatus: "needs_answer" }],
    ["with a permission pending", { sessionStatus: "needs_permission" }],
    ["while the agent works", { sessionStatus: "working" }],
    ["while a turn runs", { turnRunning: true }],
  ])("offers nothing %s, with drafts to change", (_name, session) => {
    expect(discussionStarters(discussion([draftOf("d1")], session))).toEqual([]);
  });
});

describe("discussionOtherPrimary", () => {
  const archive = (found: DiscussionSummary) => discussionRequestOf(found, NOW, null);

  it("is true when the bar draws a primary", () => {
    const found = waiting(situation("ready_to_archive", "closing"), [
      draftOf("d1", { decision: "discarded" }),
    ]);

    expect(discussionOtherPrimary(found, archive(found))).toBe(true);
  });

  it("is true when a draft of the round failed: its Retry is the primary", () => {
    const found = waiting(situation("publish_failed", "error"), [
      draftOf("d1", { decision: "approved", publishError: "No." }),
    ]);

    expect(discussionOtherPrimary(found, archive(found))).toBe(true);
  });

  it("is false when the bar has no primary and nothing failed", () => {
    const found = waiting(situation("drafts"), [draftOf("d1")]);

    expect(discussionOtherPrimary(found, archive(found))).toBe(false);
    expect(discussionOtherPrimary(discussion([draftOf("d1")]), null)).toBe(false);
  });

  it("looks at the current round only", () => {
    const found = discussion(
      [draftOf("d1", { round: 1, publishError: "Old." }), draftOf("d2", { round: 2 })],
      { round: 2 },
    );

    expect(discussionOtherPrimary(found, null)).toBe(false);
  });
});
