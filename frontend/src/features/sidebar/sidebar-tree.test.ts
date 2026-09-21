import { describe, expect, it } from "vitest";
import {
  nodesOfItem,
  type SidebarRow,
  sidebarTree,
  visibleRows,
} from "@/features/sidebar/sidebar-tree";
import type { CardIssue, DiscussionSummary } from "@/lib/wails";
import {
  makeBoard,
  makeDiscussion,
  makeRepository,
  makeState,
  makeTask,
  makeTaskCard,
} from "@/test/wails-mock";

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

function app(
  tasks = [task("t1", "repo-1")],
  boards = [ALPHA, BETA],
  discussions: DiscussionSummary[] = [],
) {
  return makeState({ repositories: [WEB, API, CLI], boards, tasks, discussions });
}

function discussion(id: string, boardId: string) {
  return makeDiscussion({ id, title: id, boardId });
}

const discussionIds = (rows: readonly { discussion: { id: string } }[]) =>
  rows.map((row) => row.discussion.id);

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

  it("puts a discussion under its board, in the order they were created", () => {
    const discussions = [discussion("d1", "board-1"), discussion("d2", "board-2")];
    const [alpha, beta] = sidebarTree(app([], [ALPHA, BETA], discussions), "", null, new Set());

    expect(discussionIds(alpha?.discussions ?? [])).toEqual(["d1"]);
    expect(discussionIds(beta?.discussions ?? [])).toEqual(["d2"]);
  });

  it("puts a discussion whose board is gone under no board", () => {
    const nodes = sidebarTree(
      app([], [ALPHA], [discussion("d1", "board-1"), discussion("d2", "board-gone")]),
      "",
      null,
      new Set(),
    );

    expect(nodes.map((node) => node.id)).toEqual(["board:board-1", "no-board"]);
    expect(discussionIds(nodes[1]?.discussions ?? [])).toEqual(["d2"]);
  });

  it("keeps the discussions of the board of the filter, which holds no repository of its own", () => {
    const discussions = [discussion("d1", "board-1"), discussion("d2", "board-2")];
    const nodes = sidebarTree(app([], [ALPHA, BETA], discussions), "repo-2", null, new Set());

    expect(nodes.map((node) => node.id)).toEqual(["board:board-2"]);
    expect(discussionIds(nodes[0]?.discussions ?? [])).toEqual(["d2"]);
  });

  it("marks the open discussion as selected", () => {
    const [alpha] = sidebarTree(
      app([], [ALPHA, BETA], [discussion("d1", "board-1")]),
      "",
      "d1",
      new Set(),
    );

    expect(alpha?.discussions[0]?.selected).toBe(true);
  });

  it("marks the open task as selected", () => {
    const [board] = sidebarTree(app(), "", "t1", new Set());

    expect(board?.tasks[0]?.selected).toBe(true);
  });
});

describe("visibleRows", () => {
  const tasks = [
    task("t1", "repo-1"),
    task("t2", "repo-1", LOGIN),
    task("t3", "repo-2"),
    task("t4", "repo-3"),
  ];
  const discussions = [discussion("d1", "board-1"), discussion("d2", "board-gone")];
  const nodes = sidebarTree(app(tasks, [ALPHA, BETA], discussions), "", null, new Set());
  const rowIds = (rows: readonly SidebarRow[]) =>
    rows.map((row) => (row.kind === "task" ? row.task.id : row.discussion.id));

  it("is every row in the order of the tree, with the discussions of a node after its tasks", () => {
    expect(rowIds(visibleRows(nodes, new Set()))).toEqual(["t2", "t1", "d1", "t3", "t4", "d2"]);
  });

  it("skips the rows of collapsed boards, epics and no board", () => {
    expect(rowIds(visibleRows(nodes, new Set(["epic:board-1:dev/web#1"])))).toEqual([
      "t1",
      "d1",
      "t3",
      "t4",
      "d2",
    ]);
    expect(rowIds(visibleRows(nodes, new Set(["board:board-1", "no-board"])))).toEqual(["t3"]);
  });
});

describe("nodesOfItem", () => {
  const tasks = [task("t1", "repo-1"), task("t2", "repo-1", LOGIN), task("t4", "repo-3")];
  const nodes = sidebarTree(
    app(tasks, [ALPHA, BETA], [discussion("d1", "board-1")]),
    "",
    null,
    new Set(),
  );

  it("is the board and the epic holding a task, outermost first", () => {
    expect(nodesOfItem(nodes, "t2")).toEqual(["board:board-1", "epic:board-1:dev/web#1"]);
    expect(nodesOfItem(nodes, "t1")).toEqual(["board:board-1"]);
    expect(nodesOfItem(nodes, "t4")).toEqual(["no-board"]);
  });

  it("is the board holding a discussion", () => {
    expect(nodesOfItem(nodes, "d1")).toEqual(["board:board-1"]);
  });

  it("is empty for an item the tree does not hold", () => {
    expect(nodesOfItem(nodes, "missing")).toEqual([]);
  });
});
