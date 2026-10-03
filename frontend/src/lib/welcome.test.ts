import { describe, expect, it } from "vitest";
import type { Location } from "@/lib/locations";
import { allowedInWelcome, archivedAnything, welcomeMode } from "@/lib/welcome";
import {
  makeArchivedDiscussion,
  makeArchivedReview,
  makeArchivedTask,
  makeBoard,
  makeDiscussion,
  makeMigration,
  makeRepository,
  makeReviewSummary,
  makeState,
  makeTask,
} from "@/test/wails-mock";

const EMPTY = {
  repositories: [],
  boards: [],
  tasks: [],
  reviews: [],
  discussions: [],
  history: [],
  reviewHistory: [],
  discussionHistory: [],
};

describe("welcomeMode", () => {
  it.each([
    ["no state", null, false],
    ["nothing registered and nothing active", makeState(EMPTY), true],
    ["a repository", makeState({ ...EMPTY, repositories: [makeRepository()] }), false],
    ["a board", makeState({ ...EMPTY, boards: [makeBoard()] }), false],
    ["a task", makeState({ ...EMPTY, tasks: [makeTask()] }), false],
    ["a review", makeState({ ...EMPTY, reviews: [makeReviewSummary()] }), false],
    [
      "the active discussion of a board that was removed",
      makeState({ ...EMPTY, discussions: [makeDiscussion({ boardId: "" })] }),
      false,
    ],
    ["only archived items", makeState({ ...EMPTY, history: [makeArchivedTask()] }), true],
    ["a refused migration", makeState({ ...EMPTY, migration: makeMigration() }), false],
  ])("is %s: %s", (_name, app, expected) => {
    expect(welcomeMode(app)).toBe(expected);
  });
});

describe("archivedAnything", () => {
  it.each([
    ["nothing", EMPTY, false],
    ["a task", { history: [makeArchivedTask()] }, true],
    ["a review", { reviewHistory: [makeArchivedReview()] }, true],
    ["a discussion", { discussionHistory: [makeArchivedDiscussion()] }, true],
  ])("says %s archived is %s", (_name, overrides, expected) => {
    expect(archivedAnything(makeState({ ...EMPTY, ...overrides }))).toBe(expected);
  });
});

describe("allowedInWelcome", () => {
  const bare = makeState(EMPTY);
  const archived = makeState({ ...EMPTY, history: [makeArchivedTask()] });
  const places: [string, Location, boolean, boolean][] = [
    ["Home", { kind: "home" }, true, true],
    ["Settings", { kind: "settings", section: "boards" }, true, true],
    ["History", { kind: "history" }, false, true],
    ["an archived task", { kind: "archived-task", id: "a" }, false, true],
    ["an archived review", { kind: "archived-review", id: "a" }, false, true],
    ["an archived discussion", { kind: "archived-discussion", id: "a" }, false, true],
    ["a board", { kind: "board", id: "b" }, false, false],
    ["Reviews", { kind: "reviews" }, false, false],
    ["a task", { kind: "task", id: "t" }, false, false],
  ];

  it.each(places)(
    "%s: bare %s, with something archived %s",
    (_name, location, bareOk, archivedOk) => {
      expect(allowedInWelcome(bare, location)).toBe(bareOk);
      expect(allowedInWelcome(archived, location)).toBe(archivedOk);
    },
  );
});
