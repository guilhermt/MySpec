import { describe, expect, it } from "vitest";
import { boardLines, continueItem, noBoardLine, reviewSubtitle } from "@/features/home/home";
import { HOME, type Location } from "@/lib/locations";
import type { State } from "@/lib/wails";
import {
  makeBoard,
  makeBoardCard,
  makeDiscussion,
  makePullRequestRow,
  makeRepository,
  makeReviewCenter,
  makeReviewSummary,
  makeSituation,
  makeState,
  makeTask,
  makeTaskCard,
} from "@/test/wails-mock";

const NOW = Date.parse("2026-09-24T14:10:00Z");

describe("continueItem", () => {
  const app = makeState({
    boards: [makeBoard({ id: "board-1", title: "Platform Roadmap" })],
    repositories: [makeRepository({ id: "repo-1", boardId: "board-1" })],
    tasks: [
      makeTask({ id: "old", name: "old-task", createdAt: "2026-09-01T10:00:00Z" }),
      makeTask({ id: "new", name: "new-task", createdAt: "2026-09-10T10:00:00Z" }),
    ],
    reviews: [
      makeReviewSummary({ id: "review-1", title: "Add login", createdAt: "2026-09-05T10:00:00Z" }),
    ],
    discussions: [
      makeDiscussion({
        id: "disc-1",
        title: "Pricing",
        boardId: "board-1",
        createdAt: "2026-09-20T10:00:00Z",
      }),
    ],
  });
  const task = (id: string): Location => ({ kind: "task", id });

  it("is the item on screen", () => {
    const model = continueItem(app, task("old"), [HOME], null, NOW);

    expect(model?.location).toEqual(task("old"));
    expect(model?.row.name).toBe("old-task");
  });

  it("is the most recent item among the places behind, when the place on screen is not one", () => {
    const back = [task("old"), { kind: "reviews" } as const, task("new"), HOME];

    expect(continueItem(app, HOME, back, null, NOW)?.location).toEqual(task("new"));
  });

  it("skips an item that no longer exists", () => {
    const back = [task("old"), task("gone")];

    expect(continueItem(app, HOME, back, null, NOW)?.location).toEqual(task("old"));
  });

  it("is the last item opened when no place has one", () => {
    expect(continueItem(app, HOME, [], task("old"), NOW)?.location).toEqual(task("old"));
  });

  it("goes on to the newest item when the last opened is gone", () => {
    expect(continueItem(app, HOME, [], task("gone"), NOW)?.location).toEqual({
      kind: "discussion",
      id: "disc-1",
    });
  });

  it("is the item created last among tasks, reviews and discussions", () => {
    expect(continueItem(app, HOME, [], null, NOW)?.location).toEqual({
      kind: "discussion",
      id: "disc-1",
    });
    expect(continueItem({ ...app, discussions: [] }, HOME, [], null, NOW)?.location).toEqual(
      task("new"),
    );
  });

  it("is nothing without an active item", () => {
    const empty = makeState({ tasks: [], reviews: [], discussions: [] });

    expect(continueItem(empty, HOME, [HOME], null, NOW)).toBeNull();
  });

  it.each([
    [
      "a task on a board",
      task("old"),
      "Platform Roadmap",
      "Continue: task old-task. idle, PRD. web. Platform Roadmap",
    ],
    [
      "a review",
      { kind: "review", id: "review-1" } as const,
      "Reviews",
      "Continue: pull request review Add login. agent working, Pass 1. Reviewer working for less than a minute: thinking. context 0% used. web#31. Reviews",
    ],
    [
      "a discussion",
      { kind: "discussion", id: "disc-1" } as const,
      "Platform Roadmap",
      "Continue: discussion Pricing. agent working, Discussing. Discussion agent working for less than a minute: thinking. context 0% used. #12. Platform Roadmap",
    ],
  ])("says where %s lives", (_, location, crumbs, label) => {
    const state: State = {
      ...app,
      tasks: (app.tasks ?? []).map((item) => ({ ...item, repositoryId: "repo-1" })),
    };
    const model = continueItem(state, location, [], null, NOW);

    expect(model?.crumbs).toBe(crumbs);
    expect(model?.label).toBe(label);
  });

  it("says No board for a task of a repository without one", () => {
    const state = makeState({
      repositories: [makeRepository({ id: "repo-1", boardId: "" })],
      tasks: [makeTask({ id: "t" })],
    });

    expect(continueItem(state, task("t"), [], null, NOW)?.crumbs).toBe("No board");
  });

  it("names the epic in the breadcrumb of a task", () => {
    const state = makeState({
      boards: [makeBoard({ id: "board-1", title: "Platform Roadmap" })],
      repositories: [makeRepository({ id: "repo-1", boardId: "board-1" })],
      tasks: [
        makeTask({
          id: "t",
          card: makeTaskCard({
            epic: {
              key: "dev/web#1",
              repository: "dev/web",
              number: 1,
              title: "API hardening",
              url: "",
              state: "open",
            },
          }),
        }),
      ],
    });

    expect(continueItem(state, task("t"), [], null, NOW)?.crumbs).toBe(
      "Platform Roadmap / API hardening",
    );
  });

  describe("the situation", () => {
    it("is none for an item that waits nothing", () => {
      expect(continueItem(app, task("old"), [], null, NOW)?.situation).toBeNull();
    });

    it("is the most serious one, where Enter opens the item", () => {
      const state = makeState({
        tasks: [
          makeTask({
            id: "t",
            situations: [
              makeSituation({
                id: "wait",
                group: "waiting",
                place: { kind: "step", stage: "", step: 3 },
                startedAt: "2026-09-24T13:00:00Z",
              }),
              makeSituation({
                id: "error",
                group: "error",
                place: { kind: "pr", stage: "", step: 0 },
                startedAt: "2026-09-24T13:30:00Z",
              }),
            ],
          }),
        ],
      });

      expect(continueItem(state, task("t"), [], null, NOW)?.situation).toEqual({
        itemId: "t",
        place: { kind: "pr", stage: "", step: 0 },
      });
    });
  });
});

describe("reviewSubtitle", () => {
  const row = (repositoryId: string, overrides = {}) =>
    makePullRequestRow({ key: `${repositoryId}#${Math.random()}`, repositoryId, ...overrides });
  const cases: {
    name: string;
    center: Parameters<typeof makeReviewCenter>[0];
    want: { text: string; shimmer: boolean };
  }[] = [
    {
      name: "the first reading",
      center: { readAt: "", reading: true },
      want: { text: "reading…", shimmer: true },
    },
    {
      name: "never read",
      center: { readAt: "" },
      want: { text: "Not read yet", shimmer: false },
    },
    {
      name: "nothing pending",
      center: { readAt: "2026-09-24T14:00:00Z", pendingCount: 0 },
      want: { text: "Nothing pending", shimmer: false },
    },
    {
      name: "one in one repository",
      center: {
        readAt: "2026-09-24T14:00:00Z",
        pendingCount: 1,
        pullRequests: [row("a")],
      },
      want: { text: "1 pending in 1 repository", shimmer: false },
    },
    {
      name: "several in several repositories, not counting the filtered",
      center: {
        readAt: "2026-09-24T14:00:00Z",
        pendingCount: 3,
        pullRequests: [
          row("a"),
          row("a"),
          row("b"),
          row("c", { filtered: true }),
          row("d", { pending: false }),
        ],
      },
      want: { text: "3 pending in 2 repositories", shimmer: false },
    },
    {
      name: "a reading that runs over a read one",
      center: {
        readAt: "2026-09-24T14:00:00Z",
        reading: true,
        pendingCount: 1,
        pullRequests: [row("a")],
      },
      want: { text: "1 pending in 1 repository", shimmer: false },
    },
  ];

  it.each(cases)("says $name", ({ center, want }) => {
    expect(reviewSubtitle(makeReviewCenter(center))).toEqual(want);
  });
});

describe("boardLines", () => {
  const repositories = [
    makeRepository({ id: "web", fullName: "acme/web", boardId: "board-1" }),
    makeRepository({ id: "api", fullName: "acme/api", boardId: "board-1" }),
    makeRepository({ id: "billing", fullName: "acme/billing", boardId: "board-1", cloned: false }),
    makeRepository({
      id: "infra",
      fullName: "acme/infra",
      boardId: "board-1",
      path: "~/code/infra",
      missing: true,
    }),
  ];
  const cardIn = (key: string, overrides = {}) =>
    makeBoardCard({ key, number: Number(key.split("#")[1]), ...overrides });
  const read = "2026-09-24T14:08:00Z";
  const board = (overrides = {}) =>
    makeBoard({
      id: "board-1",
      title: "Platform Roadmap",
      repositoryIds: ["web", "api"],
      readAt: read,
      cards: [
        cardIn("a#1"),
        cardIn("a#2", { statusId: "in-progress" }),
        cardIn("a#3", { statusId: "done", final: true }),
        cardIn("a#4", { state: "closed", statusId: "todo" }),
      ],
      ...overrides,
    });
  const linesOf = (value: ReturnType<typeof makeBoard>, extra = repositories) =>
    boardLines(makeState({ boards: [value], repositories: extra }), NOW);

  it("counts the open cards outside the final statuses, and names the repositories", () => {
    const [line] = linesOf(board());

    expect(line).toMatchObject({
      boardId: "board-1",
      title: "Platform Roadmap",
      summary: "2 open cards · api, web",
      reading: { text: "read 2m ago", tone: "quiet", shimmer: false },
      label: "Platform Roadmap, 2 open cards, read 2m ago",
      blockers: [],
    });
  });

  it.each([
    [[cardIn("a#1")], "1 open card · api, web"],
    [[], "No open cards · api, web"],
    [[cardIn("a#3", { statusId: "done" })], "No open cards · api, web"],
  ])("says the cards of %j: %s", (cards, summary) => {
    expect(linesOf(board({ cards }))[0]?.summary).toBe(summary);
  });

  it("counts every open card of a board without a Status field", () => {
    const value = board({
      hasStatus: false,
      statuses: [],
      cards: [cardIn("a#1", { statusId: "" }), cardIn("a#2", { statusId: "" })],
    });

    expect(linesOf(value)[0]?.summary).toBe("2 open cards · api, web");
  });

  it("says a board never read, and reading", () => {
    const [line] = linesOf(board({ readAt: "", reading: true, cards: [] }));

    expect(line).toMatchObject({
      summary: "Not read yet · api, web",
      reading: { text: "reading…", tone: "quiet", shimmer: true },
      label: "Platform Roadmap, Not read yet, reading…",
    });
  });

  it("says Not read yet for a board never read with nothing reading it", () => {
    const [line] = linesOf(board({ readAt: "", reading: false, cards: [] }));

    expect(line?.reading).toEqual({ text: "Not read yet", tone: "quiet", shimmer: false });
  });

  it("shimmers the reading age while a read board is read again", () => {
    expect(linesOf(board({ reading: true }))[0]?.reading).toEqual({
      text: "read 2m ago",
      tone: "quiet",
      shimmer: true,
    });
  });

  it("says a failed reading over a stored one, and lists the failure first", () => {
    const failure = {
      reason: "gh",
      message: "gh: not authenticated",
      failedAt: "2026-09-24T13:52:00Z",
    };
    const [line] = linesOf(board({ failure }));

    expect(line?.reading).toEqual({
      text: "Read failed 18m ago",
      blocked: true,
      tone: "failed",
      shimmer: false,
      failure: { failedAt: "2026-09-24T13:52:00Z", readAt: read },
    });
    expect(line?.label).toBe("Platform Roadmap, 2 open cards, Read failed 18m ago");
    expect(line?.blockers).toEqual([
      { kind: "read-failed", message: "gh: not authenticated", reading: false },
    ]);
  });

  it("lists the repositories that keep the cards from starting a task, alphabetically", () => {
    const [line] = linesOf(board({ repositoryIds: ["web", "infra", "billing", "api"] }));

    expect(line?.blockers).toEqual([
      {
        kind: "not-cloned",
        repositoryId: "billing",
        text: "acme/billing isn't cloned. Its cards can't start a task yet.",
        blocked: true,
        cloning: false,
        error: "",
      },
      {
        kind: "clone-missing",
        repositoryId: "infra",
        text: "The clone at ~/code/infra is missing.",
        blocked: true,
      },
    ]);
  });

  it("lists the repositories that cannot start a task by name, whichever the case", () => {
    const state = [
      makeRepository({
        id: "a",
        fullName: "acme/a",
        boardId: "board-1",
        missing: true,
        path: "~/a",
      }),
      makeRepository({ id: "b", fullName: "acme/b", boardId: "board-1", cloned: false }),
    ];
    const [line] = linesOf(board({ repositoryIds: ["a", "b"] }), state);

    expect(line?.blockers.map((blocker) => blocker.kind)).toEqual(["clone-missing", "not-cloned"]);
  });

  it("says the clone that runs, and the clone that failed", () => {
    const running = repositories.map((repository) =>
      repository.id === "billing" ? { ...repository, cloning: true } : repository,
    );
    const failed = repositories.map((repository) =>
      repository.id === "billing" ? { ...repository, cloneError: "gh: no access" } : repository,
    );
    const value = board({ repositoryIds: ["billing"] });

    expect(linesOf(value, running)[0]?.blockers).toEqual([
      {
        kind: "not-cloned",
        repositoryId: "billing",
        text: "Cloning acme/billing…",
        cloning: true,
        error: "",
      },
    ]);
    expect(linesOf(value, failed)[0]?.blockers).toEqual([
      {
        kind: "not-cloned",
        repositoryId: "billing",
        text: "gh: no access",
        cloning: false,
        error: "gh: no access",
      },
    ]);
  });

  it("keeps the order of the boards", () => {
    const state = makeState({
      boards: [board({ id: "a", title: "Alpha" }), board({ id: "b", title: "Beta" })],
      repositories,
    });

    expect(boardLines(state, NOW).map((line) => line.title)).toEqual(["Alpha", "Beta"]);
  });
});

describe("noBoardLine", () => {
  it("is none when every repository has a board", () => {
    const state = makeState({ repositories: [makeRepository({ boardId: "board-1" })] });

    expect(noBoardLine(state)).toBeNull();
  });

  it("names the repositories without a board and their clone problems", () => {
    const state = makeState({
      repositories: [
        makeRepository({ id: "b", fullName: "acme/b", boardId: "", cloned: false }),
        makeRepository({ id: "a", fullName: "acme/a", boardId: "" }),
        makeRepository({ id: "c", fullName: "acme/c", boardId: "board-1" }),
      ],
    });

    expect(noBoardLine(state)).toEqual({
      names: "a, b",
      blockers: [
        {
          kind: "not-cloned",
          repositoryId: "b",
          text: "acme/b isn't cloned. Its cards can't start a task yet.",
          blocked: true,
          cloning: false,
          error: "",
        },
      ],
    });
  });
});
