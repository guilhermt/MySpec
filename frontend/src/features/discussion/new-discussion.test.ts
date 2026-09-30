import { describe, expect, it } from "vitest";
import {
  BOARD_FIELD_HELP,
  boardOptions,
  canStart,
  defaultDiscussionBoard,
  lastUsedBoard,
  suggestedTitle,
  TITLE_MAX,
  titleProblem,
  unclonedRepositories,
} from "@/features/discussion/new-discussion";
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

describe("titleProblem", () => {
  it("wants a title", () => {
    expect(titleProblem("   ")).toBe("empty");
  });

  it("keeps the title short", () => {
    expect(titleProblem("a".repeat(TITLE_MAX + 1))).toBe("too_long");
  });

  it("takes a title that fits", () => {
    expect(titleProblem("Billing, end to end")).toBeNull();
  });
});

describe("canStart", () => {
  it("wants a title", () => {
    expect(canStart("", "Something to look at", [CARD])).toBe(false);
  });

  it("takes cards without text", () => {
    expect(canStart("Billing", "", [CARD])).toBe(true);
  });

  it("takes text without cards", () => {
    expect(canStart("Billing", "The invoices are late", [])).toBe(true);
  });

  it("wants something to discuss", () => {
    expect(canStart("Billing", "  ", [])).toBe(false);
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
          sub: "web · ◇ read failed 18m ago · uses the last reading · last used",
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
