import { describe, expect, it } from "vitest";
import {
  boardOfRepository,
  findBoard,
  issueLabel,
  prStateLabel,
  repositoryByFullName,
  stateLabel,
} from "@/lib/boards";
import { makeBoard, makeRepository, makeState } from "@/test/wails-mock";

const ROADMAP = makeBoard();
const OPS = makeBoard({ id: "board-2", title: "Ops", repositoryIds: ["repo-2"] });
const WEB = makeRepository({ boardId: "board-1" });
const API = makeRepository({ id: "repo-2", name: "api", fullName: "dev/api", boardId: "board-2" });
const LOOSE = makeRepository({ id: "repo-3", name: "cli", fullName: "dev/cli" });

const app = makeState({ boards: [ROADMAP, OPS], repositories: [WEB, API, LOOSE] });

describe("findBoard", () => {
  it("is the board of an id", () => {
    expect(findBoard(app, "board-2")).toBe(OPS);
  });

  it("is null for an id no board has, or before the first snapshot", () => {
    expect(findBoard(app, "board-9")).toBeNull();
    expect(findBoard(null, "board-1")).toBeNull();
  });
});

describe("boardOfRepository", () => {
  it("is the board that manages the repository", () => {
    expect(boardOfRepository(app, "repo-2")).toBe(OPS);
  });

  it("is null for a repository without a board, or not registered", () => {
    expect(boardOfRepository(app, "repo-3")).toBeNull();
    expect(boardOfRepository(app, "repo-9")).toBeNull();
  });
});

describe("repositoryByFullName", () => {
  it("is the registered repository of an owner/name", () => {
    expect(repositoryByFullName(app, "dev/api")).toBe(API);
  });

  it("matches an owner/name written in another case", () => {
    expect(repositoryByFullName(app, "Dev/API")).toBe(API);
  });

  it("is null for a repository not registered", () => {
    expect(repositoryByFullName(app, "dev/other")).toBeNull();
    expect(repositoryByFullName(null, "dev/api")).toBeNull();
  });
});

describe("labels", () => {
  it("names an issue by its number", () => {
    expect(issueLabel({ number: 12 })).toBe("#12");
  });

  it("names the states of a pull request and of an issue", () => {
    expect(prStateLabel("open")).toBe("Open");
    expect(prStateLabel("merged")).toBe("Merged");
    expect(prStateLabel("closed")).toBe("Closed");
    expect(stateLabel("open")).toBe("Open");
    expect(stateLabel("closed")).toBe("Closed");
  });
});
