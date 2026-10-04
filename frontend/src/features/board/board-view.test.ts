import { describe, expect, it } from "vitest";
import {
  assigneesOf,
  type BoardFilters,
  boardRows,
  type CardSection,
  cardRowModel,
  defaultCollapsed,
  discussNotice,
  EMPTY_FILTERS,
  epicChildren,
  filterCards,
  filterChips,
  filteredTooltip,
  filtersActive,
  inDiscussion,
  isBoardViewMemory,
  isCheckable,
  keptFilters,
  NO_STATUS,
  namedFilters,
  newDiscussionNotice,
  noMatchSentence,
  type RowContext,
  readingView,
  sectionLabel,
  sections,
  sectionTooltip,
  selectionSuffix,
  selectNotice,
  showsFailureStrip,
  startable,
  startNotice,
  unsatisfied,
} from "@/features/board/board-view";
import {
  makeBoard,
  makeBoardCard,
  makeDiscussion,
  makeDiscussionCard,
  makeRepository,
  makeSituation,
  makeState,
  makeTask,
  makeWritingDiscussion,
} from "@/test/wails-mock";

const LOGIN = makeBoardCard({
  key: "dev/web#12",
  number: 12,
  title: "Tela de configuração",
  assignees: [{ login: "dev", avatarUrl: "" }],
});
const HEADER = makeBoardCard({
  key: "dev/api#7",
  repository: "dev/api",
  repositoryId: "repo-2",
  number: 7,
  title: "Fix the header",
  statusId: "",
  status: "",
  assignees: [{ login: "ana", avatarUrl: "" }],
});
const SHIPPED = makeBoardCard({
  key: "dev/web#3",
  number: 3,
  title: "Ship it",
  state: "closed",
});
const LATER = makeBoardCard({ key: "dev/web#20", number: 20, title: "Later" });

const BOARD = makeBoard({ cards: [SHIPPED, LOGIN, HEADER, LATER] });

function keys(cards: readonly { key: string }[]) {
  return cards.map((card) => card.key);
}

describe("filterCards", () => {
  it("lets every card through without filters", () => {
    expect(keys(filterCards(BOARD, EMPTY_FILTERS))).toEqual(keys(BOARD.cards ?? []));
  });

  it("matches the title ignoring case and accents", () => {
    const found = filterCards(BOARD, { ...EMPTY_FILTERS, query: "CONFIGURACAO" });

    expect(keys(found)).toEqual(["dev/web#12"]);
  });

  it("matches the number, with or without #", () => {
    expect(keys(filterCards(BOARD, { ...EMPTY_FILTERS, query: "#7" }))).toEqual(["dev/api#7"]);
    expect(keys(filterCards(BOARD, { ...EMPTY_FILTERS, query: "7" }))).toEqual(["dev/api#7"]);
  });

  it("filters by repository, status, no status and assignee", () => {
    expect(keys(filterCards(BOARD, { ...EMPTY_FILTERS, repository: "repo-2" }))).toEqual([
      "dev/api#7",
    ]);
    expect(keys(filterCards(BOARD, { ...EMPTY_FILTERS, status: NO_STATUS }))).toEqual([
      "dev/api#7",
    ]);
    expect(keys(filterCards(BOARD, { ...EMPTY_FILTERS, status: "todo" }))).toEqual([
      "dev/web#3",
      "dev/web#12",
      "dev/web#20",
    ]);
    expect(keys(filterCards(BOARD, { ...EMPTY_FILTERS, assignee: "ana" }))).toEqual(["dev/api#7"]);
  });

  it("keeps the cards of the viewer for Assigned to me, and none without a viewer", () => {
    expect(keys(filterCards(BOARD, { ...EMPTY_FILTERS, mine: true }))).toEqual(["dev/web#12"]);
    expect(filterCards({ ...BOARD, viewer: "" }, { ...EMPTY_FILTERS, mine: true })).toEqual([]);
  });

  it("combines the filters", () => {
    const found = filterCards(BOARD, { ...EMPTY_FILTERS, status: "todo", query: "later" });

    expect(keys(found)).toEqual(["dev/web#20"]);
  });
});

describe("sections", () => {
  it("keeps every status in board order, empty ones included, with the open cards first", () => {
    const result = sections(BOARD, [SHIPPED, LOGIN, LATER]);

    expect(result.map((section) => [section.id, keys(section.cards)])).toEqual([
      ["todo", ["dev/web#12", "dev/web#20", "dev/web#3"]],
      ["in-progress", []],
      ["done", []],
      [NO_STATUS, []],
    ]);
    expect(result[2]?.final).toBe(true);
  });

  it("keeps No status while the reading has a card without one, whatever the filters", () => {
    const result = sections(BOARD, [LOGIN]);

    expect(result.at(-1)).toMatchObject({ id: NO_STATUS, cards: [] });
  });

  it("leaves No status out when the reading has no card without one", () => {
    const board = makeBoard({ cards: [LOGIN, SHIPPED] });

    expect(sections(board, [LOGIN]).map((section) => section.id)).toEqual([
      "todo",
      "in-progress",
      "done",
    ]);
  });

  it("puts a card of an unknown status in No status", () => {
    const result = sections(BOARD, [HEADER]);

    expect(result.at(-1)).toMatchObject({ id: NO_STATUS, name: "No status", final: false });
    expect(keys(result.at(-1)?.cards ?? [])).toEqual(["dev/api#7"]);
  });

  it("gives a board without a Status field one section", () => {
    const result = sections({ ...BOARD, hasStatus: false, statuses: [] }, [SHIPPED, LOGIN]);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ id: "__all__", name: "Cards" });
    expect(keys(result[0]?.cards ?? [])).toEqual(["dev/web#12", "dev/web#3"]);
  });
});

describe("defaultCollapsed", () => {
  it("collapses the final statuses", () => {
    expect(defaultCollapsed(BOARD)).toEqual(["done"]);
  });
});

describe("isBoardViewMemory", () => {
  it("accepts a stored view, with or without the collapsed sections", () => {
    expect(isBoardViewMemory({ filters: EMPTY_FILTERS, collapsed: ["done"] })).toBe(true);
    expect(isBoardViewMemory({ filters: EMPTY_FILTERS })).toBe(true);
  });

  it("refuses anything of another shape", () => {
    expect(isBoardViewMemory(null)).toBe(false);
    expect(isBoardViewMemory({ filters: EMPTY_FILTERS, collapsed: [1] })).toBe(false);
    expect(isBoardViewMemory({ filters: EMPTY_FILTERS, collapsed: "done" })).toBe(false);
    expect(isBoardViewMemory({ filters: { query: "" }, collapsed: [] })).toBe(false);
  });
});

describe("assigneesOf and unsatisfied", () => {
  it("lists every assignee once, alphabetically", () => {
    expect(assigneesOf(makeBoard({ cards: [LOGIN, HEADER, LOGIN] }))).toEqual(["ana", "dev"]);
  });

  it("keeps the dependencies that are not satisfied", () => {
    const dependency = {
      key: "dev/web#1",
      repository: "dev/web",
      number: 1,
      title: "Schema",
      url: "",
      state: "open",
      status: "Todo",
      onBoard: true,
      pullRequests: [],
    };
    const card = makeBoardCard({
      dependencies: [
        { ...dependency, satisfied: false },
        { ...dependency, key: "dev/web#2", satisfied: true },
      ],
    });

    expect(keys(unsatisfied(card))).toEqual(["dev/web#1"]);
  });
});

describe("isCheckable", () => {
  const app = makeState({ repositories: [makeRepository({ boardId: "board-1" })] });

  it("takes a card whose repository the board manages", () => {
    expect(isCheckable(makeBoardCard(), app, "board-1")).toBe(true);
  });

  it("leaves out a card of another board, or of no repository at all", () => {
    expect(isCheckable(makeBoardCard(), app, "board-2")).toBe(false);
    expect(isCheckable(makeBoardCard({ repositoryId: "" }), app, "board-1")).toBe(false);
    expect(isCheckable(makeBoardCard({ repositoryId: "repo-9" }), app, "board-1")).toBe(false);
  });
});

describe("the memory of the filters", () => {
  const named: BoardFilters = {
    ...EMPTY_FILTERS,
    repository: "repo-1",
    repositoryName: "dev/web",
    status: "todo",
    statusName: "Todo",
  };

  it("accepts the filters kept with the names, and as they were kept before", () => {
    expect(isBoardViewMemory({ filters: named })).toBe(true);
    const { repositoryName: _r, statusName: _s, ...before } = named;
    expect(isBoardViewMemory({ filters: before })).toBe(true);
  });

  it("refuses a name that is not text", () => {
    expect(isBoardViewMemory({ filters: { ...named, repositoryName: 1 } })).toBe(false);
    expect(isBoardViewMemory({ filters: { ...named, statusName: null } })).toBe(false);
  });

  it("completes the names a former run did not keep", () => {
    const { repositoryName: _r, statusName: _s, ...before } = named;

    expect(keptFilters(before)).toEqual({ ...named, repositoryName: "", statusName: "" });
    expect(keptFilters(named)).toEqual(named);
  });

  describe("namedFilters", () => {
    const app = makeState({
      repositories: [makeRepository({ id: "repo-1", fullName: "dev/web" })],
    });
    const board = makeBoard();

    it("names the repository and the status from the reading", () => {
      const bare = { ...named, repositoryName: "", statusName: "" };

      expect(namedFilters(bare, board, app)).toEqual(named);
    });

    it("names No status", () => {
      const filters = { ...EMPTY_FILTERS, status: NO_STATUS };

      expect(namedFilters(filters, board, app).statusName).toBe("No status");
    });

    it("keeps the name the reading cannot tell", () => {
      const orphan = {
        ...EMPTY_FILTERS,
        repository: "gone",
        repositoryName: "dev/gone",
        status: "archived",
        statusName: "Archived",
      };

      expect(namedFilters(orphan, board, app)).toEqual(orphan);
    });

    it("keeps the name of a repository the board no longer has", () => {
      const filters = { ...named, repositoryName: "dev/old-name" };

      expect(namedFilters(filters, makeBoard({ repositoryIds: [] }), app).repositoryName).toBe(
        "dev/old-name",
      );
    });

    it("empties the name of a filter that was cleared", () => {
      expect(namedFilters({ ...EMPTY_FILTERS, repositoryName: "dev/web" }, board, app)).toEqual(
        EMPTY_FILTERS,
      );
    });
  });
});

describe("filtersActive", () => {
  it.each<[string, BoardFilters, boolean]>([
    ["nothing", EMPTY_FILTERS, false],
    ["blanks in the search", { ...EMPTY_FILTERS, query: "  " }, false],
    ["a search", { ...EMPTY_FILTERS, query: "a" }, true],
    ["Assigned to me", { ...EMPTY_FILTERS, mine: true }, true],
    ["a repository", { ...EMPTY_FILTERS, repository: "r" }, true],
    ["a status", { ...EMPTY_FILTERS, status: NO_STATUS }, true],
    ["an assignee", { ...EMPTY_FILTERS, assignee: "ana" }, true],
  ])("is decided by %s", (_, filters, want) => {
    expect(filtersActive(filters)).toBe(want);
  });
});

describe("filterChips", () => {
  const board = makeBoard({ repositoryIds: ["repo-1"] });

  it("has none without filters, and never one for the search or Assigned to me", () => {
    expect(filterChips({ ...EMPTY_FILTERS, query: "a", mine: true }, board)).toEqual([]);
  });

  it("orders the chips repository, assignee, status", () => {
    const filters: BoardFilters = {
      ...EMPTY_FILTERS,
      repository: "repo-1",
      repositoryName: "dev/web",
      assignee: "tchen",
      status: "todo",
      statusName: "Todo",
    };

    expect(filterChips(filters, board)).toEqual([
      {
        kind: "repository",
        label: "dev/web",
        removeLabel: "Remove the filter dev/web",
        orphan: null,
      },
      {
        kind: "assignee",
        label: "Assignee: tchen",
        removeLabel: "Remove the filter Assignee: tchen",
        orphan: null,
      },
      {
        kind: "status",
        label: "Status: Todo",
        removeLabel: "Remove the filter Status: Todo",
        orphan: null,
      },
    ]);
  });

  it("names the status of the cards without one", () => {
    const filters = { ...EMPTY_FILTERS, status: NO_STATUS, statusName: "No status" };

    expect(filterChips(filters, board)).toMatchObject([
      { label: "Status: No status", orphan: null },
    ]);
  });

  it("falls back on the id while the name is unknown", () => {
    const filters = { ...EMPTY_FILTERS, repository: "repo-1", status: "todo" };

    expect(filterChips(filters, board).map((chip) => chip.label)).toEqual([
      "repo-1",
      "Status: todo",
    ]);
  });

  it("tells a repository the board no longer has", () => {
    const filters = { ...EMPTY_FILTERS, repository: "gone", repositoryName: "dev/gone" };

    expect(filterChips(filters, board)[0]?.orphan).toBe(
      "dev/gone isn't a repository of this board anymore.",
    );
  });

  it("tells a status the board no longer has, only on a board with statuses", () => {
    const filters = { ...EMPTY_FILTERS, status: "gone", statusName: "Archived" };

    expect(filterChips(filters, board)[0]?.orphan).toBe(
      "Archived isn't a status of this board anymore.",
    );
    expect(
      filterChips(filters, makeBoard({ hasStatus: false, statuses: [] }))[0]?.orphan,
    ).toBeNull();
  });
});

describe("noMatchSentence and filteredTooltip", () => {
  const repository = { repository: "r", repositoryName: "acme/api" };
  const cases: { name: string; filters: Partial<BoardFilters>; want: string }[] = [
    {
      name: "the search",
      filters: { query: " refund " },
      want: 'Nothing on the board has "refund" in the title or the number.',
    },
    {
      name: "the repository",
      filters: repository,
      want: "Nothing on the board is in acme/api.",
    },
    {
      name: "a status",
      filters: { status: "ready", statusName: "Ready" },
      want: "Nothing on the board is in Ready.",
    },
    {
      name: "no status",
      filters: { status: NO_STATUS },
      want: "Nothing on the board has no status.",
    },
    {
      name: "an assignee",
      filters: { assignee: "tchen" },
      want: "Nothing on the board is assigned to tchen.",
    },
    {
      name: "Assigned to me",
      filters: { mine: true },
      want: "Nothing on the board is assigned to you.",
    },
    {
      name: "the search, then the repository",
      filters: { query: "a", ...repository },
      want: 'Nothing on the board has "a" in the title or the number, in acme/api.',
    },
    {
      name: "the repository, then a status",
      filters: { ...repository, status: "ready", statusName: "Ready" },
      want: "Nothing on the board is in acme/api, in Ready.",
    },
    {
      name: "the repository, then no status",
      filters: { ...repository, status: NO_STATUS },
      want: "Nothing on the board is in acme/api, with no status.",
    },
    {
      name: "the search, then an assignee",
      filters: { query: "refund", assignee: "tchen" },
      want: 'Nothing on the board has "refund" in the title or the number, assigned to tchen.',
    },
    {
      name: "a status, then Assigned to me",
      filters: { status: "ready", statusName: "Ready", mine: true },
      want: "Nothing on the board is in Ready, assigned to you.",
    },
    {
      name: "an assignee and Assigned to me",
      filters: { assignee: "tchen", mine: true },
      want: "Nothing on the board is assigned to tchen and to you.",
    },
    {
      name: "the assignee that is the viewer and Assigned to me",
      filters: { assignee: "gmartins", mine: true },
      want: "Nothing on the board is assigned to you.",
    },
    {
      name: "every part",
      filters: {
        query: "a",
        ...repository,
        status: "ready",
        statusName: "Ready",
        assignee: "tchen",
        mine: true,
      },
      want: 'Nothing on the board has "a" in the title or the number, in acme/api, in Ready, assigned to tchen and to you.',
    },
    {
      name: "the id while the name is unknown",
      filters: { repository: "repo-1" },
      want: "Nothing on the board is in repo-1.",
    },
  ];

  it.each(cases)("says $name", ({ filters, want }) => {
    expect(noMatchSentence({ ...EMPTY_FILTERS, ...filters }, "gmartins")).toBe(want);
  });

  it("says the board for no filter at all", () => {
    expect(noMatchSentence(EMPTY_FILTERS, "gmartins")).toBe("Nothing on the board.");
  });

  it("lists the parts of the sentence, one per line", () => {
    const filters = { ...EMPTY_FILTERS, query: "a", ...repository, mine: true };

    expect(filteredTooltip(filters, "gmartins")).toEqual([
      'has "a" in the title or the number',
      "in acme/api",
      "assigned to you",
    ]);
  });
});

describe("boardRows and the labels of a section", () => {
  const section = (id: string, cardsOf: string[], final = false): CardSection => ({
    id,
    name: id,
    final,
    cards: cardsOf.map((key) => makeBoardCard({ key })),
  });
  const all = [section("todo", ["a", "b"]), section("empty", []), section("done", ["c"], true)];

  it("walks each header, then the cards of an expanded section", () => {
    const rows = boardRows(all, new Set());

    expect(
      rows.map((row) => (row.kind === "section" ? `# ${row.section.id}` : row.card.key)),
    ).toEqual(["# todo", "a", "b", "# empty", "# done", "c"]);
  });

  it("leaves the cards of a collapsed section out, and keeps its header", () => {
    const rows = boardRows(all, new Set(["todo", "done"]));

    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatchObject({ kind: "section", collapsed: true });
    expect(rows[2]).toMatchObject({ kind: "section", collapsed: true });
  });

  it("never collapses an empty section", () => {
    const rows = boardRows(all, new Set(["empty"]));

    expect(rows[3]).toMatchObject({ kind: "section", collapsed: false });
    expect(rows).toHaveLength(6);
  });

  it("gives every card the section it is in", () => {
    const rows = boardRows(all, new Set());

    expect(rows[1]).toMatchObject({ kind: "card", sectionId: "todo" });
    expect(rows[5]).toMatchObject({ kind: "card", sectionId: "done" });
  });

  it.each([
    ["Backlog, 27 cards", { ...section("Backlog", []), cards: Array(27).fill(LOGIN) }],
    ["Ready, 1 card", { ...section("Ready", []), cards: [LOGIN] }],
    [
      "Done, 70 cards, final status",
      { ...section("Done", [], true), cards: Array(70).fill(LOGIN) },
    ],
    ["Ready, 0 cards", section("Ready", [])],
  ])("names a section %s", (label, value) => {
    expect(sectionLabel(value)).toBe(label);
  });

  it.each([
    [section("done", [], true), "A final status: folded when the board opens"],
    [section(NO_STATUS, []), "Cards without a status on the board"],
    [section("todo", []), null],
  ])("explains a section by its tooltip", (value, want) => {
    expect(sectionTooltip(value)).toBe(want);
  });
});

describe("epics and discussions of a card", () => {
  const epic = {
    key: "dev/web#100",
    repository: "dev/web",
    number: 100,
    title: "Usage-based billing",
    url: "",
    state: "open",
  };
  const sibling = (key: string, onBoard: boolean, state = "open") => ({
    key,
    repository: "dev/web",
    number: Number(key.split("#")[1]),
    title: key,
    url: "",
    state,
    status: "",
    onBoard,
  });
  const done = makeBoardCard({ key: "dev/web#1", number: 1, epic, final: true });
  const open = makeBoardCard({
    key: "dev/web#2",
    number: 2,
    epic,
    siblings: [sibling("dev/web#1", true), sibling("dev/web#3", false, "closed")],
  });
  const other = makeBoardCard({
    key: "dev/web#4",
    number: 4,
    epic,
    siblings: [sibling("dev/web#3", false, "closed"), sibling("dev/web#5", false)],
  });

  it("gathers the children of an epic: the reading, plus the siblings off the board, none twice", () => {
    const children = epicChildren([done, open, other, LOGIN]);

    expect(children.get("dev/web#100")).toEqual([
      { key: "dev/web#1", finished: true },
      { key: "dev/web#2", finished: false },
      { key: "dev/web#3", finished: true },
      { key: "dev/web#4", finished: false },
      { key: "dev/web#5", finished: false },
    ]);
    expect([...children.keys()]).toEqual(["dev/web#100"]);
  });

  it("finds the active discussions a card is in, in the order of the state", () => {
    const card = makeBoardCard({
      key: "dev/web#12",
      writtenBy: makeWritingDiscussion({ id: "writer" }),
    });
    const app = makeState({
      discussions: [
        makeDiscussion({ id: "writer", cards: [] }),
        makeDiscussion({ id: "entry", cards: [makeDiscussionCard({ key: "dev/web#12" })] }),
        makeDiscussion({ id: "other", cards: [makeDiscussionCard({ key: "dev/web#9" })] }),
      ],
    });

    expect(inDiscussion(card, app).map((discussion) => discussion.id)).toEqual(["writer", "entry"]);
  });

  it("counts a discussion once when it is both an entry and the writer", () => {
    const card = makeBoardCard({ writtenBy: makeWritingDiscussion({ id: "d" }) });
    const app = makeState({
      discussions: [makeDiscussion({ id: "d", cards: [makeDiscussionCard({ key: card.key })] })],
    });

    expect(inDiscussion(card, app)).toHaveLength(1);
  });

  it("leaves out an archived writer, and a writer that no longer exists", () => {
    const app = makeState({ discussions: [makeDiscussion({ id: "d", cards: [] })] });

    expect(
      inDiscussion(
        makeBoardCard({ writtenBy: makeWritingDiscussion({ id: "d", archived: true }) }),
        app,
      ),
    ).toEqual([]);
    expect(
      inDiscussion(makeBoardCard({ writtenBy: makeWritingDiscussion({ id: "gone" }) }), app),
    ).toEqual([]);
  });
});

describe("cardRowModel", () => {
  const NOW = Date.parse("2026-09-24T14:10:00Z");
  const dependency = (number: number, overrides = {}) => ({
    key: `dev/web#${number}`,
    repository: "dev/web",
    number,
    title: "Metering events from the gateway",
    url: "",
    state: "open",
    status: "Backlog",
    onBoard: true,
    pullRequests: [],
    satisfied: false,
    ...overrides,
  });
  const epicOf = {
    key: "dev/web#100",
    repository: "dev/web",
    number: 100,
    title: "Usage-based billing",
    url: "",
    state: "open",
  };
  const waiting = makeTask({
    id: "task-1",
    name: "412-rate-limit",
    situations: [makeSituation({ startedAt: "2026-09-24T13:52:00Z" })],
  });
  const quiet = makeTask({ id: "task-2", name: "quiet" });
  const baseApp = makeState({
    repositories: [makeRepository({ id: "repo-1", boardId: "board-1" })],
    tasks: [waiting, quiet],
  });
  const board = makeBoard({ id: "board-1" });

  const context = (overrides: Partial<RowContext> = {}): RowContext => ({
    app: baseApp,
    board,
    now: NOW,
    children: new Map(),
    cloneFor: null,
    ...overrides,
  });
  const card = (overrides = {}) =>
    makeBoardCard({ key: "dev/web#12", number: 12, title: "Usage alerts", ...overrides });

  it("has a plain row: the number, the title and the name", () => {
    const row = cardRowModel(card(), context());

    expect(row).toEqual({
      key: "dev/web#12",
      number: "#12",
      title: "Usage alerts",
      isEpic: false,
      dimmed: false,
      epic: null,
      dependency: null,
      task: null,
      canStart: true,
      canDiscuss: true,
      label: "#12 Usage alerts. dev/web. Todo",
    });
  });

  it("names a card without a status, and a closed one", () => {
    const row = cardRowModel(
      card({ status: "", statusId: "", state: "closed", action: "closed" }),
      context(),
    );

    expect(row.label).toBe("#12 Usage alerts. dev/web. No status. Closed");
    expect(row.canStart).toBe(false);
    expect(row.dimmed).toBe(true);
  });

  it("dims a closed issue only outside a final section", () => {
    expect(cardRowModel(card({ state: "closed", final: true }), context()).dimmed).toBe(false);
    expect(cardRowModel(card({ state: "open" }), context()).dimmed).toBe(false);
  });

  it("shows the epic of a card, whole in the tooltip", () => {
    const row = cardRowModel(card({ epic: epicOf }), context());

    expect(row.epic).toEqual({ text: "Usage-based billing", tooltip: "Usage-based billing" });
    expect(row.label).toContain(". epic Usage-based billing");
  });

  it("shows the progress of an epic", () => {
    const children = new Map([
      [
        "dev/web#12",
        [
          { key: "a", finished: true },
          { key: "b", finished: false },
        ],
      ],
    ]);
    const row = cardRowModel(card(), context({ children }));

    expect(row.isEpic).toBe(true);
    expect(row.epic).toEqual({ text: "Epic · 1 of 2 finished", tooltip: "Epic · 1 of 2 finished" });
    expect(row.label).toContain(". epic, 1 of 2 cards finished");
  });

  it("says the first dependency not satisfied, and every one in the tooltip", () => {
    const row = cardRowModel(
      card({
        dependencies: [
          dependency(461),
          dependency(462, { repository: "acme/gateway", status: "" }),
          dependency(463, { satisfied: true }),
        ],
      }),
      context(),
    );

    expect(row.dependency).toEqual({
      text: "#461 +1",
      tooltip: [
        "Depends on #461 Metering events from the gateway · open, Backlog. A warning: it never blocks.",
        "Depends on acme/gateway#462 Metering events from the gateway · open. A warning: it never blocks.",
      ],
    });
    expect(row.label).toContain(
      ". depends on #461, not satisfied. depends on acme/gateway#462, not satisfied",
    );
    expect(row.label).not.toContain("#463");
  });

  it("writes only the number of a dependency of another repository, which the tooltip names", () => {
    const row = cardRowModel(
      card({ dependencies: [dependency(7, { repository: "acme/gateway" })] }),
      context(),
    );

    expect(row.dependency).toEqual({
      text: "#7",
      tooltip: [
        "Depends on acme/gateway#7 Metering events from the gateway · open, Backlog. A warning: it never blocks.",
      ],
    });
    expect(row.label).toContain(". depends on acme/gateway#7, not satisfied");
  });

  describe("the task column", () => {
    it("says the task that waits: strong, with how long, and the others counted", () => {
      const task = makeTask({
        ...waiting,
        situations: [
          makeSituation({ startedAt: "2026-09-24T13:52:00Z" }),
          makeSituation({ id: "s2", startedAt: "2026-09-24T13:53:00Z" }),
        ],
      });
      const app = { ...baseApp, tasks: [task] };
      const row = cardRowModel(
        card({ activeTaskId: "task-1", action: "has_task" }),
        context({ app }),
      );

      expect(row.task).toEqual({
        kind: "task",
        tone: "wait",
        text: "Reply · PRD",
        strong: true,
        more: 1,
        tooltip: "412-rate-limit: Reply · PRD, waiting for you for 18 minutes",
      });
      expect(row.label).toContain(
        ". task 412-rate-limit: Reply · PRD, waiting for you for 18 minutes",
      );
      expect(row.canStart).toBe(false);
    });

    it("says a task that waits nothing, plainly", () => {
      const row = cardRowModel(card({ activeTaskId: "task-2", action: "has_task" }), context());

      expect(row.task).toEqual({
        kind: "task",
        tone: "idle",
        text: "PRD",
        strong: false,
        more: null,
        tooltip: "quiet: PRD",
      });
    });

    it("says a task that just started waiting in less than a minute", () => {
      const task = makeTask({
        ...waiting,
        situations: [makeSituation({ startedAt: "2026-09-24T14:10:00Z" })],
      });
      const row = cardRowModel(
        card({ activeTaskId: "task-1" }),
        context({ app: { ...baseApp, tasks: [task] } }),
      );

      expect(row.task).toMatchObject({
        tooltip: "412-rate-limit: Reply · PRD, waiting for you for less than a minute",
      });
    });

    it("says the discussions a card is in, where it has no task", () => {
      const app = {
        ...baseApp,
        discussions: [
          makeDiscussion({
            id: "a",
            title: "A",
            cards: [makeDiscussionCard({ key: "dev/web#12" })],
          }),
          makeDiscussion({
            id: "b",
            title: "B",
            cards: [makeDiscussionCard({ key: "dev/web#12" })],
          }),
        ],
      };
      const row = cardRowModel(card(), context({ app }));

      expect(row.task).toEqual({ kind: "discussion", tooltip: "In the discussions A and B" });
      expect(row.label).toContain(". in the discussions A and B");
    });

    it("says one discussion", () => {
      const app = {
        ...baseApp,
        discussions: [
          makeDiscussion({
            id: "a",
            title: "A",
            cards: [makeDiscussionCard({ key: "dev/web#12" })],
          }),
        ],
      };

      expect(cardRowModel(card(), context({ app })).task).toEqual({
        kind: "discussion",
        tooltip: "In the discussion A",
      });
    });

    it("lets the task win over a discussion", () => {
      const app = {
        ...baseApp,
        discussions: [
          makeDiscussion({ id: "a", cards: [makeDiscussionCard({ key: "dev/web#12" })] }),
        ],
      };
      const row = cardRowModel(card({ activeTaskId: "task-2" }), context({ app }));

      expect(row.task?.kind).toBe("task");
    });

    it("says nothing of a card written by an archived discussion", () => {
      const row = cardRowModel(
        card({ writtenBy: makeWritingDiscussion({ archived: true }) }),
        context({
          app: { ...baseApp, discussions: [makeDiscussion({ id: "discussion-1", cards: [] })] },
        }),
      );

      expect(row.task).toBeNull();
    });

    it("says the clone that runs and the clone that failed, before any task", () => {
      const asked = card({ activeTaskId: "task-2", repository: "acme/billing" });

      expect(
        cardRowModel(asked, context({ cloneFor: { key: asked.key, state: "cloning" } })).task,
      ).toEqual({ kind: "cloning", text: "Cloning acme/billing…" });
      expect(
        cardRowModel(asked, context({ cloneFor: { key: asked.key, state: "failed" } })).task,
      ).toEqual({ kind: "clone-failed" });
    });

    it("puts the clone that runs and the clone that failed in the name of the row", () => {
      const asked = card({ activeTaskId: "task-2", repository: "acme/billing" });

      expect(
        cardRowModel(asked, context({ cloneFor: { key: asked.key, state: "cloning" } })).label,
      ).toMatch(/\. Cloning acme\/billing…$/);
      expect(
        cardRowModel(asked, context({ cloneFor: { key: asked.key, state: "failed" } })).label,
      ).toMatch(/\. Clone failed$/);
    });

    it("leaves the clone of another card alone", () => {
      const row = cardRowModel(
        card(),
        context({ cloneFor: { key: "dev/web#99", state: "cloning" } }),
      );

      expect(row.task).toBeNull();
    });
  });

  describe("the keys", () => {
    it.each([
      ["start", true],
      ["clone", true],
      ["add_to_board", true],
      ["clone_missing", false],
      ["other_board", false],
      ["has_task", false],
      ["closed", false],
    ])("says S for %s: %s", (action, want) => {
      expect(startable(card({ action }))).toBe(want);
      expect(cardRowModel(card({ action }), context()).canStart).toBe(want);
    });

    it("says D for a card whose repository the board manages", () => {
      expect(cardRowModel(card(), context()).canDiscuss).toBe(true);
      expect(cardRowModel(card({ repositoryId: "repo-9" }), context()).canDiscuss).toBe(false);
    });
  });

  it("adds the state of the selection to the label", () => {
    expect(selectionSuffix("selected")).toBe(". selected");
    expect(selectionSuffix("not selected")).toBe(". not selected");
    expect(selectionSuffix("can't be selected")).toBe(". can't be selected");
  });
});

describe("the key notices", () => {
  const app = makeState({
    repositories: [makeRepository({ id: "repo-1", boardId: "board-1", path: "~/code/api" })],
    tasks: [makeTask({ id: "task-1", name: "412-rate-limit-per-api-key" })],
  });
  const card = (overrides = {}) =>
    makeBoardCard({ number: 412, repository: "acme/api", ...overrides });

  describe("S", () => {
    const cases: { name: string; card: Partial<ReturnType<typeof card>>; want: unknown }[] = [
      {
        name: "a card that has a task",
        card: { action: "has_task", activeTaskId: "task-1" },
        want: {
          title: "No task from #412",
          reason: "#412 already has a task: 412-rate-limit-per-api-key.",
        },
      },
      {
        name: "a closed card",
        card: { action: "closed" },
        want: { title: "No task from #412", reason: "The issue is closed." },
      },
      {
        name: "a card of another board",
        card: { action: "other_board", otherBoard: "Mobile App" },
        want: {
          title: "No task from #412",
          reason: "acme/api belongs to the board Mobile App.",
        },
      },
      {
        name: "a card whose clone is missing",
        card: { action: "clone_missing" },
        want: { title: "No task from #412", reason: "The clone at ~/code/api is missing." },
      },
      { name: "a card that starts", card: { action: "start" }, want: null },
      { name: "a card that clones", card: { action: "clone" }, want: null },
      { name: "a card that adds to the board", card: { action: "add_to_board" }, want: null },
    ];

    it.each(cases)("says $name", ({ card: overrides, want }) => {
      expect(startNotice(card(overrides), app, false)).toEqual(want);
    });

    it("says a card out of the reading, whatever its action", () => {
      expect(startNotice(card({ action: "start" }), app, true)).toEqual({
        title: "No task from #412",
        reason: "The card isn't in the last reading of the board.",
      });
    });
  });

  describe("D", () => {
    const acts = { outOfReading: false, selecting: false, selected: 0 };

    it("acts on a card the board manages", () => {
      expect(discussNotice(card({ repositoryId: "repo-1" }), app, "board-1", acts)).toBeNull();
    });

    it("says a card of a repository the board does not manage", () => {
      expect(discussNotice(card({ repositoryId: "repo-9" }), app, "board-1", acts)).toEqual({
        title: "#412 can't go into a discussion",
        reason: "acme/api isn't a repository of this board.",
      });
    });

    it("says a card out of the reading", () => {
      expect(
        discussNotice(card({ repositoryId: "repo-1" }), app, "board-1", {
          ...acts,
          outOfReading: true,
        }),
      ).toEqual({
        title: "#412 can't go into a discussion",
        reason: "The card isn't in the last reading of the board.",
      });
    });

    it("says no card is selected in the select mode", () => {
      expect(
        discussNotice(card(), app, "board-1", { ...acts, selecting: true, selected: 0 }),
      ).toEqual({ title: "No card is selected", reason: "Select a card with Space." });
      expect(discussNotice(null, app, "board-1", { ...acts, selecting: true })).toEqual({
        title: "No card is selected",
        reason: "Select a card with Space.",
      });
    });

    it("acts on the selection", () => {
      expect(
        discussNotice(card({ repositoryId: "repo-9" }), app, "board-1", {
          ...acts,
          selecting: true,
          selected: 2,
        }),
      ).toBeNull();
    });

    it("has nothing to say without a card", () => {
      expect(discussNotice(null, app, "board-1", acts)).toBeNull();
    });
  });

  describe("Space", () => {
    it("says a card of a repository the board does not manage", () => {
      expect(selectNotice(card({ repositoryId: "repo-9" }), app, "board-1")).toEqual({
        title: "#412 can't go into a discussion",
        reason: "acme/api isn't a repository of this board.",
      });
    });

    it("selects a card the board manages", () => {
      expect(selectNotice(card({ repositoryId: "repo-1" }), app, "board-1")).toBeNull();
    });
  });

  describe("N", () => {
    it("says a board never read", () => {
      expect(newDiscussionNotice(makeBoard({ readAt: "" }))).toEqual({
        title: "No discussion yet",
        reason: "The board hasn't been read yet.",
      });
    });

    it("acts on a board read", () => {
      expect(newDiscussionNotice(makeBoard())).toBeNull();
    });
  });
});

describe("the states of the reading", () => {
  const failure = { reason: "gh", message: "gh failed", failedAt: "2026-09-24T14:06:00Z" };
  const read = { readAt: "2026-09-24T14:08:00Z" };
  const never = { readAt: "" };
  const cases: {
    name: string;
    board: Partial<ReturnType<typeof makeBoard>>;
    filtered?: readonly ReturnType<typeof makeBoardCard>[];
    view: string;
    strip: boolean;
  }[] = [
    {
      name: "never read, reading",
      board: { ...never, reading: true },
      view: "skeleton",
      strip: false,
    },
    {
      name: "never read, reading again after a failure",
      board: { ...never, reading: true, failure },
      view: "skeleton",
      strip: false,
    },
    {
      name: "never read, failed",
      board: { ...never, failure },
      view: "never-read-failed",
      strip: false,
    },
    { name: "never read, nothing yet", board: never, view: "skeleton", strip: false },
    { name: "read, no cards", board: { ...read, cards: [] }, view: "no-cards", strip: false },
    {
      name: "read, no cards, the last reading failed",
      board: { ...read, cards: [], failure },
      view: "no-cards",
      strip: true,
    },
    {
      name: "read, no card passes",
      board: { ...read, cards: [LOGIN] },
      filtered: [],
      view: "no-match",
      strip: false,
    },
    {
      name: "read, no card passes, the last reading failed",
      board: { ...read, cards: [LOGIN], failure },
      filtered: [],
      view: "no-match",
      strip: true,
    },
    {
      name: "read, cards",
      board: { ...read, cards: [LOGIN] },
      filtered: [LOGIN],
      view: "list",
      strip: false,
    },
    {
      name: "read, reading again",
      board: { ...read, cards: [LOGIN], reading: true },
      filtered: [LOGIN],
      view: "list",
      strip: false,
    },
    {
      name: "read, cards, the last reading failed",
      board: { ...read, cards: [LOGIN], failure },
      filtered: [LOGIN],
      view: "list",
      strip: true,
    },
  ];

  it.each(cases)("is $view for a board $name", ({ board, filtered = [], view, strip }) => {
    const value = makeBoard(board);

    expect(readingView(value, filtered).kind).toBe(view);
    expect(showsFailureStrip(value)).toBe(strip);
  });
});
