import { type TaskRow, taskRows } from "@/features/sidebar/task-list";
import { boardOfRepository } from "@/lib/boards";
import { ALL_REPOSITORIES, tasksInFilter } from "@/lib/repositories";
import type { Board, DiscussionSummary, State } from "@/lib/wails";

/** DiscussionRow is one discussion of the tree, with how its row looks. */
export interface DiscussionRow {
  kind: "discussion";
  discussion: DiscussionSummary;
  /** selected is the discussion being the open item. */
  selected: boolean;
  /** flashing is a situation of the discussion having just started while it is not open. */
  flashing: boolean;
}

/** SidebarRow is one row of the tree: a task, or a discussion. */
export type SidebarRow = ({ kind: "task" } & TaskRow) | DiscussionRow;

/** SidebarNode is a top node of the sidebar: a board, or the items of no board. */
export type SidebarNode =
  | {
      kind: "board";
      id: string;
      board: Board;
      epics: EpicNode[];
      tasks: TaskRow[];
      discussions: DiscussionRow[];
    }
  | { kind: "no-board"; id: "no-board"; tasks: TaskRow[]; discussions: DiscussionRow[] };

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

const asRow = (row: TaskRow): SidebarRow => ({ kind: "task", ...row });

/** rowId is the item a row stands for. */
export function rowId(row: SidebarRow): string {
  return row.kind === "task" ? row.task.id : row.discussion.id;
}

// A discussion belongs to no repository, so the repository filter never hides
// it: it shows under the board it runs on, and the board the filter keeps.
function discussionRows(
  discussions: readonly DiscussionSummary[],
  openItemId: string | null,
  flashing: ReadonlySet<string>,
): DiscussionRow[] {
  return discussions.map((discussion) => ({
    kind: "discussion",
    discussion,
    selected: discussion.id === openItemId,
    flashing:
      discussion.id !== openItemId &&
      (discussion.situations ?? []).some((situation) => flashing.has(situation.id)),
  }));
}

/**
 * sidebarTree is the items of the filter grouped by board and, inside a board,
 * by epic. Every board shows with no filter; a repository filter shows only its
 * board. The items keep the order they were created in, with the discussions of
 * a node after its tasks. openItemId is the task or the discussion on screen.
 */
export function sidebarTree(
  app: State,
  filter: string,
  openItemId: string | null,
  flashing: ReadonlySet<string>,
): SidebarNode[] {
  const rows = taskRows(tasksInFilter(app.tasks ?? [], filter), openItemId, flashing);
  const discussions = discussionRows(app.discussions ?? [], openItemId, flashing);

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
      discussions: discussions.filter((row) => row.discussion.boardId === board.id),
    };
  });

  const loose = rows.filter((row) => boardOfRepository(app, row.task.repositoryId) === null);
  // A discussion outlives the board it ran on: when the board goes, it goes to
  // no board, whatever the filter keeps.
  const looseDiscussions = discussions.filter(
    (row) => !(app.boards ?? []).some((board) => board.id === row.discussion.boardId),
  );
  if (loose.length > 0 || looseDiscussions.length > 0) {
    nodes.push({
      kind: "no-board",
      id: NO_BOARD_ID,
      tasks: loose,
      discussions: looseDiscussions,
    });
  }
  return nodes;
}

/** visibleRows is the rows on screen, in their order, skipping collapsed nodes. */
export function visibleRows(
  nodes: readonly SidebarNode[],
  collapsed: ReadonlySet<string>,
): SidebarRow[] {
  return nodes.flatMap((node) => {
    if (collapsed.has(node.id)) {
      return [];
    }
    if (node.kind === "no-board") {
      return [...node.tasks.map(asRow), ...node.discussions];
    }
    const epicRows = node.epics.flatMap((epic) => (collapsed.has(epic.id) ? [] : epic.tasks));
    return [...epicRows.map(asRow), ...node.tasks.map(asRow), ...node.discussions];
  });
}

/** nodesOfItem is the ids of the nodes holding a task or a discussion, outermost first; empty when none does. */
export function nodesOfItem(nodes: readonly SidebarNode[], itemId: string): string[] {
  const holds = (rows: readonly TaskRow[]) => rows.some((row) => row.task.id === itemId);
  for (const node of nodes) {
    if (node.kind === "board") {
      const epic = node.epics.find((candidate) => holds(candidate.tasks));
      if (epic !== undefined) {
        return [node.id, epic.id];
      }
    }
    if (holds(node.tasks) || node.discussions.some((row) => row.discussion.id === itemId)) {
      return [node.id];
    }
  }
  return [];
}
