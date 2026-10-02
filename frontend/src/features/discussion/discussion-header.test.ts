import { describe, expect, it } from "vitest";
import {
  archiveSummary,
  type DiscussionMenuGroup,
  discussionDetails,
  discussionMenu,
  discussionPauseRefusal,
  discussionStepper,
  roundSummary,
} from "@/features/discussion/discussion-header";
import type { DiscussionSummary, Draft } from "@/lib/wails";
import {
  makeBoard,
  makeBoardCard,
  makeDiscussion,
  makeDiscussionCard,
  makeDraft,
  makeRepository,
  makeSituation,
} from "@/test/wails-mock";

// The times are local, as the screen writes them.
const NOW = new Date(2026, 8, 24, 16, 0).getTime();
const at = (hour: number, minute: number) => new Date(2026, 8, 24, hour, minute).toISOString();
const PLACE = { kind: "discussion", stage: "discussion", step: 0 };

// At rest: no session at work, nothing asked.
function discussion(overrides: Partial<DiscussionSummary> = {}): DiscussionSummary {
  return makeDiscussion({
    sessionStatus: "waiting",
    turnRunning: false,
    processRunning: false,
    ...overrides,
  });
}

const draftOf = (id: string, overrides: Partial<Draft> = {}) =>
  makeDraft({ id, title: `Title of ${id}`, position: Number(id.replace(/\D/g, "")), ...overrides });

describe("discussionStepper", () => {
  it.each<[string, Partial<DiscussionSummary>, string, string, string, string, string]>([
    ["idle before the drafts", {}, "Discussing", "", "", "", "Progress · Discussing · idle"],
    ["idle in a round", { round: 1 }, "Round", "1", "", "", "Progress · Round 1 · idle"],
    [
      "the agent working before the drafts",
      { sessionStatus: "working" },
      "Discussing",
      "",
      "work",
      "working",
      "Progress · Discussing · Discussion agent working",
    ],
    [
      "the agent working in round 2",
      { round: 2, sessionStatus: "working" },
      "Round",
      "2",
      "work",
      "working",
      "Progress · Round 2 · Discussion agent working",
    ],
    [
      "a run under way",
      { round: 1, publishing: true },
      "Round",
      "1",
      "work",
      "publishing",
      "Progress · Round 1 · publishing",
    ],
    [
      "the agent working during a run: the agent first",
      { round: 1, publishing: true, sessionStatus: "working" },
      "Round",
      "1",
      "work",
      "working",
      "Progress · Round 1 · Discussion agent working",
    ],
    [
      "drafts to decide",
      {
        round: 1,
        situations: [makeSituation({ kind: "drafts", place: PLACE })],
      },
      "Round",
      "1",
      "wait",
      "",
      "Progress · Round 1 · waiting for you: decide drafts",
    ],
    [
      "a question before the drafts",
      { situations: [makeSituation({ kind: "question", place: PLACE })] },
      "Discussing",
      "",
      "wait",
      "",
      "Progress · Discussing · waiting for you: question",
    ],
    [
      "a publication that failed",
      {
        round: 1,
        situations: [makeSituation({ kind: "publish_failed", group: "error", place: PLACE })],
      },
      "Round",
      "1",
      "error",
      "",
      "Progress · Round 1 · error: publish failed",
    ],
    [
      "a session error",
      {
        situations: [makeSituation({ kind: "session_error", group: "error", place: PLACE })],
      },
      "Discussing",
      "",
      "error",
      "",
      "Progress · Discussing · error: session error",
    ],
    [
      "ready to archive in round 3",
      {
        round: 3,
        situations: [makeSituation({ kind: "ready_to_archive", group: "closing", place: PLACE })],
      },
      "Round",
      "3",
      "close",
      "",
      "Progress · Round 3 · ready to archive",
    ],
    [
      "a situation that keeps standing during a run",
      {
        round: 1,
        publishing: true,
        situations: [makeSituation({ kind: "epic_cant_publish", place: PLACE })],
      },
      "Round",
      "1",
      "wait",
      "",
      "Progress · Round 1 · waiting for you: epic can't publish",
    ],
  ])("draws %s", (_name, overrides, name, position, glyph, word, label) => {
    const model = discussionStepper(discussion(overrides), NOW);

    expect(model.pill).toMatchObject({
      name,
      position,
      qualifier: "",
      keepsQualifier: false,
      glyph: glyph === "" ? null : glyph,
      word,
      paused: false,
      shimmer: false,
    });
    expect(model.label).toBe(label);
    expect(model.tooltip).toEqual([label]);
    expect(model.steps).toEqual([
      { id: "round", name: position === "" ? name : `${name} ${position}`, state: "current" },
    ]);
  });

  it("says how many more situations there are", () => {
    const model = discussionStepper(
      discussion({
        round: 1,
        situations: [
          makeSituation({ kind: "question", place: PLACE }),
          makeSituation({ id: "s-2", kind: "permission", place: PLACE }),
        ],
      }),
      NOW,
    );

    expect(model.label).toBe("Progress · Round 1 · waiting for you: question, and 1 more");
  });

  it("draws the neutral pill while paused, whatever the situation", () => {
    const model = discussionStepper(
      discussion({
        round: 1,
        sessionStatus: "paused",
        pausedAt: at(14, 52),
        situations: [makeSituation({ kind: "drafts", place: PLACE })],
      }),
      NOW,
    );

    expect(model.pill).toMatchObject({
      name: "Round",
      position: "1",
      glyph: "paused",
      word: "paused",
      paused: true,
    });
    expect(model.label).toBe("Progress · Round 1 · paused since 14:52");
  });

  it("says only paused when the time of the pause is unknown", () => {
    const model = discussionStepper(discussion({ sessionStatus: "paused" }), NOW);

    expect(model.label).toBe("Progress · Discussing · paused");
  });
});

const labels = (groups: DiscussionMenuGroup[]) =>
  groups.map((group) => [group.label, group.items.map((item) => item.label)]);

describe("discussionMenu", () => {
  const loose = [draftOf("d1"), draftOf("d2")];

  it("has the legend Discussion, then Delete discussion… after the separator", () => {
    const groups = discussionMenu(
      discussion({ round: 1, drafts: loose }),
      "Platform Roadmap",
      true,
    );

    expect(labels(groups)).toEqual([
      ["Discussion", ["Open Platform Roadmap", "Group drafts into an epic…", "Archive…"]],
      [null, ["Delete discussion…"]],
    ]);
    expect(groups[0]?.items.map((item) => [item.action, item.icon])).toEqual([
      ["openBoard", "board"],
      ["group", "epic"],
      ["archive", "archive"],
    ]);
    expect(groups[1]?.items[0]).toMatchObject({ action: "delete", destructive: true });
  });

  it("leaves the board out without one", () => {
    const groups = discussionMenu(discussion(), null, true);

    expect(groups[0]?.items.map((item) => item.action)).toEqual(["group", "archive"]);
  });

  it("leaves the item that groups out without withGroup", () => {
    const groups = discussionMenu(discussion({ round: 1, drafts: loose }), "Roadmap", false);

    expect(groups[0]?.items.map((item) => item.action)).toEqual(["openBoard", "archive"]);
  });

  it("enables everything at rest with two loose drafts and a discussion that archives", () => {
    const items = discussionMenu(discussion({ round: 1, drafts: loose }), "Roadmap", true).flatMap(
      (group) => group.items,
    );

    expect(items.map((item) => item.disabledReason)).toEqual([
      undefined,
      undefined,
      undefined,
      undefined,
    ]);
  });

  it.each<[string, DraftsOf]>([
    ["no drafts", () => []],
    ["one loose draft", () => [draftOf("d1")]],
    [
      "a decided draft is still offered, a discarded one isn't",
      () => [draftOf("d1"), draftOf("d2", { decision: "discarded" })],
    ],
    [
      "a draft started",
      () => [draftOf("d1"), draftOf("d2", { outcome: "created", published: true })],
    ],
    [
      "cards already in an epic",
      () => [
        draftOf("d1", { kind: "epic" }),
        draftOf("d2", { epic: { draft: "d1", key: "", reference: "", title: "", url: "" } }),
        draftOf("d3", { epic: { draft: "d1", key: "", reference: "", title: "", url: "" } }),
      ],
    ],
  ])("dashes Group with the need of two loose drafts: %s", (_name, drafts) => {
    const items = discussionMenu(discussion({ round: 1, drafts: drafts() }), "Roadmap", true)[0]
      ?.items;

    expect(items?.find((item) => item.action === "group")?.disabledReason).toBe(
      "needs two loose drafts not published",
    );
  });

  it("dashes Group, Archive and Delete with a run under way", () => {
    const items = discussionMenu(
      discussion({
        round: 1,
        drafts: loose,
        publishing: true,
        canArchive: false,
        archiveHint: "A publication is running.",
      }),
      "Roadmap",
      true,
    ).flatMap((group) => group.items);

    expect(items.map((item) => [item.action, item.disabledReason])).toEqual([
      ["openBoard", undefined],
      ["group", "a publication is running"],
      ["archive", "a publication is running"],
      ["delete", "a publication is running"],
    ]);
  });

  it.each([
    [
      "A publication failed: Retry it, or discard the draft.",
      "a publication failed: Retry it, or discard the draft",
    ],
    [
      "The epic can't publish: approve one more card, or discard the epic.",
      "the epic can't publish: approve one more card, or discard the epic",
    ],
    ["Approved drafts wait to be published.", "approved drafts wait to be published"],
    ["PR checks are running.", "PR checks are running"],
  ])("gives Archive the hint %s as its reason", (hint, reason) => {
    const items = discussionMenu(
      discussion({ canArchive: false, archiveHint: hint }),
      "Roadmap",
      false,
    )[0]?.items;

    expect(items?.find((item) => item.action === "archive")?.disabledReason).toBe(reason);
  });

  it("always has a reason for an Archive that can't, even without the hint", () => {
    const items = discussionMenu(discussion({ canArchive: false }), "Roadmap", false)[0]?.items;

    expect(items?.find((item) => item.action === "archive")?.disabledReason).toBe(
      "it can't be archived now",
    );
  });
});

type DraftsOf = () => Draft[];

describe("discussionPauseRefusal", () => {
  it("dashes Pause when the session stopped on an error", () => {
    expect(discussionPauseRefusal(discussion({ lastError: "Claude Code isn't logged in." }))).toBe(
      "Nothing is running to pause: the session stopped with an error. Retry it.",
    );
  });

  it("lets Pause through otherwise", () => {
    expect(discussionPauseRefusal(discussion())).toBeNull();
  });
});

describe("roundSummary", () => {
  const published = (id: string, round: number, outcome: string) =>
    draftOf(id, { round, published: true, outcome, decision: "approved" });

  it("says what a round of the past published", () => {
    const drafts = [
      published("d1", 1, "created"),
      published("d2", 1, "created"),
      published("d3", 1, "created"),
      published("d4", 1, "created"),
      published("d5", 1, "updated"),
      draftOf("d6", { round: 2 }),
    ];

    expect(roundSummary(drafts, 1)).toBe("5 drafts · 4 created, 1 updated");
  });

  it("says one part when the round published one kind", () => {
    expect(roundSummary([published("d1", 1, "created")], 1)).toBe("1 draft · 1 created");
    expect(roundSummary([published("d1", 1, "updated")], 1)).toBe("1 draft · 1 updated");
  });

  it("says how far the current round is while something is left to decide", () => {
    const drafts = [
      published("d1", 2, "created"),
      draftOf("d2", { round: 2, decision: "discarded" }),
      draftOf("d3", { round: 2 }),
    ];

    expect(roundSummary(drafts, 2)).toBe("3 drafts · 1 created · 2 of 3 decided");
  });

  it("says nothing published for a round that discarded everything", () => {
    const drafts = [
      draftOf("d1", { decision: "discarded" }),
      draftOf("d2", { decision: "discarded" }),
    ];

    expect(roundSummary(drafts, 1)).toBe("2 drafts · nothing published");
  });

  it("doesn't count how far a round of the past is", () => {
    const drafts = [draftOf("d1", { round: 1, decision: "approved" }), draftOf("d2", { round: 2 })];

    expect(roundSummary(drafts, 1)).toBe("1 draft · nothing published");
  });
});

describe("discussionDetails", () => {
  const board = makeBoard({
    title: "Platform Roadmap",
    owner: "acme",
    number: 7,
    cards: [makeBoardCard({ key: "acme/billing#455" })],
  });
  const full = () =>
    discussion({
      board: "Platform Roadmap",
      createdAt: at(14, 2),
      sessionModel: "claude-opus-5-5[1m]",
      sessionEffort: "high",
      cards: [
        makeDiscussionCard({
          key: "acme/billing#455",
          repository: "acme/billing",
          number: 455,
          title: "Overage on the invoice",
          url: "https://github.com/acme/billing/issues/455",
        }),
        makeDiscussionCard({
          key: "acme/gateway#461",
          repository: "acme/gateway",
          number: 461,
          title: "Rate limits",
          url: "https://github.com/acme/gateway/issues/461",
        }),
      ],
      repositories: [
        { id: "r-billing", fullName: "acme/billing", cloned: true, missing: false },
        { id: "r-gateway", fullName: "acme/gateway", cloned: false, missing: false },
        { id: "r-web", fullName: "acme/web", cloned: true, missing: true },
        { id: "r-docs", fullName: "acme/docs", cloned: true, missing: false },
      ],
    });

  it("says the facts of the discussion", () => {
    const model = discussionDetails(full(), board, NOW, [
      makeRepository({ id: "r-gateway", cloning: true }),
    ]);

    expect(model.discussion).toEqual({
      board: { title: "Platform Roadmap", detail: "acme · project 7", open: true },
      cards: [
        {
          number: 455,
          title: "Overage on the invoice",
          inReading: true,
          url: "https://github.com/acme/billing/issues/455",
        },
        {
          number: 461,
          title: "Rate limits",
          inReading: false,
          url: "https://github.com/acme/gateway/issues/461",
        },
      ],
      read: "acme/billing, acme/docs",
      notCloned: [
        { id: "r-gateway", fullName: "acme/gateway", missing: false, cloning: true },
        { id: "r-web", fullName: "acme/web", missing: true, cloning: false },
      ],
      model: "Opus 5.5 (1M) · high",
      started: "Today 14:02",
    });
  });

  it("says no cloning when the registered repositories aren't given", () => {
    const model = discussionDetails(full(), board, NOW);

    expect(model.discussion.notCloned.map((one) => one.cloning)).toEqual([false, false]);
  });

  it("keeps the title of a board that left the app, without opening it", () => {
    const model = discussionDetails(full(), null, NOW);

    expect(model.discussion.board).toEqual({
      title: "Platform Roadmap",
      detail: "",
      open: false,
    });
    expect(model.discussion.cards.every((card) => !card.inReading)).toBe(true);
  });

  it("leaves out what has no value", () => {
    const model = discussionDetails(
      discussion({
        board: "",
        cards: [],
        repositories: [],
        sessionModel: "",
        createdAt: at(14, 2),
      }),
      null,
      NOW,
    );

    expect(model.discussion).toEqual({
      board: null,
      cards: [],
      read: "",
      notCloned: [],
      model: "",
      started: "Today 14:02",
    });
  });

  it("says the model without an effort", () => {
    const model = discussionDetails(
      discussion({ sessionModel: "claude-opus-5-5[1m]", sessionEffort: "" }),
      board,
      NOW,
    );

    expect(model.discussion.model).toBe("Opus 5.5 (1M)");
  });

  it("says No drafts yet before the first round", () => {
    expect(discussionDetails(discussion(), board, NOW).rounds).toEqual([
      { text: "No drafts yet", time: "" },
    ]);
  });

  it("lists a line per round, the latest below, with the time of the last publication", () => {
    const published = (id: string, round: number, hour: number, minute: number, outcome: string) =>
      draftOf(id, {
        round,
        published: true,
        outcome,
        decision: "approved",
        publishedAt: at(hour, minute),
      });
    const model = discussionDetails(
      discussion({
        round: 2,
        drafts: [
          draftOf("d4", { round: 2 }),
          published("d1", 1, 15, 10, "created"),
          published("d2", 1, 15, 12, "updated"),
          published("d3", 2, 15, 49, "created"),
        ],
      }),
      board,
      NOW,
    );

    expect(model.rounds).toEqual([
      { text: "Round 1 · 2 drafts · 1 created, 1 updated", time: "15:12" },
      { text: "Round 2 · 2 drafts · 1 created · 1 of 2 decided", time: "15:49" },
    ]);
  });

  it("has no time for a round that published nothing", () => {
    const model = discussionDetails(
      discussion({
        round: 1,
        drafts: [
          draftOf("d1", { decision: "discarded" }),
          draftOf("d2", { decision: "discarded" }),
        ],
      }),
      board,
      NOW,
    );

    expect(model.rounds).toEqual([{ text: "Round 1 · 2 drafts · nothing published", time: "" }]);
  });

  it("offers Context, and the Document once the agent wrote it", () => {
    expect(discussionDetails(discussion(), board, NOW).documents).toEqual([
      { name: "context.md", label: "Context", enabled: true },
      { name: "discussion.md", label: "Document · written with the drafts", enabled: false },
    ]);
    expect(discussionDetails(discussion({ hasDocument: true }), board, NOW).documents).toEqual([
      { name: "context.md", label: "Context", enabled: true },
      { name: "discussion.md", label: "Document · discussion.md", enabled: true },
    ]);
  });
});

describe("archiveSummary", () => {
  const published = (id: string, round: number, outcome: "created" | "updated") =>
    makeDraft({ id, round, published: true, outcome });

  it("says what a single round published", () => {
    const drafts = [
      published("a", 1, "created"),
      published("b", 1, "created"),
      published("c", 1, "created"),
      published("d", 1, "created"),
      published("e", 1, "updated"),
    ];

    expect(archiveSummary(drafts)).toBe("Published: 5 issues in round 1: 4 created, 1 updated");
  });

  it("counts the rounds when there are more", () => {
    const drafts = [
      published("a", 1, "created"),
      published("b", 2, "created"),
      published("c", 3, "updated"),
    ];

    expect(archiveSummary(drafts)).toBe("Published: 3 issues in 3 rounds: 2 created, 1 updated");
  });

  it("says one kind of outcome alone", () => {
    expect(archiveSummary([published("a", 2, "created")])).toBe(
      "Published: 1 issue in round 2: 1 created",
    );
  });

  it("says nothing without a publication", () => {
    expect(archiveSummary([])).toBe("Published: nothing");
    expect(archiveSummary([makeDraft({ decision: "discarded" })])).toBe("Published: nothing");
  });

  it("lists what is left out, the discarded not among it", () => {
    const drafts = [
      published("a", 1, "created"),
      makeDraft({ id: "b", title: "Overage", decision: "approved" }),
      makeDraft({ id: "c", title: "Credits" }),
      makeDraft({ id: "d", title: "Refunds", decision: "discarded" }),
    ];

    expect(archiveSummary(drafts)).toBe(
      "Published: 1 issue in round 1: 1 created · Not published: Overage, Credits",
    );
  });
});
