import { describe, expect, it } from "vitest";
import { nodesOfTask, sidebarTree, visibleTaskRows } from "@/features/sidebar/sidebar-tree";
import type { CardIssue } from "@/lib/wails";
import { makeBoard, makeRepository, makeState, makeTask, makeTaskCard } from "@/test/wails-mock";

const ALPHA = makeBoard({ id: "board-1", title: "Alpha", repositoryIds: ["repo-1"] });
const BETA = makeBoard({ id: "board-2", title: "Beta", repositoryIds: ["repo-2"] });

const WEB = makeRepository({ boardId: "board-1" });
const API = makeRepository({ id: "repo-2", name: "api", fullName: "dev/api", boardId: "board-2" });
const CLI = makeRepository({ id: "repo-3", name: "cli", fullName: "dev/cli" });

function epic(key: string, title: string): CardIssue {
  return { key, repository: "dev/web", number: 1, title, url: "", state: "" };
}

const LOGIN = epic("dev/web#1", "Login");
const BILLING = epic("dev/web#2", "Billing");

function task(id: string, repositoryId: string, epicIssue: CardIssue | null = null) {
  return makeTask({
    id,
    name: id,
    repositoryId,
    card: epicIssue === null ? null : makeTaskCard({ epic: epicIssue }),
  });
}

function app(tasks = [task("t1", "repo-1")], boards = [ALPHA, BETA]) {
  return makeState({ repositories: [WEB, API, CLI], boards, tasks });
}

const ids = (rows: readonly { task: { id: string } }[]) => rows.map((row) => row.task.id);

describe("sidebarTree", () => {
  it("shows every board with no filter, even without tasks, in the order of the boards", () => {
    const nodes = sidebarTree(app(), "", null, new Set());

    expect(nodes.map((node) => node.id)).toEqual(["board:board-1", "board:board-2"]);
    expect(nodes[1]?.tasks).toEqual([]);
  });

  it("groups the tasks of a board by epic, in the order of each epic's first task, then the rest", () => {
    const tasks = [
      task("t1", "repo-1"),
      task("t2", "repo-1", BILLING),
      task("t3", "repo-1", LOGIN),
      task("t4", "repo-1", BILLING),
    ];
    const [board] = sidebarTree(app(tasks), "", null, new Set());

    expect(board?.kind).toBe("board");
    if (board?.kind !== "board") {
      return;
    }
    expect(board.epics.map((node) => [node.id, node.title, ids(node.tasks)])).toEqual([
      ["epic:board-1:dev/web#2", "Billing", ["t2", "t4"]],
      ["epic:board-1:dev/web#1", "Login", ["t3"]],
    ]);
    expect(ids(board.tasks)).toEqual(["t1"]);
  });

  it("puts the tasks of repositories without a board under no board, only when there are some", () => {
    const withLoose = sidebarTree(app([task("t1", "repo-3")]), "", null, new Set());
    expect(withLoose.map((node) => node.id)).toEqual([
      "board:board-1",
      "board:board-2",
      "no-board",
    ]);
    expect(ids(withLoose[2]?.tasks ?? [])).toEqual(["t1"]);

    const without = sidebarTree(app([task("t1", "repo-1")]), "", null, new Set());
    expect(without.some((node) => node.kind === "no-board")).toBe(false);
  });

  it("keeps only the board of the repository of the filter", () => {
    const tasks = [task("t1", "repo-1"), task("t2", "repo-2")];
    const nodes = sidebarTree(app(tasks), "repo-2", null, new Set());

    expect(nodes.map((node) => node.id)).toEqual(["board:board-2"]);
    expect(ids(nodes[0]?.tasks ?? [])).toEqual(["t2"]);
  });

  it("shows only no board for a filtered repository without a board", () => {
    const tasks = [task("t1", "repo-1"), task("t3", "repo-3")];

    expect(sidebarTree(app(tasks), "repo-3", null, new Set()).map((node) => node.id)).toEqual([
      "no-board",
    ]);
    expect(sidebarTree(app([]), "repo-3", null, new Set())).toEqual([]);
  });

  it("marks the open task as selected", () => {
    const [board] = sidebarTree(app(), "", "t1", new Set());

    expect(board?.tasks[0]?.selected).toBe(true);
  });
});

describe("visibleTaskRows", () => {
  const tasks = [
    task("t1", "repo-1"),
    task("t2", "repo-1", LOGIN),
    task("t3", "repo-2"),
    task("t4", "repo-3"),
  ];
  const nodes = sidebarTree(app(tasks), "", null, new Set());

  it("is every row in the order of the tree when nothing is collapsed", () => {
    expect(ids(visibleTaskRows(nodes, new Set()))).toEqual(["t2", "t1", "t3", "t4"]);
  });

  it("skips the rows of collapsed boards, epics and no board", () => {
    expect(ids(visibleTaskRows(nodes, new Set(["epic:board-1:dev/web#1"])))).toEqual([
      "t1",
      "t3",
      "t4",
    ]);
    expect(ids(visibleTaskRows(nodes, new Set(["board:board-1", "no-board"])))).toEqual(["t3"]);
  });
});

describe("nodesOfTask", () => {
  const tasks = [task("t1", "repo-1"), task("t2", "repo-1", LOGIN), task("t4", "repo-3")];
  const nodes = sidebarTree(app(tasks), "", null, new Set());

  it("is the board and the epic holding a task, outermost first", () => {
    expect(nodesOfTask(nodes, "t2")).toEqual(["board:board-1", "epic:board-1:dev/web#1"]);
    expect(nodesOfTask(nodes, "t1")).toEqual(["board:board-1"]);
    expect(nodesOfTask(nodes, "t4")).toEqual(["no-board"]);
  });

  it("is empty for a task the tree does not hold", () => {
    expect(nodesOfTask(nodes, "missing")).toEqual([]);
  });
});
