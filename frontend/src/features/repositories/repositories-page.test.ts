import { describe, expect, it } from "vitest";
import {
  blockLine,
  countsLine,
  pathLine,
  removeReason,
  removeSentence,
  repositoryGroups,
  rowName,
} from "@/features/repositories/repositories-page";
import { makeBoard, makeRepository } from "@/test/wails-mock";

const repo = (name: string, overrides = {}) =>
  makeRepository({
    id: `repo-${name}`,
    name,
    fullName: `dev/${name}`,
    path: `/home/dev/code/${name}`,
    ...overrides,
  });

describe("repositoryGroups", () => {
  it("puts the repositories without a clone first, then those whose clone is gone, then a group per board and No board", () => {
    const groups = repositoryGroups(
      [
        repo("zed", { boardId: "board-2" }),
        repo("gone", { missing: true, boardId: "board-1" }),
        repo("loose"),
        repo("bare", { cloned: false, path: "", boardId: "board-1" }),
        repo("api", { boardId: "board-1" }),
        repo("also-bare", { cloned: false, path: "" }),
      ],
      [makeBoard({ id: "board-2", title: "Zeta" }), makeBoard({ id: "board-1", title: "Alpha" })],
    );

    expect(groups.map((group) => [group.title, group.repositories.map((r) => r.name)])).toEqual([
      ["Needs a clone", ["also-bare", "bare", "gone"]],
      ["Alpha", ["api"]],
      ["Zeta", ["zed"]],
      ["No board", ["loose"]],
    ]);
    expect(groups[0]?.note).toBe("Their cards can't start a task until they have one");
    expect(groups[1]?.note).toBe("");
  });

  it("leaves out the groups with nothing in them", () => {
    const groups = repositoryGroups([repo("api")], [makeBoard()]);

    expect(groups.map((group) => group.title)).toEqual(["No board"]);
  });

  it("keeps a repository of a board that is gone under No board", () => {
    const groups = repositoryGroups([repo("api", { boardId: "board-9" })], []);

    expect(groups.map((group) => group.title)).toEqual(["No board"]);
  });

  it("is empty without repositories", () => {
    expect(repositoryGroups([], [makeBoard()])).toEqual([]);
  });
});

describe("pathLine", () => {
  it.each([
    ["a clone", repo("web"), "Roadmap", false, "~/code/web"],
    ["no clone", repo("web", { cloned: false, path: "" }), null, false, "Not cloned"],
    [
      "no clone in Needs a clone",
      repo("web", { cloned: false, path: "" }),
      "Platform Roadmap",
      true,
      "Platform Roadmap · Not cloned",
    ],
    [
      "a missing clone and no board",
      repo("web", { missing: true }),
      null,
      true,
      "No board · ~/code/web",
    ],
    [
      "instructions",
      repo("web", { reviewInstructions: "Look at the migrations." }),
      null,
      false,
      "~/code/web · Review instructions set",
    ],
    ["blank instructions", repo("web", { reviewInstructions: "  \n" }), null, false, "~/code/web"],
  ])("is the line of %s", (_name, repository, board, needs, expected) => {
    expect(pathLine(repository, board, needs)).toBe(expected);
  });
});

describe("countsLine", () => {
  it.each([
    [{ activeTasks: 4, archivedTasks: 7, activeReviews: 1 }, "4 active · 7 archived · 1 review"],
    [{ archivedTasks: 2 }, "2 archived"],
    [{ activeReviews: 1, archivedReviews: 2 }, "3 reviews"],
    [{}, "No tasks or reviews"],
  ])("reads %j as %s", (overrides, expected) => {
    expect(countsLine(makeRepository(overrides))).toBe(expected);
  });
});

describe("rowName", () => {
  it("names the repository, its clone and what it holds", () => {
    const repository = repo("web", { activeTasks: 4, archivedTasks: 7, activeReviews: 1 });

    expect(rowName(repository)).toBe(
      "dev/web, ~/code/web, 4 active tasks, 7 archived tasks, 1 review",
    );
  });

  it("says it has no clone and holds nothing", () => {
    expect(rowName(repo("web", { cloned: false, path: "" }))).toBe(
      "dev/web, not cloned, no tasks or reviews",
    );
  });
});

describe("removeReason", () => {
  it.each([
    [{}, null],
    [{ activeTasks: 1 }, "1 active task: delete them first."],
    [
      { archivedTasks: 8, activeReviews: 1, archivedReviews: 3 },
      "8 archived tasks and 4 reviews: delete them first.",
    ],
    [
      { activeTasks: 2, archivedTasks: 1, archivedReviews: 1 },
      "2 active tasks, 1 archived task and 1 review: delete them first.",
    ],
  ])("says %j as %s", (overrides, expected) => {
    expect(removeReason(makeRepository(overrides))).toBe(expected);
  });
});

describe("blockLine", () => {
  it("is none for a clone that is there", () => {
    expect(blockLine(repo("web"), "")).toBeNull();
  });

  it("offers Clone to a repository without a clone", () => {
    expect(blockLine(repo("web", { cloned: false }), "")).toEqual({
      kind: "no-clone",
      text: "Its cards can't start a task until it's cloned.",
      action: "clone",
    });
  });

  it("says where the clone goes while it runs, or only that it runs", () => {
    const cloning = repo("android", { cloned: false, cloning: true });

    expect(blockLine(cloning, "/home/dev/code")).toEqual({
      kind: "cloning",
      text: "Cloning into ~/code/android…",
    });
    expect(blockLine(cloning, "")).toEqual({ kind: "cloning", text: "Cloning…" });
  });

  it("shows the failure of the clone with the paths from home", () => {
    const failed = repo("web", { cloned: false, cloneError: "fatal: /home/dev/code/web exists" });

    expect(blockLine(failed, "")).toEqual({
      kind: "failed",
      text: "fatal: ~/code/web exists",
      action: "try-again",
    });
  });

  it("offers Change path… to a clone that is gone", () => {
    expect(blockLine(repo("web", { missing: true }), "")).toEqual({
      kind: "missing",
      text: "The clone is missing. Its tasks can't start a step or close until it has one.",
      action: "change-path",
    });
  });
});

describe("removeSentence", () => {
  it.each([
    [
      "board and clone",
      repo("docs"),
      "Platform Roadmap",
      "The repository leaves MySpec and the board Platform Roadmap. Nothing is deleted on disk: the clone stays at ~/code/docs.",
    ],
    [
      "clone only",
      repo("docs"),
      null,
      "The repository leaves MySpec. Nothing is deleted on disk: the clone stays at ~/code/docs.",
    ],
    [
      "board only",
      repo("docs", { cloned: false, path: "" }),
      "Platform Roadmap",
      "The repository leaves MySpec and the board Platform Roadmap. Nothing is deleted on disk.",
    ],
    [
      "a clone that is gone",
      repo("docs", { missing: true }),
      null,
      "The repository leaves MySpec. Nothing is deleted on disk.",
    ],
  ])("says it with %s", (_name, repository, board, expected) => {
    expect(removeSentence(repository, board)).toBe(expected);
  });
});
