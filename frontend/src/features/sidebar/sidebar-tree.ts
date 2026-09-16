import { type TaskRow, taskRows } from "@/features/sidebar/task-list";
import { boardOfRepository } from "@/lib/boards";
import { ALL_REPOSITORIES, tasksInFilter } from "@/lib/repositories";
import type { Board, State } from "@/lib/wails";

/** SidebarNode is a top node of the sidebar: a board, or the tasks of no board. */
export type SidebarNode =
  | { kind: "board"; id: string; board: Board; epics: EpicNode[]; tasks: TaskRow[] }
  | { kind: "no-board"; id: "no-board"; tasks: TaskRow[] };

/** EpicNode is the tasks of a board whose cards share an epic. */
export interface EpicNode {
  id: string;
  key: string;
  title: string;
  tasks: TaskRow[];
}

const NO_BOARD_ID = "no-board";

const boardNodeId = (boardId: string) => `board:${boardId}`;
const epicNodeId = (boardId: string, key: string) => `epic:${boardId}:${key}`;

/**
 * sidebarTree is the tasks of the filter grouped by board and, inside a board,
 * by epic. Every board shows with no filter; a repository filter shows only its
 * board. The tasks keep the order they were created in.
 */
export function sidebarTree(
  app: State,
  filter: string,
  openTaskId: string | null,
  flashing: ReadonlySet<string>,
): SidebarNode[] {
  const rows = taskRows(tasksInFilter(app.tasks ?? [], filter), openTaskId, flashing);

  let boards: readonly Board[] = app.boards ?? [];
  if (filter !== ALL_REPOSITORIES) {
    const board = boardOfRepository(app, filter);
    boards = board === null ? [] : [board];
  }

  const nodes: SidebarNode[] = boards.map((board) => {
    const tasks = rows.filter(
      (row) => boardOfRepository(app, row.task.repositoryId)?.id === board.id,
    );
    const epics: EpicNode[] = [];
    for (const row of tasks) {
      const epic = row.task.card?.epic;
      if (epic === null || epic === undefined) {
        continue;
      }
      const node = epics.find((candidate) => candidate.key === epic.key);
      if (node === undefined) {
        epics.push({
          id: epicNodeId(board.id, epic.key),
          key: epic.key,
          title: epic.title,
          tasks: [row],
        });
      } else {
        node.tasks.push(row);
      }
    }
    return {
      kind: "board",
      id: boardNodeId(board.id),
      board,
      epics,
      tasks: tasks.filter((row) => !row.task.card?.epic),
    };
  });

  const loose = rows.filter((row) => boardOfRepository(app, row.task.repositoryId) === null);
  if (loose.length > 0) {
    nodes.push({ kind: "no-board", id: NO_BOARD_ID, tasks: loose });
  }
  return nodes;
}

/** visibleTaskRows is the task rows on screen, in their order, skipping collapsed nodes. */
export function visibleTaskRows(
  nodes: readonly SidebarNode[],
  collapsed: ReadonlySet<string>,
): TaskRow[] {
  return nodes.flatMap((node) => {
    if (collapsed.has(node.id)) {
      return [];
    }
    if (node.kind === "no-board") {
      return node.tasks;
    }
    const epicRows = node.epics.flatMap((epic) => (collapsed.has(epic.id) ? [] : epic.tasks));
    return [...epicRows, ...node.tasks];
  });
}

/** nodesOfTask is the ids of the nodes holding a task, outermost first; empty when none does. */
export function nodesOfTask(nodes: readonly SidebarNode[], taskId: string): string[] {
  const holds = (rows: readonly TaskRow[]) => rows.some((row) => row.task.id === taskId);
  for (const node of nodes) {
    if (node.kind === "board") {
      const epic = node.epics.find((candidate) => holds(candidate.tasks));
      if (epic !== undefined) {
        return [node.id, epic.id];
      }
    }
    if (holds(node.tasks)) {
      return [node.id];
    }
  }
  return [];
}
