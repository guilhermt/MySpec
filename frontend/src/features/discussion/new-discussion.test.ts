import { describe, expect, it } from "vitest";
import {
  BOARD_FIELD_HELP,
  boardLine,
  boardOptions,
  codePoints,
  contextCharacters,
  contextLine,
  defaultDiscussionBoard,
  lastUsedBoard,
  startReason,
  suggestedTitle,
  TITLE_MAX,
  titleError,
  titleHelp,
  unclonedRepositories,
  whatHint,
} from "@/features/discussion/new-discussion";
import type { BoardCard } from "@/lib/wails";
import {
  makeArchivedDiscussion,
  makeBoard,
  makeBoardCard,
  makeDiscussion,
  makeRepository,
  makeState,
} from "@/test/wails-mock";

const CARD = makeBoardCard();
const OTHER = makeBoardCard({ key: "dev/web#13", number: 13, title: "Reset the password" });

describe("suggestedTitle", () => {
  it("is the title of the one card picked", () => {
    expect(suggestedTitle([CARD])).toBe("Add the login screen");
  });

  it("is empty with several cards, which have no title of their own", () => {
    expect(suggestedTitle([CARD, OTHER])).toBe("");
  });

  it("is empty without cards", () => {
    expect(suggestedTitle([])).toBe("");
  });
});

describe("codePoints", () => {
  it("counts by code point, as the Go side does", () => {
    expect(codePoints("abc")).toBe(3);
    expect(codePoints("a😀b")).toBe(3);
  });
});

describe("titleHelp", () => {
  it("is silent before 100 characters", () => {
    expect(titleHelp("a".repeat(99))).toBe("");
  });

  it("says how much of the 120 is used from 100 on", () => {
    expect(titleHelp("a".repeat(100))).toBe("100 of 120");
    expect(titleHelp("a".repeat(104))).toBe("104 of 120");
  });

  it("counts an emoji as one character, and leaves the spaces at the edges out", () => {
    expect(titleHelp(`  ${"😀".repeat(100)}  `)).toBe("100 of 120");
  });
});

describe("titleError", () => {
  it("takes a title up to 120 characters", () => {
    expect(titleError("a".repeat(TITLE_MAX))).toBeNull();
    expect(titleError("😀".repeat(TITLE_MAX))).toBeNull();
  });

  it("refuses a title above 120 characters, by code point", () => {
    expect(titleError("a".repeat(TITLE_MAX + 1))).toBe("Use at most 120 characters.");
    expect(titleError("😀".repeat(TITLE_MAX + 1))).toBe("Use at most 120 characters.");
  });

  it("has nothing to say of an empty title, which startReason names", () => {
    expect(titleError("")).toBeNull();
  });
});

describe("startReason", () => {
  const ready = { board: "board-1", title: "Billing", text: "The invoices", cards: 0 };

  it.each([
    ["starts with text, a title and a board", ready, null],
    ["starts with cards and no text", { ...ready, text: "  ", cards: 1 }, null],
    [
      "wants something to discuss before anything else",
      { board: null, title: "", text: " ", cards: 0 },
      "Write what to discuss or select at least one card.",
    ],
    ["wants a title", { ...ready, title: "  " }, "Name the discussion to start it."],
    [
      "wants a title that fits",
      { ...ready, title: "a".repeat(121) },
      "Use at most 120 characters.",
    ],
    ["wants a board", { ...ready, board: null }, "Choose a board."],
    [
      "names the title before the board",
      { ...ready, board: null, title: "" },
      "Name the discussion to start it.",
    ],
  ])("%s", (_name, input, expected) => {
    expect(startReason(input)).toBe(expected);
  });
});

describe("contextCharacters", () => {
  it("counts code points with the English thousands separator", () => {
    expect(contextCharacters("a".repeat(5690))).toBe("5,690 characters");
    expect(contextCharacters("😀".repeat(3))).toBe("3 characters");
  });

  it("is singular for one", () => {
    expect(contextCharacters("a")).toBe("1 character");
  });
});

describe("contextLine", () => {
  const epic = {
    key: "dev/web#400",
    repository: "dev/web",
    number: 400,
    title: "Usage-based billing",
    url: "",
    state: "open",
  };
  const other = { ...epic, key: "dev/web#500", number: 500, title: "Mobile" };
  const sibling = (number: number) => ({
    key: `dev/web#${number}`,
    repository: "dev/web",
    number,
    title: `Card ${number}`,
    url: "",
    state: "open",
    status: "Todo",
    onBoard: true,
  });
  const dependency = (number: number) => ({
    ...sibling(number),
    pullRequests: [],
    satisfied: false,
  });
  const card = (number: number, overrides: Partial<BoardCard> = {}) =>
    makeBoardCard({ key: `dev/web#${number}`, number, ...overrides });
  const chars = "a".repeat(5690);

  it.each([
    ["one card alone", [card(474)], "From the card: #474 · 5,690 characters"],
    ["two cards alone", [card(455), card(461)], "From the cards: #455 and #461 · 5,690 characters"],
    [
      "three cards alone",
      [card(455), card(461), card(470)],
      "From the cards: #455, #461 and #470 · 5,690 characters",
    ],
    [
      "an epic, its cards and a dependency",
      [
        card(455, {
          epic,
          siblings: [sibling(456), sibling(457)],
          dependencies: [dependency(300)],
        }),
        card(461, { epic, siblings: [sibling(457), sibling(458), sibling(455)] }),
      ],
      "From the cards: #455, #461, the epic Usage-based billing, 3 cards of the epic and 1 dependency · 5,690 characters",
    ],
    [
      "one sibling and two dependencies",
      [
        card(455, {
          epic,
          siblings: [sibling(456)],
          dependencies: [dependency(300), dependency(301)],
        }),
      ],
      "From the card: #455, the epic Usage-based billing, 1 card of the epic and 2 dependencies · 5,690 characters",
    ],
    [
      "two epics",
      [
        card(455, { epic, siblings: [sibling(456), sibling(457)] }),
        card(461, {
          epic: other,
          siblings: [sibling(462), sibling(463), sibling(464), sibling(465)],
        }),
      ],
      "From the cards: #455, #461, 2 epics and 6 cards of the epics · 5,690 characters",
    ],
    [
      "a dependency that is a card picked",
      [card(455, { dependencies: [dependency(461)] }), card(461)],
      "From the cards: #455 and #461 · 5,690 characters",
    ],
  ])("says %s", (_name, cards, expected) => {
    expect(contextLine(cards, chars)).toBe(expected);
  });

  it("says the board and the text without cards", () => {
    expect(contextLine([], "a".repeat(1240))).toBe(
      "From the board and your text · 1,240 characters",
    );
  });

  it("has no count while the context hasn't come", () => {
    expect(contextLine([], null)).toBe("From the board and your text");
    expect(contextLine([card(474)], null)).toBe("From the card: #474");
  });
});

describe("boardLine", () => {
  it("is the owner, the project and the short names of the repositories alphabetically", () => {
    const board = makeBoard({
      owner: "acme",
      number: 7,
      repositoryIds: ["r-web", "r-api", "r-billing", "r-gone"],
    });
    const repositories = [
      makeRepository({ id: "r-web", fullName: "acme/web" }),
      makeRepository({ id: "r-api", fullName: "acme/api" }),
      makeRepository({ id: "r-billing", fullName: "acme/billing" }),
    ];

    expect(boardLine(board, repositories)).toBe("acme · project 7 · api, billing, web");
  });

  it("leaves the repositories out when the board has none", () => {
    expect(boardLine(makeBoard({ owner: "acme", number: 7, repositoryIds: [] }), [])).toBe(
      "acme · project 7",
    );
  });
});

describe("whatHint", () => {
  it("is optional with cards, and asks for cards without", () => {
    expect(whatHint(2)).toBe("optional with cards");
    expect(whatHint(0)).toBe("or pick cards on the board");
  });
});

describe("unclonedRepositories", () => {
  it("keeps the repositories of the board without a clone, and those whose clone is gone", () => {
    const board = makeBoard({ repositoryIds: ["repo-1", "repo-2", "repo-3"] });
    const repositories = [
      makeRepository(),
      makeRepository({ id: "repo-2", name: "api", fullName: "dev/api", cloned: false }),
      makeRepository({ id: "repo-3", name: "cli", fullName: "dev/cli", missing: true }),
    ];

    expect(unclonedRepositories(board, repositories).map((one) => one.id)).toEqual([
      "repo-2",
      "repo-3",
    ]);
  });

  it("ignores a repository the board names and the app does not have", () => {
    const board = makeBoard({ repositoryIds: ["gone"] });

    expect(unclonedRepositories(board, [makeRepository()])).toEqual([]);
  });
});

describe("the Board field", () => {
  const NOW = Date.parse("2026-09-24T14:10:00Z");
  const REPOSITORIES = [
    makeRepository({ id: "web", fullName: "acme/web" }),
    makeRepository({ id: "api", fullName: "acme/api" }),
  ];
  const ALPHA = makeBoard({
    id: "alpha",
    title: "Alpha",
    repositoryIds: ["web", "api"],
    readAt: "2026-09-24T14:08:00Z",
  });
  const BETA = makeBoard({
    id: "beta",
    title: "Beta",
    repositoryIds: ["web"],
    readAt: "2026-09-24T11:30:00Z",
    failure: { reason: "gh", message: "gh failed", failedAt: "2026-09-24T13:52:00Z" },
  });
  const GAMMA = makeBoard({ id: "gamma", title: "Gamma", repositoryIds: ["api"], readAt: "" });
  const app = (overrides: Parameters<typeof makeState>[0] = {}) =>
    makeState({ boards: [ALPHA, BETA, GAMMA], repositories: REPOSITORIES, ...overrides });

  describe("lastUsedBoard", () => {
    it.each([
      ["none", app({ discussions: [], discussionHistory: [] }), null],
      [
        "an active discussion",
        app({ discussions: [makeDiscussion({ boardId: "alpha" })], discussionHistory: [] }),
        "alpha",
      ],
      [
        "an archived discussion created after the active ones",
        app({
          discussions: [makeDiscussion({ boardId: "alpha", createdAt: "2026-09-20T10:00:00Z" })],
          discussionHistory: [
            makeArchivedDiscussion({ boardId: "beta", createdAt: "2026-09-22T10:00:00Z" }),
          ],
        }),
        "beta",
      ],
      [
        "a board that was removed",
        app({
          discussions: [],
          discussionHistory: [makeArchivedDiscussion({ boardId: "removed" })],
        }),
        null,
      ],
    ])("is %s", (_, state, want) => {
      expect(lastUsedBoard(state)).toBe(want);
    });
  });

  describe("defaultDiscussionBoard", () => {
    it("is the last used board when it was read", () => {
      const state = app({ discussions: [makeDiscussion({ boardId: "beta" })] });

      expect(defaultDiscussionBoard(state)).toBe("beta");
    });

    it("is the first read board when the last used was never read", () => {
      const state = app({ discussions: [makeDiscussion({ boardId: "gamma" })] });

      expect(defaultDiscussionBoard(state)).toBe("alpha");
    });

    it("is the first read board without a discussion", () => {
      expect(defaultDiscussionBoard(app({ discussions: [], discussionHistory: [] }))).toBe("alpha");
    });

    it("is nothing when no board was read", () => {
      const state = makeState({ boards: [GAMMA], repositories: REPOSITORIES });

      expect(defaultDiscussionBoard(state)).toBeNull();
    });
  });

  describe("boardOptions", () => {
    it("lists every board in order, with what it reads and when", () => {
      const state = app({
        discussions: [makeDiscussion({ boardId: "beta" })],
        discussionHistory: [],
      });

      expect(boardOptions(state, NOW)).toEqual([
        { value: "alpha", label: "Alpha", sub: "api, web · read 2m ago" },
        {
          value: "beta",
          label: "Beta",
          sub: "web · read failed 18m ago · uses the last reading · last used",
          blocked: true,
        },
        { value: "gamma", label: "Gamma", sub: "not read yet", disabled: true },
      ]);
    });

    it("marks the last used board of a read board", () => {
      const state = app({
        discussions: [makeDiscussion({ boardId: "alpha" })],
        discussionHistory: [],
      });

      expect(boardOptions(state, NOW)[0]?.sub).toBe("api, web · read 2m ago · last used");
    });
  });

  it("explains the field", () => {
    expect(BOARD_FIELD_HELP).toBe(
      "The discussion reads the clones of the board's repositories and publishes its cards there.",
    );
  });
});
