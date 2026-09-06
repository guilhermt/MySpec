import { describe, expect, it } from "vitest";
import { rowKey, type TreeRowModel, visibleRows } from "@/features/tree/tree-model";
import { type NodeId, ROOT_NODE_ID, repoNodeId, type TreeUi } from "@/store/app-store";
import { makeState, makeTask } from "@/test/wails-mock";

const WEB = "/home/dev/projects/web";

const ROOT_TASK = makeTask({ id: "t-root", name: "add-login", repoPath: "" });
const WEB_TASK = makeTask({ id: "t-web", name: "fix-header", repoPath: WEB });

function ui(overrides: Partial<TreeUi> = {}): TreeUi {
  return {
    selectedNodeId: ROOT_NODE_ID,
    expandedNodeIds: new Set<NodeId>([ROOT_NODE_ID]),
    openTaskId: null,
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

  it("selects the node while no task is open", () => {
    const state = makeState({ tasks: [ROOT_TASK] });

    const rows = visibleRows(state, ui());

    expect(shape(rows.filter((row) => "selected" in row && row.selected))).toEqual([
      "node:projects:1",
    ]);
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
