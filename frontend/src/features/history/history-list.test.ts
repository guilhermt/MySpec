import { describe, expect, it } from "vitest";
import {
  archivedOn,
  dayName,
  historyCount,
  historyDays,
  historyEntries,
  historyNeighbor,
  inFilter,
  matchesQuery,
} from "@/features/history/history-list";
import {
  makeArchivedDiscussion,
  makeArchivedReview,
  makeArchivedTask,
  makeHistorySummary,
  makeState,
  makeTaskCard,
} from "@/test/wails-mock";

const NO_OLDER = { archived: { tasks: {}, reviews: {}, discussions: {} }, ids: [] };

const LOGIN = makeArchivedTask({
  id: "task-login",
  name: "add-login",
  archivedAt: "2026-09-08T10:00:00Z",
});
const HEADER = makeArchivedTask({
  id: "task-header",
  name: "fix-header",
  repositoryId: "repo-2",
  repository: "dev/api",
  archivedAt: "2026-09-02T10:00:00Z",
});
const REVIEW = makeArchivedReview({
  id: "review-31",
  number: 31,
  title: "Cache the sessions",
  archivedAt: "2026-09-05T10:00:00Z",
});
const DISCUSSION = makeArchivedDiscussion({
  id: "discussion-1",
  title: "The invoices",
  repositoryIds: ["repo-2"],
  archivedAt: "2026-09-06T10:00:00Z",
});
const APP = makeState({
  history: [LOGIN, HEADER],
  reviewHistory: [REVIEW],
  discussionHistory: [DISCUSSION],
});

function ids(query: string, filter: string): string[] {
  return historyEntries(APP, NO_OLDER, query, filter, null).map((entry) => entry.id);
}

describe("historyEntries", () => {
  it("joins the tasks, the reviews and the discussions, the last to end first", () => {
    expect(ids("", "")).toEqual(["task-login", "discussion-1", "review-31", "task-header"]);
    expect(ids("   ", "")).toEqual(["task-login", "discussion-1", "review-31", "task-header"]);
  });

  it("tells a task from a review and from a discussion", () => {
    const [task, discussion, review] = historyEntries(APP, NO_OLDER, "", "", null);

    expect(task).toEqual({ kind: "task", id: LOGIN.id, archivedAt: LOGIN.archivedAt, task: LOGIN });
    expect(review).toEqual({
      kind: "review",
      id: REVIEW.id,
      archivedAt: REVIEW.archivedAt,
      review: REVIEW,
    });
    expect(discussion).toEqual({
      kind: "discussion",
      id: DISCUSSION.id,
      archivedAt: DISCUSSION.archivedAt,
      discussion: DISCUSSION,
    });
  });

  it("matches the title of a discussion", () => {
    expect(ids("invoices", "")).toEqual(["discussion-1"]);
  });

  it("matches part of the name of a task, whatever the case", () => {
    expect(ids("LOG", "")).toEqual(["task-login"]);
    expect(ids(" header ", "")).toEqual(["task-header"]);
  });

  it("matches the title of a review, or its #number", () => {
    expect(ids("sessions", "")).toEqual(["review-31"]);
    expect(ids("#31", "")).toEqual(["review-31"]);
    expect(ids("31", "")).toEqual(["review-31"]);
  });

  it("keeps the tasks, the reviews and the discussions of the repository of the filter", () => {
    expect(ids("", "repo-1")).toEqual(["task-login", "review-31"]);
    expect(ids("", "repo-2")).toEqual(["discussion-1", "task-header"]);
    expect(ids("sessions", "repo-2")).toEqual([]);
  });

  it("answers with nothing when nothing matches, or before the first snapshot", () => {
    expect(ids("payments", "")).toEqual([]);
    expect(historyEntries(null, NO_OLDER, "", "", null)).toEqual([]);
  });

  it("joins what the History brought from beyond the window, by the ids of the list", () => {
    const old = makeArchivedTask({
      id: "task-old",
      name: "old-work",
      archivedAt: "2026-05-01T10:00:00Z",
    });
    const unlisted = makeArchivedTask({ id: "task-unlisted", name: "unlisted" });
    const older = {
      archived: {
        tasks: { [old.id]: old, [unlisted.id]: unlisted },
        reviews: {},
        discussions: {},
      },
      ids: [old.id, "gone"],
    };

    const entries = historyEntries(APP, older, "", "", null).map((entry) => entry.id);

    expect(entries).toEqual(["task-login", "discussion-1", "review-31", "task-header", "task-old"]);
  });
});

describe("historyNeighbor", () => {
  const entries = historyEntries(makeState({ history: [LOGIN, HEADER] }), NO_OLDER, "", "", null);

  it("is the next entry, the older one", () => {
    expect(historyNeighbor(entries, "task-login")).toBe("task-header");
  });

  it("is the previous one when the entry is the last", () => {
    expect(historyNeighbor(entries, "task-header")).toBe("task-login");
  });

  it("is null for the only entry, and for one that isn't listed", () => {
    expect(historyNeighbor(entries.slice(0, 1), "task-login")).toBeNull();
    expect(historyNeighbor(entries, "missing")).toBeNull();
  });
});

// 2026-09-24 15:10, local time.
const NOW = new Date(2026, 8, 24, 15, 10).getTime();

describe("matchesQuery", () => {
  const makeArchivedPR = () => ({
    number: 1,
    url: "",
    state: "merged",
    base: "main",
    mergedBy: "",
    mergedAt: "",
  });
  const task = (overrides = {}) => {
    const value = makeArchivedTask({
      name: "Idempotency keys",
      card: { ...makeTaskCard(), number: 398 },
      pr: { ...makeArchivedPR(), number: 1279 },
      ...overrides,
    });
    return { kind: "task", id: value.id, archivedAt: value.archivedAt, task: value } as const;
  };

  it("finds a number, with or without the #, in the pull request and in the card of a task", () => {
    expect(matchesQuery(task(), "#1279")).toBe(true);
    expect(matchesQuery(task(), "1279")).toBe(true);
    expect(matchesQuery(task(), "#398")).toBe(true);
    expect(matchesQuery(task(), "#12")).toBe(false);
  });

  it("finds a task by the words of its name, whatever the case", () => {
    expect(matchesQuery(task(), "  IDEMPOTENCY ")).toBe(true);
    expect(matchesQuery(task({ pr: null, card: null }), "#1279")).toBe(false);
  });

  it("finds a review by its number", () => {
    const review = makeArchivedReview({ number: 2291 });
    const entry = { kind: "review", id: review.id, archivedAt: review.archivedAt, review } as const;

    expect(matchesQuery(entry, "#2291")).toBe(true);
    expect(matchesQuery(entry, "2292")).toBe(false);
  });
});

describe("inFilter", () => {
  it("takes a discussion by any repository it touched", () => {
    const discussion = makeArchivedDiscussion({ repositoryIds: ["repo-1", "repo-2"] });
    const entry = {
      kind: "discussion",
      id: discussion.id,
      archivedAt: discussion.archivedAt,
      discussion,
    } as const;

    expect(inFilter(entry, "")).toBe(true);
    expect(inFilter(entry, "repo-2")).toBe(true);
    expect(inFilter(entry, "repo-3")).toBe(false);
  });
});

describe("historyEntries order and fresh", () => {
  it("breaks a tie of the archiving by the id, the greater first", () => {
    const a = makeArchivedTask({ id: "a", archivedAt: "2026-09-08T10:00:00Z" });
    const b = makeArchivedTask({ id: "b", archivedAt: "2026-09-08T10:00:00Z" });

    const result = historyEntries(makeState({ history: [a, b] }), NO_OLDER, "", "", null);

    expect(result.map((entry) => entry.id)).toEqual(["b", "a"]);
  });

  it("keeps the fresh item outside the filter and the search", () => {
    const result = historyEntries(APP, NO_OLDER, "nothing like it", "repo-2", "task-login");

    expect(result.map((entry) => entry.id)).toEqual(["task-login"]);
  });
});

describe("dayName and historyDays", () => {
  it("names today, yesterday, a day of the year and a day of another year", () => {
    expect(dayName(new Date(2026, 8, 24, 9).toISOString(), NOW)).toBe("Today");
    expect(dayName(new Date(2026, 8, 23, 23).toISOString(), NOW)).toBe("Yesterday");
    expect(dayName(new Date(2026, 8, 21, 9).toISOString(), NOW)).toBe("Monday, Sep 21");
    expect(dayName(new Date(2025, 8, 22, 9).toISOString(), NOW)).toBe("Monday, Sep 22, 2025");
  });

  it("says the day as a sentence does", () => {
    expect(archivedOn(new Date(2026, 8, 24, 9).toISOString(), NOW)).toBe("today");
    expect(archivedOn(new Date(2026, 8, 23, 9).toISOString(), NOW)).toBe("yesterday");
    expect(archivedOn(new Date(2026, 8, 21, 9).toISOString(), NOW)).toBe("on Monday, Sep 21");
  });

  it("groups the entries by the local day, with the name and the count", () => {
    const at = (id: string, day: number, hour: number) =>
      makeArchivedTask({ id, archivedAt: new Date(2026, 8, day, hour).toISOString() });
    const state = makeState({ history: [at("a", 24, 15), at("b", 24, 9), at("c", 21, 9)] });

    const days = historyDays(historyEntries(state, NO_OLDER, "", "", null), NOW);

    expect(days.map((day) => [day.id, day.name, day.label, day.entries.length])).toEqual([
      ["2026-09-24", "Today", "Archived today: 2", 2],
      ["2026-09-21", "Monday, Sep 21", "Archived on Monday, Sep 21: 1", 1],
    ]);
  });
});

describe("historyCount", () => {
  const summary = makeHistorySummary({
    tasks: 30,
    reviews: 10,
    discussions: 4,
    oldest: new Date(2026, 8, 12, 9).toISOString(),
  });
  const plain = { matched: null, windowMatches: 44, filtered: false, searching: false };

  it("counts the whole History and when it began", () => {
    expect(historyCount(summary, plain, NOW)).toEqual({
      text: "44 archived · Sep 12 – today",
      busy: false,
    });
  });

  it("writes the year of another one and a single item", () => {
    const old = makeHistorySummary({
      tasks: 1,
      oldest: new Date(2025, 8, 12, 9).toISOString(),
    });

    expect(historyCount(old, plain, NOW).text).toBe("1 archived · Sep 12, 2025 – today");
  });

  it("says only today when the oldest item is of today", () => {
    const fresh = makeHistorySummary({ tasks: 2, oldest: new Date(2026, 8, 24, 9).toISOString() });

    expect(historyCount(fresh, plain, NOW).text).toBe("2 archived · today");
  });

  it("says what the filter matches over the total", () => {
    expect(historyCount(summary, { ...plain, matched: 12, filtered: true }, NOW).text).toBe(
      "12 of 44 · Sep 12 – today",
    );
  });

  it("is busy with the window's part until the Go answers a search", () => {
    const waiting = historyCount(summary, { ...plain, windowMatches: 3, searching: true }, NOW);
    const answered = historyCount(summary, { ...plain, matched: 7, searching: true }, NOW);

    expect(waiting).toEqual({ text: "3 of 44 · Sep 12 – today", busy: true });
    expect(answered).toEqual({ text: "7 of 44 · Sep 12 – today", busy: false });
  });

  it("leaves out the period of an empty History", () => {
    expect(historyCount(makeHistorySummary(), plain, NOW)).toEqual({
      text: "0 archived",
      busy: false,
    });
  });
});
