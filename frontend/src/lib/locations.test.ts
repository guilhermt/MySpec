import { describe, expect, it } from "vitest";
import {
  breadcrumbOf,
  type GoneLocation,
  goneOutcome,
  goneTitle,
  HOME,
  isActiveItem,
  isLocation,
  isLocationList,
  type Location,
  locationExists,
  locationTitle,
  openItemId,
  sameLocation,
  withoutFresh,
} from "@/lib/locations";
import {
  makeArchivedDiscussion,
  makeArchivedReview,
  makeArchivedTask,
  makeBoard,
  makeDiscussion,
  makeRepository,
  makeReviewSummary,
  makeState,
  makeTask,
  makeTaskCard,
} from "@/test/wails-mock";

const ROADMAP = makeBoard();
const WEB = makeRepository({ boardId: "board-1" });
const LOOSE = makeRepository({ id: "repo-2", name: "cli", fullName: "dev/cli" });
const EPIC = {
  key: "dev/web#1",
  repository: "dev/web",
  number: 1,
  title: "Accounts",
  url: "https://github.com/dev/web/issues/1",
  state: "",
};

const app = makeState({
  boards: [ROADMAP],
  repositories: [WEB, LOOSE],
  tasks: [
    makeTask(),
    makeTask({ id: "task-2", name: "add-epic", card: makeTaskCard({ epic: EPIC }) }),
    makeTask({ id: "task-3", name: "loose", repositoryId: "repo-2" }),
  ],
  reviews: [makeReviewSummary()],
  discussions: [
    makeDiscussion({ boardId: "board-1" }),
    makeDiscussion({ id: "discussion-2", title: "Orphan", boardId: "board-9" }),
  ],
  history: [makeArchivedTask({ id: "archived-1", name: "old-task" })],
  reviewHistory: [makeArchivedReview({ id: "archived-review-1", title: "Old review" })],
  discussionHistory: [makeArchivedDiscussion({ id: "archived-discussion-1", title: "Old talk" })],
});

const GONE: Location = { kind: "gone", item: "task", id: "task-9", name: "left", boardId: "" };

describe("sameLocation", () => {
  it.each<[string, Location, Location, boolean]>([
    ["the same place", { kind: "task", id: "a" }, { kind: "task", id: "a" }, true],
    ["another id", { kind: "task", id: "a" }, { kind: "task", id: "b" }, false],
    [
      "another kind with the same id",
      { kind: "task", id: "a" },
      { kind: "review", id: "a" },
      false,
    ],
    ["two places without an id", HOME, { kind: "home" }, true],
    [
      "two pages of Settings",
      { kind: "settings", section: "defaults" },
      { kind: "settings", section: "prd" },
      true,
    ],
    ["the same item that left", GONE, { ...GONE, name: "other" }, true],
    ["another item that left with the same id", GONE, { ...GONE, item: "review" }, false],
  ])("%s", (_name, a, b, same) => {
    expect(sameLocation(a, b)).toBe(same);
  });
});

describe("locationExists", () => {
  it.each<[Location, boolean]>([
    [HOME, true],
    [{ kind: "reviews" }, true],
    [{ kind: "history" }, true],
    [{ kind: "settings", section: "boards" }, true],
    [{ kind: "board", id: "board-1" }, true],
    [{ kind: "board", id: "board-9" }, false],
    [{ kind: "task", id: "task-1" }, true],
    [{ kind: "task", id: "task-9" }, false],
    [{ kind: "review", id: "review-1" }, true],
    [{ kind: "review", id: "review-9" }, false],
    [{ kind: "discussion", id: "discussion-1" }, true],
    [{ kind: "discussion", id: "discussion-9" }, false],
    [{ kind: "archived-task", id: "archived-1" }, true],
    [{ kind: "archived-task", id: "task-1" }, false],
    [{ kind: "archived-review", id: "archived-review-1" }, true],
    [{ kind: "archived-review", id: "review-1" }, false],
    [{ kind: "archived-discussion", id: "archived-discussion-1" }, true],
    [{ kind: "archived-discussion", id: "discussion-1" }, false],
    [GONE, false],
  ])("%o is %s", (location, exists) => {
    expect(locationExists(app, location)).toBe(exists);
  });
});

describe("locationTitle", () => {
  it.each<[Location, string]>([
    [HOME, "Home"],
    [{ kind: "reviews" }, "Reviews"],
    [{ kind: "history" }, "History"],
    [{ kind: "settings", section: "prd" }, "Settings"],
    [{ kind: "board", id: "board-1" }, "Roadmap"],
    [{ kind: "task", id: "task-1" }, "add-login"],
    [{ kind: "review", id: "review-1" }, "Add the login screen"],
    [{ kind: "discussion", id: "discussion-1" }, "Invoices"],
    [{ kind: "archived-task", id: "archived-1" }, "old-task"],
    [{ kind: "archived-review", id: "archived-review-1" }, "Old review"],
    [{ kind: "archived-discussion", id: "archived-discussion-1" }, "Old talk"],
    [GONE, "left"],
    [{ kind: "task", id: "task-9" }, ""],
    [{ kind: "board", id: "board-9" }, ""],
  ])("%o is titled %j", (location, title) => {
    expect(locationTitle(app, location)).toBe(title);
  });
});

describe("breadcrumbOf", () => {
  it.each<[string, Location, ReturnType<typeof breadcrumbOf>]>([
    [
      "a task under a board",
      { kind: "task", id: "task-1" },
      [{ label: "Roadmap", location: { kind: "board", id: "board-1" } }],
    ],
    [
      "a task under an epic",
      { kind: "task", id: "task-2" },
      [
        { label: "Roadmap", location: { kind: "board", id: "board-1" } },
        { label: "Accounts", location: null },
      ],
    ],
    [
      "a task without a board",
      { kind: "task", id: "task-3" },
      [{ label: "No board", location: null }],
    ],
    [
      "a discussion",
      { kind: "discussion", id: "discussion-1" },
      [{ label: "Roadmap", location: { kind: "board", id: "board-1" } }],
    ],
    [
      "a discussion whose board is gone",
      { kind: "discussion", id: "discussion-2" },
      [{ label: "No board", location: null }],
    ],
    [
      "a review",
      { kind: "review", id: "review-1" },
      [{ label: "Reviews", location: { kind: "reviews" } }],
    ],
    [
      "an archived task",
      { kind: "archived-task", id: "archived-1" },
      [{ label: "History", location: { kind: "history" } }],
    ],
    [
      "an archived review",
      { kind: "archived-review", id: "archived-review-1" },
      [{ label: "History", location: { kind: "history" } }],
    ],
    [
      "an archived discussion",
      { kind: "archived-discussion", id: "archived-discussion-1" },
      [{ label: "History", location: { kind: "history" } }],
    ],
    ["a task that is gone", { kind: "task", id: "task-9" }, []],
    ["Home", HOME, []],
    ["a board", { kind: "board", id: "board-1" }, []],
    ["Settings", { kind: "settings", section: "defaults" }, []],
    ["an item that left", GONE, []],
  ])("%s", (_name, location, crumbs) => {
    expect(breadcrumbOf(app, location)).toEqual(crumbs);
  });
});

describe("openItemId and isActiveItem", () => {
  it.each<[Location, string | null]>([
    [{ kind: "task", id: "task-1" }, "task-1"],
    [{ kind: "review", id: "review-1" }, "review-1"],
    [{ kind: "discussion", id: "discussion-1" }, "discussion-1"],
    [{ kind: "archived-task", id: "archived-1" }, null],
    [{ kind: "board", id: "board-1" }, null],
    [HOME, null],
    [GONE, null],
  ])("%o opens %s", (location, id) => {
    expect(openItemId(location)).toBe(id);
    expect(isActiveItem(location)).toBe(id !== null);
  });
});

describe("isLocation", () => {
  it.each<[string, unknown, boolean]>([
    ["Home", { kind: "home" }, true],
    ["a task", { kind: "task", id: "task-1" }, true],
    ["a page of Settings", { kind: "settings", section: "pr_review" }, true],
    ["an item that left", GONE, true],
    ["the History", { kind: "history" }, true],
    ["the History on a fresh row", { kind: "history", fresh: { kind: "review", id: "r" } }, true],
    [
      "the History on a row of an unknown kind",
      { kind: "history", fresh: { kind: "card", id: "r" } },
      false,
    ],
    ["the History on a row without an id", { kind: "history", fresh: { kind: "task" } }, false],
    ["a task without an id", { kind: "task" }, false],
    ["a task with a numeric id", { kind: "task", id: 1 }, false],
    ["an unknown page of Settings", { kind: "settings", section: "colors" }, false],
    ["an item that left of an unknown kind", { ...GONE, item: "card" }, false],
    ["a task that left with its pull request", { ...GONE, pr: { number: 7, state: "open" } }, true],
    ["a task that left without a pull request", { ...GONE, pr: null }, true],
    [
      "a task that left with a pull request of an unknown state",
      { ...GONE, pr: { number: 7, state: "x" } },
      false,
    ],
    ["an item that left without a name", { ...GONE, name: undefined }, false],
    ["an unknown kind", { kind: "inbox" }, false],
    ["null", null, false],
    ["a string", "home", false],
  ])("%s is %s", (_name, value, valid) => {
    expect(isLocation(value)).toBe(valid);
  });
});

describe("withoutFresh", () => {
  it("takes the row off the History and leaves every other place as it is", () => {
    expect(withoutFresh({ kind: "history", fresh: { kind: "task", id: "t" } })).toEqual({
      kind: "history",
    });
    expect(withoutFresh({ kind: "task", id: "t" })).toEqual({ kind: "task", id: "t" });
    expect(withoutFresh(HOME)).toBe(HOME);
  });
});

describe("isLocationList", () => {
  it.each<[string, unknown, boolean]>([
    ["an empty list", [], true],
    ["a list of places", [HOME, { kind: "task", id: "task-1" }], true],
    ["a list with one invalid place", [HOME, { kind: "task" }], false],
    ["a place that is not a list", HOME, false],
  ])("%s is %s", (_name, value, valid) => {
    expect(isLocationList(value)).toBe(valid);
  });
});

describe("goneOutcome and goneTitle", () => {
  const leftApp = makeState({
    history: [makeArchivedTask({ id: "task-1" })],
    reviewHistory: [
      makeArchivedReview({ id: "review-1", outcome: "merged" }),
      makeArchivedReview({ id: "review-2", outcome: "closed" }),
    ],
    discussionHistory: [makeArchivedDiscussion({ id: "discussion-1" })],
  });
  const gone = (item: GoneLocation["item"], id: string, name: string): GoneLocation => ({
    kind: "gone",
    item,
    id,
    name,
    boardId: "",
  });

  it.each([
    [gone("task", "task-1", "add-login"), "archived", "add-login was closed and archived"],
    [gone("task", "task-9", "add-login"), "deleted", "add-login was deleted"],
    [gone("review", "review-1", "web#7"), "merged", "web#7 was merged, and its review ended"],
    [gone("review", "review-2", "web#7"), "closed", "web#7 was closed without a merge"],
    [gone("review", "review-9", "web#7"), "deleted", "web#7 was deleted"],
    [gone("discussion", "discussion-1", "Invoices"), "archived", "Invoices was archived"],
    [gone("discussion", "discussion-9", "Invoices"), "deleted", "Invoices was deleted"],
    [gone("board", "board-1", "Roadmap"), "removed", "This board was removed."],
  ] as const)("reads what became of %o", (location, outcome, title) => {
    expect(goneOutcome(leftApp, location)).toBe(outcome);
    expect(goneTitle(location, outcome)).toBe(title);
  });
});
