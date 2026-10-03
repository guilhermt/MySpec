import { describe, expect, it } from "vitest";
import {
  accessibleName,
  advanceAfter,
  bodyDiff,
  type CardEntry,
  cardEntries,
  decisionOf,
  dependencyViews,
  diffCount,
  draftStateOf,
  epicGroupLabel,
  fieldsLine,
  foldedLine2,
  gestureLineOf,
  groupable,
  groupReason,
  isBlocked,
  isDecided,
  isStarted,
  LOCK_MS,
  nextToDecide,
  onGitHub,
  roundDrafts,
  warningsOf,
} from "@/features/discussion/drafts-card";
import type { DiscussionSummary, Draft, DraftHold } from "@/lib/wails";
import { shortTime } from "@/lib/when";
import { makeDiscussion, makeDraft, makeDraftRef } from "@/test/wails-mock";

const NOW = Date.parse("2026-09-24T16:00:00Z");
const TODAY = "2026-09-24T12:10:00Z";

const NO_HOLD: DraftHold = { reason: "", title: "", left: 0, approved: 0, cards: 0 };

function hold(overrides: Partial<DraftHold>): DraftHold {
  return { ...NO_HOLD, ...overrides };
}

function draft(id: string, overrides: Partial<Draft> = {}): Draft {
  return makeDraft({
    id,
    title: `Title of ${id}`,
    position: Number(id.replace(/\D/g, "")),
    ...overrides,
  });
}

function discussionOf(drafts: Draft[], overrides: Partial<DiscussionSummary> = {}) {
  return makeDiscussion({ drafts, round: 1, ...overrides });
}

const inEpic = (id: string): Partial<Draft> => ({ epic: makeDraftRef({ draft: id }) });

describe("LOCK_MS", () => {
  it("is 900 ms", () => {
    expect(LOCK_MS).toBe(900);
  });
});

describe("the state of a draft in the card", () => {
  it.each([
    ["decided: approved", draft("d1", { decision: "approved" }), true],
    ["decided: discarded", draft("d1", { decision: "discarded" }), true],
    ["decided: on GitHub", draft("d1", { published: true }), true],
    ["not decided", draft("d1"), false],
  ])("%s", (_name, one, decided) => {
    expect(isDecided(one)).toBe(decided);
  });

  it("started is GitHub having something of it", () => {
    expect(isStarted(draft("d1", { outcome: "created" }))).toBe(true);
    expect(isStarted(draft("d1", { outcome: "" }))).toBe(false);
  });

  it("is blocked without a repository the board manages, until it started", () => {
    expect(isBlocked(draft("d1", { repositoryId: "" }))).toBe(true);
    expect(isBlocked(draft("d1", { repositoryId: "", outcome: "created" }))).toBe(false);
    expect(isBlocked(draft("d1"))).toBe(false);
  });
});

describe("roundDrafts", () => {
  it("keeps the drafts of one round by position", () => {
    const all = [
      draft("d3", { round: 2, position: 1 }),
      draft("d2", { round: 1, position: 2 }),
      draft("d1", { round: 1, position: 1 }),
    ];

    expect(roundDrafts(all, 1).map((one) => one.id)).toEqual(["d1", "d2"]);
    expect(roundDrafts(all, 2).map((one) => one.id)).toEqual(["d3"]);
  });
});

describe("cardEntries", () => {
  const epicA = draft("d1", { kind: "epic", position: 3 });
  const epicB = draft("d2", { kind: "epic", position: 1 });
  const loose = draft("d3", { position: 5 });
  const cardOfA2 = draft("d4", { position: 4, ...inEpic("d1") });
  const cardOfA1 = draft("d5", { position: 2, ...inEpic("d1") });
  const cardOfB = draft("d6", { position: 6, ...inEpic("d2") });
  const looseFirst = draft("d7", { position: 0 });

  it("puts each epic by its position with its cards under it, then the loose ones", () => {
    const entries = cardEntries(
      discussionOf([epicA, epicB, loose, cardOfA2, cardOfA1, cardOfB, looseFirst]),
    );

    expect(entries.map((entry) => [entry.number, entry.draft.id, entry.epic?.id ?? null])).toEqual([
      [1, "d2", null],
      [2, "d6", "d2"],
      [3, "d1", null],
      [4, "d5", "d1"],
      [5, "d4", "d1"],
      [6, "d7", null],
      [7, "d3", null],
    ]);
  });

  it("leaves a card whose epic is a draft of another round loose, and an issue's too", () => {
    const old = draft("d1", { kind: "epic", round: 1 });
    const toOld = draft("d2", { round: 2, position: 1, ...inEpic("d1") });
    const toIssue = draft("d3", {
      round: 2,
      position: 2,
      epic: makeDraftRef({ draft: "", key: "acme/billing#478", reference: "acme/billing#478" }),
    });

    const entries = cardEntries(discussionOf([old, toOld, toIssue], { round: 2 }));

    expect(entries.map((entry) => [entry.draft.id, entry.epic])).toEqual([
      ["d2", null],
      ["d3", null],
    ]);
  });

  it("is empty without drafts", () => {
    expect(cardEntries(discussionOf([], { round: 0 }))).toEqual([]);
  });
});

describe("epicGroupLabel", () => {
  it("names the epic and its cards", () => {
    const epic = draft("d1", { kind: "epic", title: "Pricing tiers with metered overage" });

    expect(epicGroupLabel(epic, 3)).toBe("Epic Pricing tiers with metered overage and its 3 cards");
    expect(epicGroupLabel(epic, 1)).toBe("Epic Pricing tiers with metered overage and its 1 card");
  });
});

describe("nextToDecide", () => {
  const entry = (id: string, decision = "", published = false): CardEntry => ({
    draft: draft(id, { decision, published }),
    number: 1,
    epic: null,
  });

  it("goes to the next draft to decide", () => {
    const entries = [entry("d1"), entry("d2", "approved"), entry("d3")];

    expect(nextToDecide(entries, "d1", 1)).toBe("d3");
  });

  it("goes back, and turns around at the ends", () => {
    const entries = [entry("d1"), entry("d2", "approved"), entry("d3")];

    expect(nextToDecide(entries, "d3", 1)).toBe("d1");
    expect(nextToDecide(entries, "d1", -1)).toBe("d3");
    expect(nextToDecide(entries, "d3", -1)).toBe("d1");
  });

  it("starts at the first, or the last, from nothing", () => {
    const entries = [entry("d1", "approved"), entry("d2"), entry("d3"), entry("d4", "discarded")];

    expect(nextToDecide(entries, null, 1)).toBe("d2");
    expect(nextToDecide(entries, null, -1)).toBe("d3");
  });

  it("skips what is on GitHub", () => {
    const entries = [entry("d1", "approved", true), entry("d2")];

    expect(nextToDecide(entries, null, 1)).toBe("d2");
  });

  it("is null when none is left to decide", () => {
    const entries = [entry("d1", "approved"), entry("d2", "discarded")];

    expect(nextToDecide(entries, "d1", 1)).toBeNull();
    expect(nextToDecide(entries, null, 1)).toBeNull();
    expect(nextToDecide([], null, 1)).toBeNull();
  });

  it("finds none other than the draft itself", () => {
    expect(nextToDecide([entry("d1"), entry("d2", "approved")], "d1", 1)).toBeNull();
  });

  it("lands on the draft from where it asks when it is the only one left, from nothing", () => {
    expect(nextToDecide([entry("d1")], null, 1)).toBe("d1");
  });
});

describe("draftStateOf", () => {
  const published = {
    published: true,
    outcome: "created",
    decision: "approved",
    number: 479,
    url: "https://github.com/acme/billing/issues/479",
    repository: "acme/billing",
    publishedAt: TODAY,
  };

  it("says a draft on GitHub, by its short reference, the time and the way back", () => {
    const time = shortTime(TODAY, NOW);

    expect(draftStateOf(draft("d1", published), NOW)).toEqual({
      open: `Created billing#479 · ${time}`,
      folded: `Created billing#479 · ${time}`,
      glyph: "check",
      strong: false,
      link: { label: "billing#479", url: "https://github.com/acme/billing/issues/479" },
      time,
      wayBack: "To take it back, close billing#479 on GitHub.",
      created: null,
    });
  });

  it("says Updated and edit for an update", () => {
    const state = draftStateOf(
      draft("d1", {
        ...published,
        kind: "update",
        outcome: "updated",
        repository: "acme/gateway",
        number: 461,
      }),
      NOW,
    );

    expect(state.folded).toContain("Updated gateway#461");
    expect(state.wayBack).toBe("To take it back, edit gateway#461 on GitHub.");
  });

  it("puts the date of a publication of another day", () => {
    const state = draftStateOf(
      draft("d1", { ...published, publishedAt: "2026-09-23T12:10:00Z" }),
      NOW,
    );

    expect(state.time).toBe("Sep 23");
    expect(state.folded).toBe("Created billing#479 · Sep 23");
  });

  it("says Publishing… with the spinner", () => {
    const state = draftStateOf(draft("d1", { publishing: true, decision: "approved" }), NOW);

    expect(state).toMatchObject({ open: "Publishing…", folded: "Publishing…", glyph: "spinner" });
  });

  it("says the failure by its reason alone, folded as a way to Retry", () => {
    const state = draftStateOf(
      draft("d1", { publishError: "The repository has no issues.", decision: "approved" }),
      NOW,
    );

    expect(state).toMatchObject({
      open: "The repository has no issues.",
      folded: "Couldn't write to GitHub · open it to Retry",
      glyph: "error",
      created: null,
    });
  });

  it("draws above the failure what the draft created before it", () => {
    const state = draftStateOf(
      draft("d1", {
        publishError: "Couldn't set the epic.",
        decision: "approved",
        outcome: "created",
        number: 480,
        url: "https://github.com/acme/billing/issues/480",
        repository: "acme/billing",
      }),
      NOW,
    );

    expect(state.created).toEqual({
      label: "billing#480",
      url: "https://github.com/acme/billing/issues/480",
    });
  });

  it("says Discarded", () => {
    expect(draftStateOf(draft("d1", { decision: "discarded" }), NOW)).toMatchObject({
      open: "Discarded",
      folded: "Discarded",
      glyph: null,
    });
  });

  it.each([
    ["epic", hold({ reason: "epic" }), "Approved · waits for the epic", false],
    [
      "draft",
      hold({ reason: "draft", title: "Tier limits" }),
      "Approved · waits for Tier limits",
      false,
    ],
    [
      "cards",
      hold({ reason: "cards", left: 2 }),
      "Approved · waits for 2 more cards of the epic to be decided",
      false,
    ],
    [
      "epic_short",
      hold({ reason: "epic_short", approved: 1, cards: 3 }),
      "Approved · the epic needs two approved cards · 1 of 3",
      true,
    ],
    [
      "epic_discarded",
      hold({ reason: "epic_discarded" }),
      "The epic is discarded · this card won't publish",
      true,
    ],
  ])("says an approved draft that waits: %s", (_name, held, text, strong) => {
    const state = draftStateOf(draft("d1", { decision: "approved", hold: held }), NOW);

    expect(state).toMatchObject({ open: text, folded: text, glyph: "hold", strong });
  });

  it("says an approved draft that goes in the run", () => {
    expect(draftStateOf(draft("d1", { decision: "approved" }), NOW)).toMatchObject({
      open: "Approved · publishing next",
      folded: "Approved · publishing next",
      glyph: null,
    });
  });

  it("says a blocked draft only folded: the gesture line says it open", () => {
    expect(draftStateOf(draft("d1", { repositoryId: "" }), NOW)).toMatchObject({
      open: null,
      folded: "Can't publish · choose a repository",
      glyph: "blocked",
    });
    expect(draftStateOf(draft("d1", { repositoryId: "", kind: "update" }), NOW).folded).toBe(
      "Can't publish · the repository left the board",
    );
  });

  it("says a revision that took the approval", () => {
    expect(draftStateOf(draft("d1", { approvalCleared: true }), NOW)).toMatchObject({
      open: "Revised · your approval was cleared",
      folded: "Revised · approval cleared",
    });
  });

  it("says Not decided without a decision", () => {
    expect(draftStateOf(draft("d1"), NOW)).toMatchObject({ open: null, folded: "Not decided" });
  });

  it("takes the first case that holds: GitHub, then the run, then the failure", () => {
    expect(draftStateOf(draft("d1", { ...published, publishing: true }), NOW).glyph).toBe("check");
    expect(
      draftStateOf(draft("d1", { publishing: true, publishError: "x", decision: "approved" }), NOW)
        .glyph,
    ).toBe("spinner");
    expect(draftStateOf(draft("d1", { decision: "discarded", repositoryId: "" }), NOW).folded).toBe(
      "Discarded",
    );
    expect(draftStateOf(draft("d1", { decision: "approved", repositoryId: "" }), NOW).folded).toBe(
      "Approved · publishing next",
    );
    expect(draftStateOf(draft("d1", { repositoryId: "", approvalCleared: true }), NOW).glyph).toBe(
      "blocked",
    );
  });
});

describe("foldedLine2 and fieldsLine", () => {
  const epic = draft("d1", { kind: "epic", repository: "acme/billing", module: "Billing" });
  const card = (id: string, overrides: Partial<Draft> = {}) =>
    draft(id, { repository: "acme/billing", module: "Billing", ...inEpic("d1"), ...overrides });

  it("says the repository and the module", () => {
    const one = draft("d2", { repository: "acme/billing", module: "Billing" });
    const discussion = discussionOf([one]);

    expect(foldedLine2(one, discussion)).toBe("acme/billing · Billing");
    expect(fieldsLine(one, discussion)).toBe("acme/billing · Billing");
  });

  it("counts the cards of an epic of the round", () => {
    const discussion = discussionOf([epic, card("d2"), card("d3"), draft("d4", { round: 2 })]);

    expect(foldedLine2(epic, discussion)).toBe("acme/billing · Billing · 2 cards");
    expect(fieldsLine(epic, discussion)).toBe("acme/billing · Billing · 2 cards");
  });

  it("says the epic that is an issue on GitHub", () => {
    const one = draft("d2", {
      repository: "acme/billing",
      epic: makeDraftRef({
        draft: "",
        key: "acme/billing#478",
        reference: "acme/billing#478",
        title: "Pricing tiers",
      }),
    });

    expect(foldedLine2(one, discussionOf([one]))).toBe(
      "acme/billing · In billing#478 Pricing tiers",
    );
    expect(fieldsLine(one, discussionOf([one]))).toBe(
      "acme/billing · In billing#478 Pricing tiers",
    );
  });

  it("says what a card depends on, and its warnings, folded only", () => {
    const first = draft("d1", { title: "Tier limits" });
    const second = draft("d2", {
      repository: "acme/billing",
      dependencies: [
        {
          draft: "d1",
          key: "",
          reference: "",
          title: "",
          url: "",
          linked: false,
          dropped: "",
          detail: "",
        },
      ],
      warnings: ["The module Gone is no longer an option of the board.", "Other."],
    });
    const discussion = discussionOf([first, second]);

    expect(foldedLine2(second, discussion)).toBe(
      "acme/billing · Depends on Tier limits · 2 warnings",
    );
    expect(fieldsLine(second, discussion)).toBe("acme/billing");
  });

  it("says 1 warning, singular", () => {
    const one = draft("d1", { repository: "", warnings: ["Careful."] });

    expect(foldedLine2(one, discussionOf([one]))).toBe("1 warning");
  });

  it("counts the warning of a repository the board left", () => {
    const one = draft("d1", { repository: "acme/status-page", repositoryId: "" });

    expect(foldedLine2(one, discussionOf([one]))).toBe("acme/status-page · 1 warning");
  });

  it("says what an update changes in the card, folded and open", () => {
    const update = draft("d1", {
      kind: "update",
      repository: "acme/gateway",
      title: "Rate limits",
      module: "Gateway",
      current: {
        title: "Throttling",
        body: "",
        module: "",
        status: "",
        epic: makeDraftRef({
          draft: "",
          key: "acme/gateway#10",
          reference: "acme/gateway#10",
          title: "Platform",
        }),
        dependencies: [],
        readAt: "",
      },
    });
    const discussion = discussionOf([update]);

    expect(foldedLine2(update, discussion)).toBe("acme/gateway · Gateway · Now: Throttling");
    expect(fieldsLine(update, discussion)).toBe(
      "acme/gateway · Gateway · Now: Throttling · Module now: none · Epic now: gateway#10 Platform",
    );
  });

  it("says none when the draft puts the card in an epic it had none of, and nothing when they agree", () => {
    const same = makeDraftRef({
      draft: "",
      key: "acme/gateway#10",
      reference: "acme/gateway#10",
      title: "Platform",
    });
    const base = {
      kind: "update",
      repository: "acme/gateway",
      title: "Rate limits",
      module: "Gateway",
      epic: same,
      current: {
        title: "Rate limits",
        body: "",
        module: "Gateway",
        status: "",
        epic: same,
        dependencies: [],
        readAt: "",
      },
    };
    const agrees = draft("d1", base);
    const none = draft("d2", { ...base, current: { ...base.current, epic: null } });

    expect(fieldsLine(agrees, discussionOf([agrees]))).toBe(
      "acme/gateway · Gateway · In gateway#10 Platform",
    );
    expect(fieldsLine(none, discussionOf([none]))).toBe(
      "acme/gateway · Gateway · In gateway#10 Platform · Epic now: none",
    );
  });
});

describe("dependencyViews", () => {
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

  it("opens in the card a draft of the current round, by its title", () => {
    const target = draft("d1", { title: "Tier limits" });
    const one = draft("d2", { dependencies: [dependency({ draft: "d1", title: "Tier limits" })] });

    expect(dependencyViews(one, discussionOf([target, one]))).toEqual([
      { title: "Tier limits", draft: "d1", url: "", linked: false },
    ]);
  });

  it("takes the title of the draft pointed at when the dependency has none", () => {
    const target = draft("d1", { title: "Tier limits" });
    const one = draft("d2", { dependencies: [dependency({ draft: "d1" })] });

    expect(dependencyViews(one, discussionOf([target, one]))[0]?.title).toBe("Tier limits");
  });

  it("opens the issue of a draft of a closed round on GitHub", () => {
    const old = draft("d1", {
      round: 1,
      title: "Tier limits",
      url: "https://github.com/acme/billing/issues/9",
      published: true,
      outcome: "created",
    });
    const one = draft("d2", { round: 2, dependencies: [dependency({ draft: "d1" })] });

    expect(dependencyViews(one, discussionOf([old, one], { round: 2 }))).toEqual([
      {
        title: "Tier limits",
        draft: null,
        url: "https://github.com/acme/billing/issues/9",
        linked: false,
      },
    ]);
  });

  it("opens the issue of a card, and says one recorded on GitHub", () => {
    const one = draft("d2", {
      dependencies: [
        dependency({
          key: "acme/api#99",
          reference: "acme/api#99",
          title: "Usage alerts",
          url: "https://github.com/acme/api/issues/99",
          linked: true,
        }),
      ],
    });

    expect(dependencyViews(one, discussionOf([one]))).toEqual([
      {
        title: "Usage alerts",
        draft: null,
        url: "https://github.com/acme/api/issues/99",
        linked: true,
      },
    ]);
  });

  it("falls back to the reference of an issue without a title", () => {
    const one = draft("d2", {
      dependencies: [dependency({ key: "acme/api#99", reference: "acme/api#99" })],
    });

    expect(dependencyViews(one, discussionOf([one]))[0]?.title).toBe("acme/api#99");
  });

  it("leaves out the ones that dropped", () => {
    const one = draft("d2", {
      dependencies: [
        dependency({ draft: "d1", title: "Tier limits", dropped: "discarded" }),
        dependency({ key: "acme/api#99", reference: "acme/api#99", dropped: "unavailable" }),
      ],
    });

    expect(dependencyViews(one, discussionOf([one]))).toEqual([]);
  });
});

describe("onGitHub", () => {
  const ref = (reference: string) =>
    makeDraftRef({ draft: "", key: reference, reference, title: "" });
  const current = (dependencies: ReturnType<typeof ref>[]) => ({
    title: "",
    body: "",
    module: "",
    status: "",
    epic: null,
    dependencies,
    readAt: "",
  });

  it("lists the dependencies of the card the draft doesn't say", () => {
    const one = draft("d1", {
      kind: "update",
      current: current([ref("acme/billing#455"), ref("acme/billing#470"), ref("acme/billing#12")]),
      dependencies: [
        {
          draft: "",
          key: "acme/billing#12",
          reference: "acme/billing#12",
          title: "",
          url: "",
          linked: true,
          dropped: "",
          detail: "",
        },
      ],
    });

    expect(onGitHub(one)).toBe("#455, #470");
  });

  it("is empty without a card on GitHub or without a difference", () => {
    expect(onGitHub(draft("d1"))).toBe("");
    expect(onGitHub(draft("d1", { kind: "update", current: current([]) }))).toBe("");
  });
});

describe("warningsOf", () => {
  it("says the repository the board left first, then the warnings of the Go side", () => {
    const one = draft("d1", {
      repository: "acme/status-page",
      repositoryId: "",
      warnings: ["The dependency on Tier limits is no longer among the drafts."],
    });

    expect(warningsOf(one, { kind: "fresh" })).toEqual([
      "acme/status-page is no longer managed by the board.",
      "The dependency on Tier limits is no longer among the drafts.",
    ]);
  });

  it("says no repository left for a draft that never had one", () => {
    expect(
      warningsOf(draft("d1", { repository: "", repositoryId: "" }), { kind: "fresh" }),
    ).toEqual([]);
  });

  it.each([
    [{ kind: "missing" }, "This card isn't in the last reading of the board."],
    [{ kind: "refreshing" }, "Refreshing the card…"],
    [
      { kind: "failed", reason: "gh timed out" },
      "Couldn't refresh the card: gh timed out. The draft shows the last reading.",
    ],
  ] as const)("ends with the reading again of the card: %o", (refresh, text) => {
    expect(warningsOf(draft("d1", { warnings: ["Careful."] }), refresh)).toEqual([
      "Careful.",
      text,
    ]);
  });

  it("is empty without a warning", () => {
    expect(warningsOf(draft("d1"), { kind: "fresh" })).toEqual([]);
  });
});

describe("accessibleName", () => {
  it("is the name of the material", () => {
    const one = draft("d3", {
      title: "Overage on the monthly invoice",
      repository: "acme/billing",
      module: "Billing",
      decision: "approved",
      hold: hold({ reason: "epic" }),
    });
    const discussion = discussionOf([one]);
    const entry: CardEntry = { draft: one, number: 3, epic: null };

    expect(accessibleName(entry, 5, one, discussion, NOW)).toBe(
      "Draft 3 of 5: New card. Overage on the monthly invoice. acme/billing, Billing. Approved, waits for the epic.",
    );
  });

  it("names an undecided epic without a module, and keeps the period of a title", () => {
    const one = draft("d1", { kind: "epic", title: "Pricing tiers.", repository: "acme/billing" });
    const entry: CardEntry = { draft: one, number: 1, epic: null };

    expect(accessibleName(entry, 2, one, discussionOf([one]), NOW)).toBe(
      "Draft 1 of 2: Epic. Pricing tiers. acme/billing. Not decided.",
    );
  });

  it("says the way to Retry of a failure", () => {
    const one = draft("d2", { publishError: "Nope.", repository: "", module: "" });
    const entry: CardEntry = { draft: one, number: 2, epic: null };

    expect(accessibleName(entry, 2, one, discussionOf([one]), NOW)).toBe(
      "Draft 2 of 2: New card. Title of d2. Couldn't write to GitHub, open it to Retry.",
    );
  });
});

describe("gestureLineOf", () => {
  const epic = draft("d1", { kind: "epic", title: "Tier limits and overage prices" });
  const first = draft("d2", { title: "Overage on the monthly invoice", ...inEpic("d1") });
  const second = draft("d3", { title: "Invoice export", ...inEpic("d1") });

  function line(one: Draft, overrides: Partial<Draft> = {}, discussion?: DiscussionSummary) {
    const self = { ...one, ...overrides };
    return gestureLineOf(
      self,
      discussion ?? discussionOf([epic, first, second].map((d) => (d.id === self.id ? self : d))),
      false,
    );
  }

  it("says what Approve publishes: the card alone", () => {
    const result = line(draft("d9", { approvePublishes: ["d9"] }));

    expect(result).toEqual({
      icon: "hourglass",
      segments: [
        { text: "Approve", strong: true },
        { text: " publishes this card to GitHub now.", strong: false },
      ],
      text: "Approve publishes this card to GitHub now.",
    });
  });

  it("names a chain: the epic of the draft, the cards by title and this card", () => {
    const result = line(second, { approvePublishes: ["d1", "d2", "d3"] });

    expect(result?.icon).toBe("chain");
    expect(result?.text).toBe(
      "Approve publishes the epic, Overage on the monthly invoice and this card to GitHub now.",
    );
  });

  it("names the epic of the draft by 'the epic' alone, and another epic by its title", () => {
    const other = draft("d4", { kind: "epic", title: "Mobile" });
    const result = line(
      first,
      { approvePublishes: ["d4", "d1", "d2"] },
      discussionOf([epic, first, second, other]),
    );

    expect(result?.text).toBe(
      "Approve publishes the epic Mobile, the epic and this card to GitHub now.",
    );
  });

  it("calls an epic of its own 'the epic'", () => {
    const result = line(epic, { approvePublishes: ["d2", "d1"] });

    expect(result?.text).toBe(
      "Approve publishes Overage on the monthly invoice and the epic to GitHub now.",
    );
  });

  it("says that Discard publishes too, with the two names strong", () => {
    const result = line(second, {
      approvePublishes: ["d1", "d2", "d3"],
      discardPublishes: ["d1", "d2"],
    });

    expect(result?.icon).toBe("chain");
    expect(result?.text).toBe(
      "Approve publishes the epic, Overage on the monthly invoice and this card to GitHub now. Discard publishes the epic and Overage on the monthly invoice now.",
    );
    expect(
      result?.segments.filter((segment) => segment.strong).map((segment) => segment.text),
    ).toEqual(["Approve", "Discard"]);
  });

  it("uses the chain icon when Discard publishes and Approve a single card", () => {
    const result = line(draft("d9"), { approvePublishes: ["d9"], discardPublishes: ["d2"] });

    expect(result?.icon).toBe("chain");
  });

  it("joins two and three names", () => {
    const two = line(second, { approvePublishes: ["d2", "d3"] });
    const three = line(second, { approvePublishes: ["d1", "d2", "d3"] });

    expect(two?.text).toBe(
      "Approve publishes Overage on the monthly invoice and this card to GitHub now.",
    );
    expect(three?.text).toContain("the epic, Overage on the monthly invoice and this card");
  });

  it.each([
    [
      "epic",
      hold({ reason: "epic" }),
      "Approve publishes nothing yet: this card waits for the epic.",
    ],
    [
      "draft",
      hold({ reason: "draft", title: "Tier limits" }),
      "Approve publishes nothing yet: this card waits for Tier limits.",
    ],
    [
      "cards",
      hold({ reason: "cards", left: 2 }),
      "Approve publishes nothing yet: this card waits for 2 more cards of the epic to be decided.",
    ],
    [
      "epic_short",
      hold({ reason: "epic_short", approved: 1, cards: 3 }),
      "Approve publishes nothing yet: the epic needs two approved cards · 1 of 3.",
    ],
    [
      "epic_short without cards",
      hold({ reason: "epic_short", approved: 0, cards: 0 }),
      "Approve publishes nothing yet: the epic has no cards.",
    ],
  ])("says what Approve waits for: %s", (_name, held, text) => {
    const result = line(draft("d9"), { approveHold: held });

    expect(result?.icon).toBe("hourglass");
    expect(result?.text).toBe(text);
  });

  it("says the epic is a draft that waits for its cards when the draft is the epic", () => {
    const result = line(epic, { approveHold: hold({ reason: "cards", left: 1 }) });

    expect(result?.text).toBe(
      "Approve publishes nothing yet: the epic waits for 1 more card of the epic to be decided.",
    );
  });

  it("says what Discard publishes alongside what Approve waits for", () => {
    const result = line(draft("d9"), {
      approveHold: hold({ reason: "epic" }),
      discardPublishes: ["d2"],
    });

    expect(result?.icon).toBe("chain");
    expect(result?.text).toBe(
      "Approve publishes nothing yet: this card waits for the epic. Discard publishes Overage on the monthly invoice now.",
    );
  });

  it("says the epic is discarded", () => {
    const result = line(draft("d9"), { approveHold: hold({ reason: "epic_discarded" }) });

    expect(result).toMatchObject({
      icon: "hourglass",
      text: "Approve publishes nothing: the epic is discarded, so this card won't publish.",
    });
  });

  it("says only what Discard publishes without more", () => {
    const result = line(draft("d9"), { discardPublishes: ["d1", "d2"] });

    expect(result).toMatchObject({
      icon: "chain",
      text: "Discard publishes the epic Tier limits and overage prices and Overage on the monthly invoice now.",
      segments: [
        { text: "Discard", strong: true },
        {
          text: " publishes the epic Tier limits and overage prices and Overage on the monthly invoice now.",
          strong: false,
        },
      ],
    });
  });

  it("says nothing when nothing publishes", () => {
    expect(line(draft("d9"))).toBeNull();
  });

  it("blocks on a repository the board left: a card, then an update", () => {
    expect(line(draft("d9", { repositoryId: "" }))).toMatchObject({
      icon: "blocked",
      text: "Can't publish: choose a repository of the board in Edit.",
    });
    expect(
      line(draft("d9", { repositoryId: "", kind: "update", repository: "acme/gateway" })),
    ).toMatchObject({
      icon: "blocked",
      text: "Can't publish: acme/gateway is no longer managed by the board.",
    });
  });

  it("blocks before anything else, even a chain", () => {
    const result = line(draft("d9", { repositoryId: "", approvePublishes: ["d9"] }));

    expect(result?.icon).toBe("blocked");
  });

  it.each([
    ["a decision", { decision: "approved" }],
    ["a started draft", { outcome: "created" }],
    ["no title", { title: "  " }],
  ])("isn't drawn for %s", (_name, overrides) => {
    expect(line(draft("d9", { approvePublishes: ["d9"], ...overrides }))).toBeNull();
  });

  it("isn't drawn during a run, or in edition", () => {
    const one = draft("d9", { approvePublishes: ["d9"] });

    expect(gestureLineOf(one, discussionOf([one], { publishing: true }), false)).toBeNull();
    expect(gestureLineOf(one, discussionOf([one]), true)).toBeNull();
  });
});

describe("decisionOf", () => {
  it("lets everything through on a draft to decide", () => {
    const one = draft("d1");

    expect(decisionOf(one, discussionOf([one]), false)).toEqual({
      shown: true,
      approveReason: null,
      discardReason: null,
      editReason: null,
    });
  });

  it("is absent on a started draft", () => {
    const one = draft("d1", { outcome: "created", decision: "approved" });

    expect(decisionOf(one, discussionOf([one]), false)).toEqual({
      shown: false,
      approveReason: null,
      discardReason: null,
      editReason: null,
    });
  });

  it("waits for a run: both decisions and Edit", () => {
    const one = draft("d1");

    expect(decisionOf(one, discussionOf([one], { publishing: true }), false)).toEqual({
      shown: true,
      approveReason: "A publication is running · the decision waits for it",
      discardReason: "A publication is running · the decision waits for it",
      editReason: "A publication is running",
    });
  });

  it("shows a draft in the run, with the reasons for the design to use", () => {
    const one = draft("d1", { publishing: true, decision: "approved" });

    expect(decisionOf(one, discussionOf([one], { publishing: true }), false).shown).toBe(true);
  });

  it("waits for the edition to finish", () => {
    const one = draft("d1");

    expect(decisionOf(one, discussionOf([one]), true)).toEqual({
      shown: true,
      approveReason: "Finish editing to decide",
      discardReason: "Finish editing to decide",
      editReason: null,
    });
  });

  it("asks for a title before Approve, and lets Discard through", () => {
    const one = draft("d1", { title: " " });

    expect(decisionOf(one, discussionOf([one]), false)).toMatchObject({
      approveReason: "Name the draft to approve it.",
      discardReason: null,
    });
  });

  it("stops Approve on a repository the board left with the text of the line", () => {
    const one = draft("d1", { repositoryId: "", kind: "update", repository: "acme/gateway" });

    expect(decisionOf(one, discussionOf([one]), false)).toMatchObject({
      approveReason: "Can't publish: acme/gateway is no longer managed by the board.",
      discardReason: null,
    });
  });

  it("doesn't stop the undo of a decision", () => {
    const one = draft("d1", { repositoryId: "", decision: "approved" });

    expect(decisionOf(one, discussionOf([one]), false).approveReason).toBeNull();
  });
});

describe("advanceAfter", () => {
  it.each<[string, Partial<Draft>, "approve" | "discard", "advance" | "stay"]>([
    ["approve without a decision, publishing nothing", {}, "approve", "advance"],
    ["discard without a decision, publishing nothing", {}, "discard", "advance"],
    ["approve that publishes", { approvePublishes: ["d1"] }, "approve", "stay"],
    ["discard that publishes", { discardPublishes: ["d2"] }, "discard", "stay"],
    ["approve when only discard publishes", { discardPublishes: ["d2"] }, "approve", "advance"],
    ["discard when only approve publishes", { approvePublishes: ["d1"] }, "discard", "advance"],
    ["approve of an approved draft: the undo", { decision: "approved" }, "approve", "stay"],
    ["discard of an approved draft: the swap", { decision: "approved" }, "discard", "stay"],
    ["approve of a discarded draft", { decision: "discarded" }, "approve", "stay"],
    [
      "an undo that would publish",
      { decision: "approved", approvePublishes: ["d1"] },
      "approve",
      "stay",
    ],
  ])("%s", (_name, overrides, key, expected) => {
    expect(advanceAfter(draft("d1", overrides), key)).toBe(expected);
  });
});

describe("bodyDiff", () => {
  it("has one entry per line of both texts", () => {
    expect(
      bodyDiff("Email and password.\nNo social login.\n", "Email and password.\nSSO too.\n"),
    ).toEqual([
      { kind: "same", text: "Email and password." },
      { kind: "removed", text: "No social login." },
      { kind: "added", text: "SSO too." },
    ]);
  });

  it("reads a body with no trailing newline as its lines alone", () => {
    expect(bodyDiff("One", "One\nTwo")).toEqual([
      { kind: "same", text: "One" },
      { kind: "added", text: "Two" },
    ]);
  });

  it("reads a body typed on GitHub by its lines, carriage returns and all", () => {
    expect(
      bodyDiff("Email and password.\r\nNo social login.\r\n", "Email and password.\nSSO too.\n"),
    ).toEqual([
      { kind: "same", text: "Email and password." },
      { kind: "removed", text: "No social login." },
      { kind: "added", text: "SSO too." },
    ]);
  });

  it("marks nothing when the two texts are the same", () => {
    expect(bodyDiff("One\nTwo\n", "One\nTwo\n")).toEqual([
      { kind: "same", text: "One" },
      { kind: "same", text: "Two" },
    ]);
  });

  it("is empty for two empty texts", () => {
    expect(bodyDiff("", "")).toEqual([]);
  });

  it("marks every line of a body written from nothing", () => {
    expect(bodyDiff("", "A button.\n")).toEqual([{ kind: "added", text: "A button." }]);
  });
});

describe("diffCount", () => {
  it("counts the lines added and removed, with the minus sign U+2212", () => {
    const lines = bodyDiff("a\nb\nc\nd\ne\n", "a\nx\ny\nz\nw\nq\n");

    expect(diffCount(lines)).toBe("+5 −4");
    expect(diffCount(lines)).toContain("−");
  });

  it("says only the side that changed", () => {
    expect(diffCount(bodyDiff("a\n", "a\nb\n"))).toBe("+1");
    expect(diffCount(bodyDiff("a\nb\n", "a\n"))).toBe("−1");
  });

  it("is empty without a change", () => {
    expect(diffCount(bodyDiff("a\n", "a\n"))).toBe("");
    expect(diffCount([])).toBe("");
  });
});

describe("groupable", () => {
  const epic = draft("d1", { kind: "epic", position: 1 });
  const members = draft("d2", { position: 2, ...inEpic("d1") });

  it("offers the loose cards of the current round, not started and not discarded, in the order of the card", () => {
    const discussion = discussionOf([
      epic,
      members,
      draft("d3", { position: 5 }),
      draft("d4", { position: 4 }),
      draft("d5", { position: 6, decision: "discarded" }),
      draft("d6", { position: 7, outcome: "created", decision: "approved", published: true }),
      draft("d7", { position: 8, round: 2 }),
    ]);

    expect(groupable(discussion).map((one) => one.id)).toEqual(["d4", "d3"]);
  });

  it("offers an approved card and a card of an epic on GitHub", () => {
    const toIssue = draft("d1", {
      position: 1,
      epic: makeDraftRef({ draft: "", key: "acme/billing#7", reference: "billing#7" }),
    });
    const approved = draft("d2", { position: 2, decision: "approved" });

    expect(groupable(discussionOf([toIssue, approved])).map((one) => one.id)).toEqual(["d1", "d2"]);
  });

  it("leaves out a card of an epic of another round, which is published with that epic", () => {
    const old = draft("d1", { kind: "epic", round: 1 });
    const toOld = draft("d2", { round: 2, position: 1, ...inEpic("d1") });
    const approved = draft("d3", { round: 2, position: 2, decision: "approved" });

    expect(
      groupable(discussionOf([old, toOld, approved], { round: 2 })).map((one) => one.id),
    ).toEqual(["d3"]);
  });

  it("is empty without a draft to group", () => {
    expect(groupable(discussionOf([epic]))).toEqual([]);
  });
});

describe("groupReason", () => {
  it.each([
    ["wants a title first", "  ", 3, "Name the epic to group the drafts."],
    ["wants two drafts", "Pricing", 1, "Pick two drafts or more."],
    ["wants two drafts, none picked", "Pricing", 0, "Pick two drafts or more."],
    ["groups", "Pricing", 2, null],
    ["takes 256 characters", "a".repeat(256), 2, null],
    [
      "refuses 257 characters",
      "a".repeat(257),
      2,
      "Use at most 256 characters in the title of the epic.",
    ],
    ["counts by code point", "😀".repeat(256), 2, null],
    [
      "counts by code point, above",
      "😀".repeat(257),
      2,
      "Use at most 256 characters in the title of the epic.",
    ],
    [
      "names the missing title before the long one's turn",
      "",
      5,
      "Name the epic to group the drafts.",
    ],
  ])("%s", (_name, title, picked, expected) => {
    expect(groupReason(title, picked)).toBe(expected);
  });

  it("says the missing pick before the length", () => {
    expect(groupReason("a".repeat(300), 1)).toBe("Pick two drafts or more.");
  });
});
