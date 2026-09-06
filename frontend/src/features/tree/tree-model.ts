import type { State, TaskSummary } from "@/lib/wails";
import { type NodeId, ROOT_NODE_ID, repoNodeId, type TreeUi } from "@/store/app-store";

export interface TreeNode {
  id: NodeId;
  label: string;
  path: string;
  isRoot: boolean;
}

export type TreeNodeRow = TreeNode & {
  kind: "node";
  level: 1 | 2;
  expanded: boolean;
  selected: boolean;
};

export type TreeTaskRow = {
  kind: "task";
  task: TaskSummary;
  level: 2 | 3;
  selected: boolean;
};

export type TreeRowModel =
  | TreeNodeRow
  | TreeTaskRow
  | { kind: "empty-tasks"; parentId: NodeId; level: 2 | 3 }
  | { kind: "empty-repos"; level: 2 };

export function isNodeRow(row: TreeRowModel): row is TreeNodeRow {
  return row.kind === "node";
}

/** isItemRow tells the rows the tree focuses apart from the filler ones. */
export function isItemRow(row: TreeRowModel): row is TreeNodeRow | TreeTaskRow {
  return row.kind === "node" || row.kind === "task";
}

/** treeNodes lists the root and its repositories, in the order Go sorted them. */
export function treeNodes(state: State): TreeNode[] {
  const workspace = state.workspace;
  if (workspace === null) {
    return [];
  }
  return [
    { id: ROOT_NODE_ID, label: workspace.name, path: workspace.path, isRoot: true },
    ...(workspace.repos ?? []).map((repo) => ({
      id: repoNodeId(repo.path),
      label: repo.name,
      path: repo.path,
      isRoot: false,
    })),
  ];
}

export function findNode(state: State, id: NodeId): TreeNode | null {
  return treeNodes(state).find((node) => node.id === id) ?? null;
}

function tasksOfNode(state: State, node: TreeNode): TaskSummary[] {
  const repoPath = node.isRoot ? "" : node.path;
  return (state.tasks ?? []).filter((task) => task.repoPath === repoPath);
}

export function visibleRows(state: State, ui: TreeUi): TreeRowModel[] {
  const [root, ...repos] = treeNodes(state);
  if (root === undefined) {
    return [];
  }

  const nodeRow = (node: TreeNode, level: 1 | 2): TreeNodeRow => ({
    ...node,
    kind: "node",
    // A node loses the selection to the task the main area is showing.
    selected: ui.selectedNodeId === node.id && ui.openTaskId === null,
    level,
    expanded: ui.expandedNodeIds.has(node.id),
  });

  const taskRows = (node: TreeNode, level: 2 | 3): TreeRowModel[] => {
    const tasks = tasksOfNode(state, node);
    if (tasks.length === 0) {
      return [{ kind: "empty-tasks", parentId: node.id, level }];
    }
    return tasks.map((task) => ({
      kind: "task",
      task,
      level,
      selected: ui.openTaskId === task.id,
    }));
  };

  const rows: TreeRowModel[] = [nodeRow(root, 1)];
  if (!ui.expandedNodeIds.has(root.id)) {
    return rows;
  }

  rows.push(...taskRows(root, 2));
  if (repos.length === 0) {
    rows.push({ kind: "empty-repos", level: 2 });
    return rows;
  }

  for (const repo of repos) {
    rows.push(nodeRow(repo, 2));
    if (ui.expandedNodeIds.has(repo.id)) {
      rows.push(...taskRows(repo, 3));
    }
  }
  return rows;
}

export function rowKey(row: TreeRowModel): string {
  switch (row.kind) {
    case "node":
      return row.id;
    case "task":
      return `task:${row.task.id}`;
    case "empty-tasks":
      return `tasks:${row.parentId}`;
    case "empty-repos":
      return "repos";
  }
}
