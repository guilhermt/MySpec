import { describe, expect, it } from "vitest";
import { TONE_GLYPHS } from "@/components/system/item-parts";
import {
  cycled,
  DEFAULT_COLLAPSED,
  EMPTY_REVIEW_FILTERS,
  emptyListBody,
  failureStrips,
  filterChips,
  filterGroups,
  filtersActive,
  isReviewsSectionsMemory,
  NO_BOARD,
  noMatchBody,
  pullRequestRowModel,
  type ReviewFilterChip,
  type ReviewsReadingView,
  reviewKeyNotice,
  reviewRows,
  reviewSections,
  reviewsReadingView,
  sameFilters,
  sectionLabel,
  sectionOf,
  withBoard,
  withoutChip,
  withRepository,
  yourReviewText,
} from "@/features/reviews/review-list";
import { reviewRow } from "@/features/sidebar/sidebar-tree";
import type { PullRequestRow, ReviewCenter, State } from "@/lib/wails";
import {
  makeBoard,
  makePullRequestRow,
  makePullReview,
  makePullsFailure,
  makeRepository,
  makeReviewCenter,
  makeReviewFilters,
  makeReviewSummary,
  makeState,
  makeTask,
} from "@/test/wails-mock";

// NOW is Sunday, September 27, 2026, 15:00 in the local time of the runner.
const NOW = new Date(2026, 8, 27, 15, 0).getTime();
const local = (...parts: [number, number, number, number, number]) =>
  new Date(...parts).toISOString();

function appWith(rows: PullRequestRow[], overrides: Partial<State> = {}): State {
  return makeState({
    reviewCenter: makeReviewCenter({ pullRequests: rows, readAt: local(2026, 8, 27, 14, 58) }),
    ...overrides,
  });
}

describe("sectionOf", () => {
  it.each([
    ["an active review first", { reviewId: "review-1", own: true, pending: true }, "in_review"],
    ["yours", { own: true, pending: true }, "yours"],
    ["of a task", { taskId: "task-1", pending: true }, "yours"],
    ["pending", { pending: true }, "pending"],
    ["reviewed", { pending: false }, "reviewed"],
  ] as const)("puts a pull request %s", (_, overrides, section) => {
    expect(sectionOf(makePullRequestRow(overrides))).toBe(section);
  });
});

describe("reviewSections", () => {
  it("gives the four sections in order, the kept rows the most recently updated first", () => {
    const old = makePullRequestRow({ key: "a", updatedAt: "2026-09-20T10:00:00Z" });
    const recent = makePullRequestRow({ key: "b", updatedAt: "2026-09-25T10:00:00Z" });
    const hidden = makePullRequestRow({ key: "c", filtered: true });
    const mine = makePullRequestRow({ key: "d", own: true });

    const sections = reviewSections(
      makeReviewCenter({ pullRequests: [old, hidden, recent, mine] }),
    );

    expect(sections.map((section) => [section.id, section.name, section.rows])).toEqual([
      ["pending", "Pending", [recent, old]],
      ["in_review", "In review", []],
      ["reviewed", "Reviewed", []],
      ["yours", "Yours and your tasks", [mine]],
    ]);
    expect(sections.map((section) => section.tooltip)).toEqual([
      "Never reviewed by you, or with commits after your last review",
      "Pull requests with a review in MySpec",
      "Reviewed by you, with nothing new since",
      "Yours and the pull requests of your tasks: never pending",
    ]);
  });

  it("starts the sections that never wait for the user collapsed", () => {
    expect(DEFAULT_COLLAPSED).toEqual(["reviewed", "yours"]);
  });
});

describe("sectionLabel", () => {
  it.each([
    [0, "Pending, 0 pull requests"],
    [1, "Pending, 1 pull request"],
    [4, "Pending, 4 pull requests"],
  ])("names a section of %i", (count, label) => {
    const rows = Array.from({ length: count }, () => makePullRequestRow());
    expect(sectionLabel({ id: "pending", name: "Pending", tooltip: "", rows })).toBe(label);
  });
});

describe("isReviewsSectionsMemory", () => {
  it.each([
    [{ collapsed: [] }, true],
    [{ collapsed: ["reviewed", "pending"] }, true],
    [{ collapsed: ["done"] }, false],
    [{ collapsed: [1] }, false],
    [{}, false],
    [null, false],
    ["pending", false],
  ])("tells %j apart", (value, valid) => {
    expect(isReviewsSectionsMemory(value)).toBe(valid);
  });
});

describe("reviewRows", () => {
  const row = makePullRequestRow({ key: "a" });
  const sections = reviewSections(makeReviewCenter({ pullRequests: [row] }));

  it("walks each header, then the rows of an expanded section", () => {
    expect(reviewRows(sections, new Set()).map((entry) => entry.kind)).toEqual([
      "section",
      "pr",
      "section",
      "section",
      "section",
    ]);
  });

  it("folds a collapsed section, and never an empty one", () => {
    const rows = reviewRows(sections, new Set(["pending", "reviewed"]));

    expect(rows.map((entry) => entry.kind)).toEqual(["section", "section", "section", "section"]);
    expect(rows.map((entry) => entry.kind === "section" && entry.collapsed)).toEqual([
      true,
      false,
      false,
      false,
    ]);
  });
});

describe("yourReviewText", () => {
  it.each([
    ["approved", local(2026, 8, 27, 10, 2), "You approved it today at 10:02"],
    ["changes_requested", local(2026, 8, 22, 9, 30), "You requested changes on Sep 22 at 09:30"],
    ["commented", local(2026, 8, 26, 17, 40), "You commented yesterday at 17:40"],
    ["dismissed", local(2026, 8, 22, 9, 30), "Your review was dismissed on Sep 22 at 09:30"],
    ["approved", "", "You approved it"],
  ])("tells a review %s", (state, at, text) => {
    expect(yourReviewText(makePullReview({ state, at }), NOW)).toBe(text);
  });
});

describe("pullRequestRowModel", () => {
  const model = (overrides: Partial<PullRequestRow>, app?: State) => {
    const row = makePullRequestRow(overrides);
    return pullRequestRowModel(row, { app: app ?? appWith([row]), now: NOW });
  };

  it("names the reference by the short name, and the whole one in the tooltip", () => {
    const view = model({ repository: "acme/marketing-site", number: 1234 });

    expect(view.reference).toBe("marketing-site#1234");
    expect(view.referenceTooltip).toBe("acme/marketing-site#1234");
  });

  it.each([
    ["no tag", { labels: [] }, []],
    ["a draft", { draft: true }, [{ text: "Draft", tooltip: null }]],
    [
      "the first label that doesn't repeat the author, and +N for the rest",
      {
        author: "dependabot",
        draft: true,
        labels: [
          { name: "Dependabot", color: "" },
          { name: "dependencies", color: "" },
          { name: "javascript", color: "" },
        ],
      },
      [
        { text: "Draft", tooltip: null },
        { text: "dependencies", tooltip: null },
        { text: "+2", tooltip: "Dependabot\ndependencies\njavascript" },
      ],
    ],
    [
      "only a label that repeats the author",
      { author: "bot", labels: [{ name: "bot", color: "" }] },
      [],
    ],
  ])("tags %s", (_, overrides, tags) => {
    expect(model(overrides).tags).toEqual(tags);
  });

  it("writes you for the author of your own pull request", () => {
    expect(model({ own: true, author: "dev" }).author).toBe("you");
    expect(model({ author: "rsouza" }).author).toBe("rsouza");
  });

  it("shows the review of the tree, with the wait in the tooltip", () => {
    const review = makeReviewSummary();
    const row = makePullRequestRow({ reviewId: review.id, action: "open_review" });
    const tree = reviewRow(review, NOW);

    const view = pullRequestRowModel(row, { app: appWith([row], { reviews: [review] }), now: NOW });

    expect(view.state).toEqual({
      kind: "review",
      glyph: TONE_GLYPHS[tree.tone],
      long: tree.line2.long,
      short: tree.line2.short,
      strong: tree.waiting || tree.tone === "error",
      tooltip: `Review: ${tree.line2.long}`,
    });
    expect(view.keys).toBe("open");
    expect(view.label).toBe(`web#31 Add the login screen. by alice. review: ${tree.line2.long}`);
  });

  it.each([
    [
      "never reviewed",
      { pending: true, reviewed: false },
      { kind: "text", text: "Never reviewed", tone: "ink-2", tooltip: null },
      "pending: never reviewed",
    ],
    [
      "with new commits",
      { pending: true, reviewed: true, newCommits: true, newCommitCount: 3 },
      {
        kind: "text",
        text: "3 new commits",
        tone: "ink-2",
        tooltip: "3 commits after your last review",
      },
      "pending: 3 new commits after your review",
    ],
    [
      "with one new commit",
      { pending: true, reviewed: true, newCommits: true, newCommitCount: 1 },
      {
        kind: "text",
        text: "1 new commit",
        tone: "ink-2",
        tooltip: "1 commit after your last review",
      },
      "pending: 1 new commit after your review",
    ],
    [
      "with commits it can't count",
      { pending: true, reviewed: true, newCommits: true, newCommitCount: -1 },
      {
        kind: "text",
        text: "New commits",
        tone: "ink-2",
        tooltip: "Commits after your last review",
      },
      "pending: new commits after your review",
    ],
    [
      "reviewed",
      {
        pending: false,
        reviewed: true,
        yourReview: makePullReview({ at: local(2026, 8, 27, 10, 2) }),
      },
      { kind: "text", text: "Reviewed", tone: "ink-3", tooltip: "You approved it today at 10:02" },
      "reviewed: you approved it today at 10:02",
    ],
    [
      "yours",
      { own: true },
      { kind: "text", text: "Yours", tone: "ink-3", tooltip: null },
      "your pull request",
    ],
    [
      "from a fork",
      { action: "fork" },
      { kind: "text", text: "From a fork · can't be reviewed yet", tone: "ink-3", tooltip: null },
      "from a fork, can't be reviewed yet",
    ],
  ] as const)("says a pull request %s", (_, overrides, state, spoken) => {
    const view = model(overrides);

    expect(view.state).toEqual(state);
    expect(view.label.endsWith(`. ${spoken}`)).toBe(true);
  });

  it("says the task a pull request belongs to", () => {
    const task = makeTask({ id: "task-1", name: "Rate limit per API key" });
    const row = makePullRequestRow({ taskId: "task-1", action: "open_task" });

    const view = pullRequestRowModel(row, { app: appWith([row], { tasks: [task] }), now: NOW });

    expect(view.state).toEqual({
      kind: "task",
      text: "Task · Rate limit per API key",
      tooltip: "Its review happens in the task",
    });
    expect(view.keys).toBe("open task");
    expect(view.label).toBe(
      "web#31 Add the login screen. by alice. the pull request of the task Rate limit per API key",
    );
  });

  it("says the clone of the repository while it runs, and when it failed", () => {
    const row = { action: "clone" } as const;
    const cloning = appWith([], { repositories: [makeRepository({ cloning: true })] });
    const failed = appWith([], { repositories: [makeRepository({ cloneError: "gh: not found" })] });

    expect(model(row, cloning).state).toEqual({ kind: "cloning", text: "Cloning dev/web…" });
    expect(model(row, failed).state).toEqual({ kind: "clone-failed" });
    expect(model(row, failed).keys).toBe("review");
  });

  it("draws a pull request from a fork dashed, without a key", () => {
    const view = model({ action: "fork" });

    expect(view.dashed).toBe(true);
    expect(view.keys).toBeNull();
    expect(model({ action: "clone_missing" }).keys).toBeNull();
  });

  it("names the row with every part, separated by periods", () => {
    const view = model({
      repository: "acme/api",
      number: 1302,
      title: "Idempotency keys for payment retries",
      author: "lnakamura",
      draft: true,
      labels: [{ name: "payments", color: "" }],
    });

    expect(view.label).toBe(
      "api#1302 Idempotency keys for payment retries. by lnakamura. draft. label payments. pending: never reviewed",
    );
  });
});

describe("reviewKeyNotice", () => {
  it("says why R does nothing on a fork and on a missing clone", () => {
    const app = makeState({ repositories: [makeRepository({ path: "~/code/web" })] });

    expect(reviewKeyNotice(makePullRequestRow({ action: "fork" }), app)).toEqual({
      title: "No review of web#31",
      reason: "Pull requests from forks can't be reviewed yet.",
    });
    expect(reviewKeyNotice(makePullRequestRow({ action: "clone_missing" }), app)).toEqual({
      title: "No review of web#31",
      reason: "The clone at ~/code/web is missing.",
    });
  });

  it.each(["review", "open_review", "open_task", "clone"])("is null where R acts: %s", (action) => {
    expect(reviewKeyNotice(makePullRequestRow({ action }), makeState())).toBeNull();
  });
});

describe("filterChips", () => {
  const app = makeState({
    boards: [makeBoard({ id: "board-1", title: "Mobile App" })],
    repositories: [makeRepository({ id: "repo-1", fullName: "acme/web" })],
  });

  it("gives a chip per filter, in the order board, repository, author, label", () => {
    const filters = makeReviewFilters({
      boardId: "board-1",
      boardName: "Mobile App",
      repositoryId: "repo-1",
      repositoryName: "acme/web",
      authorsExclude: ["dependabot"],
      authorsInclude: ["rsouza"],
      labelsExclude: ["dependabot"],
    });

    expect(filterChips(filters, app)).toEqual([
      chip("board", "board-1", "Board: Mobile App"),
      chip("repository", "repo-1", "acme/web"),
      chip("author", "dependabot", "Author −dependabot"),
      chip("author", "rsouza", "Author +rsouza"),
      chip("label", "dependabot", "Label −dependabot"),
    ]);
  });

  it("names the board of the repositories without one", () => {
    expect(
      filterChips(makeReviewFilters({ boardId: NO_BOARD, boardName: "No board" }), app),
    ).toEqual([chip("board", NO_BOARD, "Board: No board")]);
  });

  it("says a board or a repository that left is an orphan", () => {
    const filters = makeReviewFilters({
      boardId: "board-9",
      boardName: "Mobile App",
      repositoryId: "repo-9",
      repositoryName: "acme/old",
    });

    expect(filterChips(filters, app).map((one) => one.orphan)).toEqual([
      "Mobile App isn't a board anymore.",
      "acme/old isn't registered anymore.",
    ]);
  });

  it("names a filter kept without a name by the board or the repository, or else the id", () => {
    const kept = makeReviewFilters({ boardId: "board-1", repositoryId: "repo-9" });

    expect(filterChips(kept, app).map((one) => one.label)).toEqual(["Board: Mobile App", "repo-9"]);
  });

  function chip(kind: ReviewFilterChip["kind"], value: string, label: string): ReviewFilterChip {
    return { kind, value, label, removeLabel: `Remove the filter ${label}`, orphan: null };
  }
});

describe("filterGroups", () => {
  it("offers the boards, the repositories, the authors and the labels", () => {
    const app = makeState({
      boards: [makeBoard({ id: "b2", title: "Web" }), makeBoard({ id: "b1", title: "Mobile App" })],
      repositories: [
        makeRepository({ id: "r2", fullName: "acme/web" }),
        makeRepository({ id: "r1", fullName: "acme/api" }),
      ],
    });
    const center = makeReviewCenter({
      pullRequests: [makePullRequestRow({ own: true, author: "dev" })],
      authors: ["rsouza", "dependabot", "dev"],
      labels: ["bug", "dependencies"],
    });
    const filters = makeReviewFilters({
      boardId: "b1",
      repositoryId: "r2",
      authorsExclude: ["dependabot"],
      labelsInclude: ["bug"],
    });

    expect(filterGroups(filters, center, app)).toEqual({
      board: {
        label: "Board",
        items: [
          { value: "b2", label: "Web", checked: false },
          { value: "b1", label: "Mobile App", checked: true },
          { value: NO_BOARD, label: "No board", checked: false },
        ],
      },
      repository: {
        label: "Repository",
        items: [
          { value: "r1", label: "acme/api", checked: false },
          { value: "r2", label: "acme/web", checked: true },
        ],
      },
      authors: [
        { value: "dependabot", label: "dependabot", state: "hidden" },
        { value: "dev", label: "dev · you", state: "any" },
        { value: "rsouza", label: "rsouza", state: "any" },
      ],
      labels: [
        { value: "bug", label: "bug", state: "only" },
        { value: "dependencies", label: "dependencies", state: "any" },
      ],
    });
  });
});

describe("the changes of the filters", () => {
  it("chooses a board, and clears it when chosen again", () => {
    const chosen = withBoard(EMPTY_REVIEW_FILTERS, "b1", "Mobile App");

    expect([chosen.boardId, chosen.boardName]).toEqual(["b1", "Mobile App"]);
    expect(withBoard(chosen, "b1", "Mobile App")).toEqual(EMPTY_REVIEW_FILTERS);
    expect(withBoard(chosen, NO_BOARD, "").boardName).toBe("No board");
  });

  it("chooses a repository, and clears it when chosen again", () => {
    const chosen = withRepository(EMPTY_REVIEW_FILTERS, "r1", "acme/api");

    expect([chosen.repositoryId, chosen.repositoryName]).toEqual(["r1", "acme/api"]);
    expect(withRepository(chosen, "r1", "acme/api")).toEqual(EMPTY_REVIEW_FILTERS);
  });

  it.each([
    ["hides", "hidden", { authorsInclude: [], authorsExclude: ["bot"] }],
    ["keeps only", "only", { authorsInclude: ["bot"], authorsExclude: [] }],
    ["stops filtering", "any", { authorsInclude: [], authorsExclude: [] }],
  ] as const)("%s an author", (_, next, lists) => {
    const filters = makeReviewFilters({ authorsInclude: ["BOT"] });

    expect(cycled(filters, "author", "bot", next)).toEqual({ ...filters, ...lists });
  });

  it("cycles a label in its own lists", () => {
    expect(cycled(EMPTY_REVIEW_FILTERS, "label", "bug", "hidden").labelsExclude).toEqual(["bug"]);
  });

  it("takes away the filter of a chip", () => {
    const filters = makeReviewFilters({
      boardId: "b1",
      boardName: "Mobile App",
      repositoryId: "r1",
      repositoryName: "acme/api",
      authorsExclude: ["bot"],
      labelsInclude: ["bug"],
    });
    const app = makeState();
    const chips = filterChips(filters, app);
    const without = chips.reduce((current, one) => withoutChip(current, one), filters);

    expect(without).toEqual(EMPTY_REVIEW_FILTERS);
  });

  it("tells whether any filter narrows the list", () => {
    expect(filtersActive(EMPTY_REVIEW_FILTERS)).toBe(false);
    expect(filtersActive(makeReviewFilters({ labelsExclude: ["bug"] }))).toBe(true);
    expect(filtersActive(makeReviewFilters({ boardId: NO_BOARD }))).toBe(true);
  });

  it("compares the filters as Go keeps them", () => {
    const a = makeReviewFilters({ authorsExclude: ["Bot", "alice "] });
    const b = makeReviewFilters({ authorsExclude: ["alice", "bot", "bot"] });

    expect(sameFilters(a, b)).toBe(true);
    expect(sameFilters(a, makeReviewFilters())).toBe(false);
  });
});

describe("reviewsReadingView", () => {
  const read = "2026-09-27T14:58:00Z";

  it.each<[string, Partial<State>, Partial<ReviewCenter>, ReviewsReadingView]>([
    ["no repository", { repositories: [] }, {}, "no-repositories"],
    ["a first reading", {}, { readAt: "", reading: true }, "skeleton"],
    ["a first reading that failed", {}, { readAt: "", reading: false }, "no-pull-requests"],
    ["a reading without pull requests", {}, { readAt: read }, "no-pull-requests"],
    [
      "every pull request filtered",
      {},
      { readAt: read, pullRequests: [makePullRequestRow({ filtered: true })] },
      "no-match",
    ],
    ["a list", {}, { readAt: read, pullRequests: [makePullRequestRow()] }, "list"],
    [
      "a reading over a stored list",
      {},
      { readAt: read, reading: true, pullRequests: [makePullRequestRow()] },
      "list",
    ],
  ])("shows %s", (_, state, center, view) => {
    const app = makeState({ ...state, reviewCenter: makeReviewCenter(center) });
    expect(reviewsReadingView(app)).toBe(view);
  });
});

describe("the texts of the empty list", () => {
  it.each([
    [1, "1 repository"],
    [12, "12 repositories"],
  ])("counts %i repositories", (count, words) => {
    const repositories = Array.from({ length: count }, (_, i) => makeRepository({ id: `r${i}` }));

    expect(emptyListBody(makeState({ repositories }))).toBe(
      `The list shows the open pull requests of your ${words}, from any author. MySpec reads them every 5 minutes and when you open Reviews.`,
    );
  });

  it.each([
    [1, "1 is open; the filters hide it."],
    [9, "9 are open; the filters hide all of them."],
  ])("says the filters hide %i", (count, text) => {
    const pullRequests = Array.from({ length: count }, () =>
      makePullRequestRow({ filtered: true }),
    );

    expect(noMatchBody(makeReviewCenter({ pullRequests }))).toBe(text);
  });
});

describe("failureStrips", () => {
  it("gives a strip per failed repository, alphabetically, with the age of the first failure", () => {
    const center = makeReviewCenter({
      failures: [
        makePullsFailure({
          repository: "acme/web",
          message: "GitHub refused the reading.",
          failedAt: new Date(NOW - 4 * 60_000).toISOString(),
        }),
        makePullsFailure({ repository: "acme/ios", message: "gh is not signed in." }),
      ],
    });

    expect(failureStrips(center, NOW)).toEqual([
      { repository: "acme/ios", title: "Couldn't read acme/ios", message: "gh is not signed in." },
      {
        repository: "acme/web",
        title: "Couldn't read acme/web · 4m ago",
        message: "GitHub refused the reading.",
      },
    ]);
  });
});
