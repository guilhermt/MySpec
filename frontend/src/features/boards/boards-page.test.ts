import { describe, expect, it } from "vitest";
import {
  boardRowName,
  finalsLine,
  namesOf,
  projectRef,
  removalLines,
  removalSentence,
  repositoriesLine,
} from "@/features/boards/boards-page";
import { makeBoard, makeBoardRemoval, makeRepository } from "@/test/wails-mock";

const NOW = Date.parse("2026-09-16T12:05:00Z");
const TRAILER = "Tasks keep their cards, and nothing changes on GitHub or on disk.";

function repository(name: string, owner = "dev") {
  return makeRepository({ id: `${owner}-${name}`, owner, name, fullName: `${owner}/${name}` });
}

describe("projectRef", () => {
  it("is the owner, projects and the number", () => {
    expect(projectRef(makeBoard({ owner: "acme", number: 7 }))).toBe("acme/projects/7");
  });
});

describe("namesOf", () => {
  it.each([
    ["short names, alphabetical, when all are of the owner", ["dev/web", "dev/api"], "api, web"],
    ["owner/name in all when one is of another owner", ["dev/api", "ana/api"], "ana/api, dev/api"],
    ["nothing for no names", [], ""],
  ])("is %s", (_name, names, want) => {
    expect(namesOf("dev", names)).toBe(want);
  });
});

describe("repositoriesLine", () => {
  const ids = (...repositories: ReturnType<typeof repository>[]) =>
    repositories.map((entry) => entry.id);

  it("gives the type, the count and the short names in order", () => {
    const [web, api, docs] = [repository("web"), repository("api"), repository("docs")];
    const board = makeBoard({ repositoryIds: ids(web, api) });

    expect(repositoriesLine(board, [web, api, docs])).toBe(
      "Organization · 2 repositories: api, web",
    );
  });

  it("says one repository in the singular and a user as User", () => {
    const api = repository("api", "ana");
    const board = makeBoard({ owner: "ana", ownerType: "user", repositoryIds: ids(api) });

    expect(repositoriesLine(board, [api])).toBe("User · 1 repository: api");
  });

  it("writes owner/name in all when one repository is of another owner", () => {
    const [mine, theirs] = [repository("api"), repository("api", "ana")];
    const board = makeBoard({ repositoryIds: ids(mine, theirs) });

    expect(repositoriesLine(board, [mine, theirs])).toBe(
      "Organization · 2 repositories: ana/api, dev/api",
    );
  });

  it("says there are none", () => {
    expect(repositoriesLine(makeBoard({ repositoryIds: [] }), [repository("web")])).toBe(
      "Organization · No repositories",
    );
  });
});

describe("finalsLine", () => {
  it.each([
    [
      "the finals in the order of the board and the new card status",
      { newCardStatus: "todo" },
      "Final: Done · New cards: Todo",
    ],
    [
      "None for no final status and for no new card status",
      { statuses: [{ id: "todo", name: "Todo", final: false }] },
      "Final: None · New cards: None",
    ],
    [
      "the line of a board without a Status field",
      { hasStatus: false, statuses: [] },
      "No Status field: its cards end when their issues close",
    ],
  ])("is %s", (_name, overrides, want) => {
    expect(finalsLine(makeBoard(overrides))).toBe(want);
  });

  it("lists several finals", () => {
    const board = makeBoard({
      statuses: [
        { id: "a", name: "Done", final: true },
        { id: "b", name: "Won't do", final: true },
        { id: "c", name: "Todo", final: false },
      ],
    });

    expect(finalsLine(board)).toBe("Final: Done, Won't do · New cards: None");
  });
});

describe("boardRowName", () => {
  const failure = { reason: "failed", message: "boom", failedAt: "2026-09-16T12:04:00Z" };

  it.each([
    ["read", {}, "Roadmap, dev, 1 repository, read 5m ago"],
    ["never read", { readAt: "" }, "Roadmap, dev, 1 repository, not read yet"],
    ["failed", { failure }, "Roadmap, dev, 1 repository, read 5m ago, the last reading failed"],
  ])("names a board %s", (_name, overrides, want) => {
    expect(boardRowName(makeBoard(overrides), 1, NOW)).toBe(want);
  });
});

describe("removalSentence", () => {
  it.each([
    [
      { toNoBoard: 5, removed: 1 },
      `5 repositories move to No board and 1 leaves MySpec. ${TRAILER}`,
    ],
    [{ toNoBoard: 1, removed: 2 }, `1 repository moves to No board and 2 leave MySpec. ${TRAILER}`],
    [{ toNoBoard: 1, removed: 0 }, `1 repository moves to No board. ${TRAILER}`],
    [{ toNoBoard: 3, removed: 0 }, `3 repositories move to No board. ${TRAILER}`],
    [{ toNoBoard: 0, removed: 2 }, `2 repositories leave MySpec. ${TRAILER}`],
    [{ toNoBoard: 0, removed: 1 }, `1 repository leaves MySpec. ${TRAILER}`],
    [{ toNoBoard: 0, removed: 0 }, `The board has no repositories. ${TRAILER}`],
  ])("says %j", (counts, want) => {
    expect(removalSentence(makeBoardRemoval(counts))).toBe(want);
  });
});

describe("removalLines", () => {
  it("has a line for each destination with names", () => {
    const removal = makeBoardRemoval({
      toNoBoard: 2,
      removed: 1,
      toNoBoardNames: ["dev/web", "dev/api"],
      removedNames: ["dev/billing"],
    });

    expect(removalLines(makeBoard(), removal)).toEqual([
      { label: "To No board:", names: "api, web" },
      { label: "Leaves MySpec:", names: "billing, with no clone, tasks or reviews" },
    ]);
  });

  it("leaves out a destination without names", () => {
    const removal = makeBoardRemoval({ toNoBoard: 1, toNoBoardNames: ["dev/api"] });

    expect(removalLines(makeBoard(), removal)).toEqual([{ label: "To No board:", names: "api" }]);
    expect(removalLines(makeBoard(), makeBoardRemoval())).toEqual([]);
  });

  it("writes owner/name in all when a name is not of the owner of the board", () => {
    const removal = makeBoardRemoval({ removed: 2, removedNames: ["dev/api", "ana/api"] });

    expect(removalLines(makeBoard(), removal)).toEqual([
      { label: "Leaves MySpec:", names: "ana/api, dev/api, with no clone, tasks or reviews" },
    ]);
  });
});
