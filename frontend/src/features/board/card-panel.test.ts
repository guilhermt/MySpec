import { describe, expect, it } from "vitest";
import { epicChildren } from "@/features/board/board-view";
import {
  type CardPanelContext,
  type CloneState,
  cardPanelModel,
  dependencyNotice,
  outOfReadingText,
  type PanelActions,
} from "@/features/board/card-panel";
import type { BoardCard } from "@/lib/wails";
import {
  makeArchivedTask,
  makeBoard,
  makeBoardCard,
  makeDiscussion,
  makeDiscussionCard,
  makeRepository,
  makeState,
  makeTask,
  makeWritingDiscussion,
} from "@/test/wails-mock";

const REPOSITORY = makeRepository({
  id: "repo-1",
  fullName: "acme/api",
  path: "~/code/api",
  boardId: "board-1",
});

const APP = makeState({
  repositories: [REPOSITORY],
  tasks: [makeTask({ id: "task-1", name: "412-rate-limit" })],
  history: [makeArchivedTask({ id: "old-task", name: "400-old" })],
});

const IDLE: CloneState = { cloning: false, error: null, opensDialog: false };

function context(card: BoardCard, overrides: Partial<CardPanelContext> = {}): CardPanelContext {
  const board = overrides.board ?? makeBoard({ id: "board-1", cards: [card] });
  return {
    app: APP,
    board,
    children: epicChildren(board.cards ?? []),
    clone: IDLE,
    outOfReading: false,
    ...overrides,
  };
}

const cardOf = (overrides: Partial<BoardCard> = {}) =>
  makeBoardCard({
    key: "acme/api#474",
    repository: "acme/api",
    number: 474,
    title: "Usage alerts at 80% of the plan",
    ...overrides,
  });

const actionsOf = (card: BoardCard, overrides: Partial<CardPanelContext> = {}) =>
  cardPanelModel(card, context(card, overrides)).actions;

describe("the actions of the panel", () => {
  const cases: {
    name: string;
    card: Partial<BoardCard>;
    context?: Partial<CardPanelContext>;
    want: PanelActions;
  }[] = [
    {
      name: "a card out of the reading",
      card: { action: "start" },
      context: { outOfReading: true },
      want: {
        primary: { kind: "start", disabled: true },
        changePath: false,
        discuss: { disabled: true },
        reason: null,
        discussReason: null,
      },
    },
    {
      name: "start",
      card: { action: "start" },
      want: {
        primary: { kind: "start", disabled: false },
        changePath: false,
        discuss: { disabled: false },
        reason: null,
        discussReason: null,
      },
    },
    {
      name: "clone, idle",
      card: { action: "clone" },
      want: {
        primary: { kind: "clone" },
        changePath: false,
        discuss: { disabled: false },
        reason: { text: "acme/api isn't cloned yet. A task needs a clone.", tone: "neutral" },
        discussReason: null,
      },
    },
    {
      name: "clone, running",
      card: { action: "clone" },
      context: { clone: { cloning: true, error: null, opensDialog: true } },
      want: {
        primary: { kind: "cloning", repository: "acme/api" },
        changePath: false,
        discuss: { disabled: false },
        reason: {
          text: "The dialog opens when the clone ends. You can leave the board meanwhile.",
          tone: "neutral",
        },
        discussReason: null,
      },
    },
    {
      name: "clone, running for a card that did not ask",
      card: { action: "clone" },
      context: { clone: { cloning: true, error: null, opensDialog: false } },
      want: {
        primary: { kind: "cloning", repository: "acme/api" },
        changePath: false,
        discuss: { disabled: false },
        reason: { text: "The clone is running.", tone: "neutral" },
        discussReason: null,
      },
    },
    {
      name: "clone, failed",
      card: { action: "clone" },
      context: {
        clone: { cloning: false, error: "gh: repository not found", opensDialog: false },
      },
      want: {
        primary: { kind: "retry-clone" },
        changePath: false,
        discuss: { disabled: false },
        reason: { text: "gh: repository not found", tone: "error" },
        discussReason: null,
      },
    },
    {
      name: "clone_missing",
      card: { action: "clone_missing" },
      want: {
        primary: { kind: "start", disabled: true },
        changePath: true,
        discuss: { disabled: false },
        reason: { text: "The clone at ~/code/api is missing.", tone: "neutral" },
        discussReason: null,
      },
    },
    {
      name: "add_to_board",
      card: { action: "add_to_board" },
      want: {
        primary: { kind: "add" },
        changePath: false,
        discuss: { disabled: true },
        reason: {
          text: "acme/api isn't managed by this board. Start task adds it first.",
          tone: "neutral",
        },
        discussReason: "acme/api isn't a repository of this board.",
      },
    },
    {
      name: "other_board",
      card: { action: "other_board", otherBoard: "Mobile App" },
      want: {
        primary: { kind: "start", disabled: true },
        changePath: false,
        discuss: { disabled: true },
        reason: { text: "acme/api belongs to the board Mobile App.", tone: "neutral" },
        discussReason: "acme/api isn't a repository of this board.",
      },
    },
    {
      name: "has_task",
      card: { action: "has_task", activeTaskId: "task-1" },
      want: {
        primary: null,
        changePath: false,
        discuss: { disabled: false },
        reason: null,
        discussReason: null,
      },
    },
    {
      name: "closed",
      card: { action: "closed", state: "closed" },
      want: {
        primary: null,
        changePath: false,
        discuss: { disabled: false },
        reason: { text: "The issue is closed.", tone: "neutral" },
        discussReason: null,
      },
    },
    {
      name: "a card of a repository the board does not manage",
      card: { action: "start", repositoryId: "repo-9" },
      want: {
        primary: { kind: "start", disabled: false },
        changePath: false,
        discuss: { disabled: true },
        reason: null,
        discussReason: "acme/api isn't a repository of this board.",
      },
    },
  ];

  it.each(cases)("is right for $name", ({ card, context: overrides, want }) => {
    expect(actionsOf(cardOf({ repositoryId: "repo-1", ...card }), overrides)).toEqual(want);
  });

  it("has at most one primary in every case", () => {
    for (const { card, context: overrides } of cases) {
      const actions = actionsOf(cardOf({ repositoryId: "repo-1", ...card }), overrides);

      expect([actions.primary].filter((primary) => primary !== null).length).toBeLessThanOrEqual(1);
    }
  });
});

describe("the head, the status and the dependencies", () => {
  it("heads the panel with the number and the repository", () => {
    const model = cardPanelModel(cardOf(), context(cardOf()));

    expect(model.head).toEqual({ number: "#474", repository: "acme/api" });
    expect(model.title).toBe("Usage alerts at 80% of the plan");
  });

  it.each([
    [{ status: "Ready" }, { name: "Ready", closed: false, epic: null }],
    [
      { status: "", statusId: "" },
      { name: "No status", closed: false, epic: null },
    ],
    [
      { status: "Done", state: "closed" },
      { name: "Done", closed: true, epic: null },
    ],
    [
      {
        status: "Ready",
        epic: {
          key: "acme/api#400",
          repository: "acme/api",
          number: 400,
          title: "Usage-based billing",
          url: "",
          state: "open",
        },
      },
      { name: "Ready", closed: false, epic: "Usage-based billing" },
    ],
  ])("says the status of %j", (overrides, want) => {
    const card = cardOf(overrides);

    expect(cardPanelModel(card, context(card)).status).toEqual(want);
  });

  describe("the dependencies not satisfied", () => {
    const dependency = (overrides = {}) => ({
      key: "acme/gateway#461",
      repository: "acme/gateway",
      number: 461,
      title: "Metering events from the gateway",
      url: "",
      state: "open",
      status: "Backlog",
      onBoard: true,
      pullRequests: [],
      satisfied: false,
      ...overrides,
    });
    const notice = (overrides = {}) =>
      cardPanelModel(cardOf({ dependencies: [dependency(overrides)] }), context(cardOf()))
        .dependencies[0];
    const pr = (number: number, state: string, repository = "acme/gateway") => ({
      repository,
      number,
      url: `https://github.com/${repository}/pull/${number}`,
      state,
    });

    it("warns with the repository, the state, the status and the pull requests", () => {
      expect(notice()).toEqual({
        key: "acme/gateway#461",
        title: "Depends on acme/gateway#461",
        issueTitle: "Metering events from the gateway",
        meta: "acme/gateway · Open · Backlog · no pull request. A warning only: it never blocks.",
      });
    });

    it("names the dependency of the repository of the card #461", () => {
      const own = cardPanelModel(
        cardOf({ dependencies: [dependency({ repository: "acme/api", key: "acme/api#461" })] }),
        context(cardOf()),
      ).dependencies[0];

      expect(own?.title).toBe("Depends on #461");
    });

    it.each([
      ["a pull request open", [pr(88, "open")], "pull request #88 · Open"],
      [
        "a pull request of another repository",
        [pr(88, "closed", "acme/web")],
        "pull request acme/web#88 · Closed",
      ],
      ["two pull requests", [pr(88, "open"), pr(89, "closed")], "2 pull requests, none merged"],
    ])("says %s", (_, pullRequests, text) => {
      expect(notice({ pullRequests })?.meta).toBe(
        `acme/gateway · Open · Backlog · ${text}. A warning only: it never blocks.`,
      );
    });

    it("leaves the status out without one on the board", () => {
      expect(notice({ status: "" })?.meta).toBe(
        "acme/gateway · Open · no pull request. A warning only: it never blocks.",
      );
    });

    it("tells the dialog the task can start", () => {
      expect(dependencyNotice(dependency(), "acme/api", "dialog").meta).toBe(
        "acme/gateway · Open · Backlog · no pull request. A warning only: the task can start.",
      );
    });

    it("leaves out the dependencies that are satisfied", () => {
      const card = cardOf({ dependencies: [dependency({ satisfied: true })] });

      expect(cardPanelModel(card, context(card)).dependencies).toEqual([]);
    });
  });
});

describe("the task and the discussions", () => {
  it("shows the active task", () => {
    const card = cardOf({ action: "has_task", activeTaskId: "task-1" });

    expect(cardPanelModel(card, context(card)).task).toEqual({ kind: "active", taskId: "task-1" });
  });

  it("shows the archived task by its name when there is no active one", () => {
    const card = cardOf({ archivedTaskId: "old-task" });

    expect(cardPanelModel(card, context(card)).task).toEqual({
      kind: "archived",
      taskId: "old-task",
      name: "400-old",
    });
  });

  it("shows none without either", () => {
    expect(cardPanelModel(cardOf(), context(cardOf())).task).toBeNull();
  });

  it("shows the active discussions, then the archived writer", () => {
    const card = cardOf({
      writtenBy: makeWritingDiscussion({ id: "old", title: "Usage alerts", archived: true }),
    });
    const app = {
      ...APP,
      discussions: [
        makeDiscussion({
          id: "d1",
          title: "Usage-based pricing tiers",
          cards: [makeDiscussionCard({ key: card.key })],
        }),
      ],
    };

    expect(cardPanelModel(card, context(card, { app })).discussions).toEqual([
      { id: "d1", title: "Usage-based pricing tiers", archived: false },
      { id: "old", title: "Usage alerts", archived: true },
    ]);
  });

  it("shows an active writer as active, and none when there is none", () => {
    const card = cardOf({ writtenBy: makeWritingDiscussion({ id: "d1", title: "Writer" }) });
    const app = { ...APP, discussions: [makeDiscussion({ id: "d1", title: "Writer", cards: [] })] };

    expect(cardPanelModel(card, context(card, { app })).discussions).toEqual([
      { id: "d1", title: "Writer", archived: false },
    ]);
    expect(cardPanelModel(cardOf(), context(cardOf())).discussions).toEqual([]);
  });
});

describe("the fields and the body", () => {
  it("lists the fields in order, the assignees last", () => {
    const card = cardOf({
      fields: [
        { name: "Module", value: "Billing" },
        { name: "Estimate", value: "5" },
      ],
      assignees: [
        { login: "tchen", avatarUrl: "" },
        { login: "ana", avatarUrl: "" },
      ],
      body: "Alert at 80%.",
    });
    const model = cardPanelModel(card, context(card));

    expect(model.fields).toEqual([
      { key: "Module", value: "Billing" },
      { key: "Estimate", value: "5" },
      { key: "Assignees", value: "tchen, ana" },
    ]);
    expect(model.body).toBe("Alert at 80%.");
  });

  it("has no field without fields and assignees", () => {
    expect(cardPanelModel(cardOf(), context(cardOf())).fields).toEqual([]);
  });
});

describe("the relations", () => {
  const issue = (number: number, overrides = {}) => ({
    key: `acme/api#${number}`,
    repository: "acme/api",
    number,
    title: `Card ${number}`,
    url: `https://github.com/acme/api/issues/${number}`,
    state: "open",
    ...overrides,
  });
  const sibling = (number: number, overrides = {}) => ({
    ...issue(number),
    status: "Ready",
    onBoard: true,
    ...overrides,
  });
  const EPIC = issue(400, { title: "Usage-based billing" });
  const groups = (card: BoardCard, cards: BoardCard[]) =>
    cardPanelModel(card, context(card, { board: makeBoard({ id: "board-1", cards }) })).relations;

  it("has no group without relations", () => {
    expect(groups(cardOf(), [cardOf()])).toEqual([]);
  });

  it("tells the epic with its progress, and the cards of the epic", () => {
    const epic = cardOf({ key: "acme/api#400", number: 400, title: "Usage-based billing" });
    const done = cardOf({
      key: "acme/api#401",
      number: 401,
      epic: EPIC,
      final: true,
      statusId: "done",
      status: "Done",
    });
    const open = cardOf({
      key: "acme/api#402",
      number: 402,
      epic: EPIC,
      siblings: [
        sibling(401, { status: "Done" }),
        sibling(403, { onBoard: false, status: "", state: "closed" }),
      ],
    });

    expect(groups(open, [epic, done, open])).toEqual([
      {
        label: "Epic",
        items: [
          {
            key: "acme/api#400",
            number: "#400",
            title: "Usage-based billing",
            meta: "2 of 3 finished",
            url: EPIC.url,
            cardKey: "acme/api#400",
          },
        ],
      },
      {
        label: "Cards of the epic · 2",
        items: [
          {
            key: "acme/api#401",
            number: "#401",
            title: "Card 401",
            meta: "Done",
            url: issue(401).url,
            cardKey: "acme/api#401",
          },
          {
            key: "acme/api#403",
            number: "#403",
            title: "Card 403",
            meta: "Closed",
            url: issue(403).url,
          },
        ],
      },
    ]);
  });

  it("tells the children of an epic, with the siblings off the board", () => {
    const epic = cardOf({ key: "acme/api#400", number: 400, title: "Usage-based billing" });
    const one = cardOf({
      key: "acme/api#401",
      number: 401,
      epic: EPIC,
      status: "Ready",
      siblings: [sibling(403, { onBoard: false, status: "", state: "open" })],
    });

    const [kids] = groups(epic, [epic, one]);

    expect(kids).toEqual({
      label: "Cards · 2",
      items: [
        {
          key: "acme/api#401",
          number: "#401",
          title: one.title,
          meta: "Ready",
          url: one.url,
          cardKey: "acme/api#401",
        },
        {
          key: "acme/api#403",
          number: "#403",
          title: "Card 403",
          meta: "Open",
          url: issue(403).url,
        },
      ],
    });
  });

  it("tells the dependencies with their state, the pull request that merged, and the warning", () => {
    const dependency = (number: number, overrides = {}) => ({
      ...sibling(number),
      status: "Backlog",
      pullRequests: [],
      satisfied: false,
      ...overrides,
    });
    const card = cardOf({
      dependencies: [
        dependency(461),
        dependency(462, {
          satisfied: true,
          pullRequests: [{ repository: "acme/api", number: 88, url: "", state: "merged" }],
        }),
        dependency(463, { satisfied: true, state: "closed", status: "Done" }),
      ],
    });

    const [group] = groups(card, [card]);

    expect(group?.label).toBe("Dependencies");
    expect(group?.items.map(({ number, meta, warning }) => ({ number, meta, warning }))).toEqual([
      { number: "#461", meta: "Open · Backlog", warning: "Not satisfied" },
      { number: "#462", meta: "Open · Backlog · merged #88", warning: undefined },
      { number: "#463", meta: "Closed · Done", warning: undefined },
    ]);
  });

  it("tells the pull requests, the repository before the number when it is another", () => {
    const card = cardOf({
      pullRequests: [
        { repository: "acme/api", number: 1291, url: "https://x/1291", state: "open" },
        { repository: "acme/web", number: 7, url: "https://x/7", state: "merged" },
      ],
    });

    expect(groups(card, [card])).toEqual([
      {
        label: "Pull requests",
        items: [
          {
            key: "https://x/1291",
            number: "#1291",
            title: "",
            meta: "Open",
            url: "https://x/1291",
          },
          {
            key: "https://x/7",
            number: "acme/web#7",
            title: "",
            meta: "Merged",
            url: "https://x/7",
          },
        ],
      },
    ]);
  });
});

describe("outOfReadingText", () => {
  const board = (readAt: string) => makeBoard({ readAt });
  const NOW = new Date(2026, 8, 24, 14, 10).getTime();

  it.each([
    ["today", new Date(2026, 8, 24, 14, 8).toISOString(), "14:08"],
    ["yesterday", new Date(2026, 8, 23, 17, 40).toISOString(), "yesterday at 17:40"],
    ["before", new Date(2026, 8, 21, 17, 40).toISOString(), "Sep 21 at 17:40"],
  ])("names the reading of %s", (_, readAt, moment) => {
    expect(outOfReadingText(board(readAt), NOW)).toBe(
      `It left the board, or its issue closed more than 14 days ago. The reading of ${moment} doesn't have it, so a task or a discussion can't start from it.`,
    );
  });
});
