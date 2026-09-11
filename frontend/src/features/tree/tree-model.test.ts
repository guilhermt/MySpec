import { describe, expect, it } from "vitest";
import {
  isNodeRow,
  rowKey,
  type TreeNodeRow,
  type TreeRowModel,
  type TreeTaskRow,
  visibleRows,
} from "@/features/tree/tree-model";
import { type NodeId, ROOT_NODE_ID, repoNodeId, type TreeUi } from "@/store/app-store";
import { makeSituation, makeState, makeTask } from "@/test/wails-mock";

const API = "/home/dev/projects/api";
const WEB = "/home/dev/projects/web";

const ROOT_TASK = makeTask({ id: "t-root", name: "add-login", repoPath: "" });
const WEB_TASK = makeTask({ id: "t-web", name: "fix-header", repoPath: WEB });

function ui(overrides: Partial<TreeUi> = {}): TreeUi {
  return {
    selectedNodeId: ROOT_NODE_ID,
    expandedNodeIds: new Set<NodeId>([ROOT_NODE_ID]),
    openTaskId: null,
    historyOpen: false,
    flashing: new Set<string>(),
    ...overrides,
  };
}

function describeRow(row: TreeRowModel): string {
  switch (row.kind) {
    case "node":
      return `node:${row.label}:${row.level}`;
    case "task":
      return `task:${row.task.name}:${row.level}`;
    case "empty-tasks":
      return `empty-tasks:${row.parentId}`;
    case "empty-repos":
      return "empty-repos";
  }
}

function shape(rows: TreeRowModel[]): string[] {
  return rows.map(describeRow);
}

describe("visibleRows", () => {
  it("lists the tasks of the root before the repositories", () => {
    const state = makeState({ tasks: [ROOT_TASK, WEB_TASK] });

    expect(shape(visibleRows(state, ui()))).toEqual([
      "node:projects:1",
      "task:add-login:2",
      "node:api:2",
      "node:web:2",
    ]);
  });

  it("puts the tasks of a repository under it when it is expanded", () => {
    const state = makeState({ tasks: [ROOT_TASK, WEB_TASK] });
    const expanded = new Set<NodeId>([ROOT_NODE_ID, repoNodeId(WEB)]);

    expect(shape(visibleRows(state, ui({ expandedNodeIds: expanded })))).toEqual([
      "node:projects:1",
      "task:add-login:2",
      "node:api:2",
      "node:web:2",
      "task:fix-header:3",
    ]);
  });

  it("keeps the empty state of a node without tasks", () => {
    const state = makeState({ tasks: [WEB_TASK] });
    const expanded = new Set<NodeId>([ROOT_NODE_ID, repoNodeId("/home/dev/projects/api")]);

    expect(shape(visibleRows(state, ui({ expandedNodeIds: expanded })))).toEqual([
      "node:projects:1",
      "empty-tasks:root",
      "node:api:2",
      `empty-tasks:repo:/home/dev/projects/api`,
      "node:web:2",
    ]);
  });

  it("hides every task while the root is collapsed", () => {
    const state = makeState({ tasks: [ROOT_TASK] });

    expect(shape(visibleRows(state, ui({ expandedNodeIds: new Set<NodeId>() })))).toEqual([
      "node:projects:1",
    ]);
  });

  it("selects the open task and no node", () => {
    const state = makeState({ tasks: [ROOT_TASK] });

    const rows = visibleRows(state, ui({ openTaskId: "t-root" }));

    expect(rows.filter((row) => "selected" in row && row.selected)).toHaveLength(1);
    expect(shape(rows.filter((row) => "selected" in row && row.selected))).toEqual([
      "task:add-login:2",
    ]);
  });

  it("selects no node while the history is open", () => {
    const state = makeState({ tasks: [ROOT_TASK] });

    const rows = visibleRows(state, ui({ historyOpen: true }));

    expect(rows.filter((row) => "selected" in row && row.selected)).toHaveLength(0);
  });

  it("selects the node while no task is open", () => {
    const state = makeState({ tasks: [ROOT_TASK] });

    const rows = visibleRows(state, ui());

    expect(shape(rows.filter((row) => "selected" in row && row.selected))).toEqual([
      "node:projects:1",
    ]);
  });
});

describe("visibleRows situations", () => {
  const ROOT_REPLY = makeSituation({
    id: "root-reply",
    taskId: "t-root",
    kind: "reply",
    startedAt: "2026-09-05T10:00:00Z",
  });
  const API_DRAFT = makeSituation({
    id: "api-draft",
    taskId: "t-api",
    kind: "draft",
    startedAt: "2026-09-05T09:00:00Z",
  });
  const WEB_ERROR = makeSituation({
    id: "web-error",
    taskId: "t-web",
    kind: "session_error",
    group: "error",
    startedAt: "2026-09-05T11:00:00Z",
  });

  const state = makeState({
    tasks: [
      makeTask({ id: "t-root", name: "add-login", repoPath: "", situations: [ROOT_REPLY] }),
      makeTask({ id: "t-api", name: "add-token", repoPath: API, situations: [API_DRAFT] }),
      makeTask({ id: "t-web", name: "fix-header", repoPath: WEB, situations: [WEB_ERROR] }),
    ],
  });

  function nodeRow(rows: readonly TreeRowModel[], label: string): TreeNodeRow {
    const row = rows.filter(isNodeRow).find((candidate) => candidate.label === label);
    if (row === undefined) {
      throw new Error(`no node row named ${label}`);
    }
    return row;
  }

  function taskRow(rows: readonly TreeRowModel[], id: string): TreeTaskRow {
    const row = rows.find(
      (candidate): candidate is TreeTaskRow =>
        candidate.kind === "task" && candidate.task.id === id,
    );
    if (row === undefined) {
      throw new Error(`no task row for ${id}`);
    }
    return row;
  }

  const ids = (row: TreeNodeRow) => row.hidden.map((situation) => situation.id);

  it("hides every situation of the workspace under the collapsed root, most urgent first", () => {
    const rows = visibleRows(state, ui({ expandedNodeIds: new Set<NodeId>() }));

    expect(ids(nodeRow(rows, "projects"))).toEqual(["web-error", "api-draft", "root-reply"]);
  });

  it("hides only its own situations under a collapsed repository", () => {
    const rows = visibleRows(state, ui());

    expect(ids(nodeRow(rows, "api"))).toEqual(["api-draft"]);
    expect(ids(nodeRow(rows, "web"))).toEqual(["web-error"]);
  });

  it("hides nothing under an expanded node, whose task rows show the situations", () => {
    const expanded = new Set<NodeId>([ROOT_NODE_ID, repoNodeId(WEB)]);

    const rows = visibleRows(state, ui({ expandedNodeIds: expanded }));

    expect(ids(nodeRow(rows, "projects"))).toEqual([]);
    expect(ids(nodeRow(rows, "web"))).toEqual([]);
  });

  it("highlights a task that is not open and leaves the open one alone", () => {
    const flashing = new Set(["root-reply"]);

    expect(taskRow(visibleRows(state, ui({ flashing })), "t-root").flashing).toBe(true);
    expect(
      taskRow(visibleRows(state, ui({ flashing, openTaskId: "t-root" })), "t-root").flashing,
    ).toBe(false);
  });

  it("highlights the collapsed node that hides the situation, and only that one", () => {
    const flashing = new Set(["web-error"]);

    const rows = visibleRows(state, ui({ flashing }));
    expect(nodeRow(rows, "web").flashing).toBe(true);
    expect(nodeRow(rows, "api").flashing).toBe(false);
    // The expanded root hides nothing: the repository holds the highlight.
    expect(nodeRow(rows, "projects").flashing).toBe(false);

    const collapsed = visibleRows(state, ui({ flashing, expandedNodeIds: new Set<NodeId>() }));
    expect(nodeRow(collapsed, "projects").flashing).toBe(true);
  });
});

describe("rowKey", () => {
  it("names a task row by its id", () => {
    const [row] = visibleRows(makeState({ tasks: [ROOT_TASK] }), ui()).filter(
      (candidate) => candidate.kind === "task",
    );

    expect(row === undefined ? "" : rowKey(row)).toBe("task:t-root");
  });
});
