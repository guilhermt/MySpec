import { defaultDiscussionBoard } from "@/features/discussion/new-discussion";
import { boardOfRepository, findBoard } from "@/lib/boards";
import type { Location } from "@/lib/locations";
import type { State } from "@/lib/wails";

/**
 * discussionBoard is the board New discussion opens the dialog for: the board
 * on screen, or the board of the item on screen (a task by its repository, a
 * discussion by its own); else the board of the last discussion; else the
 * first board by title. null without a board.
 */
export function discussionBoard(app: State | null, location: Location): string | null {
  if (app === null) {
    return null;
  }
  const here = placeBoard(app, location);
  if (here !== null) {
    return here;
  }
  const last = app.discussions?.at(-1);
  if (last !== undefined && findBoard(app, last.boardId) !== null) {
    return last.boardId;
  }
  return app.boards?.[0]?.id ?? null;
}

/** DiscussionTarget is what New discussion does from a place: open the dialog, asking the board or not, or say why it can't. */
export type DiscussionTarget =
  | { kind: "open"; boardId: string; askBoard: boolean }
  | { kind: "disabled"; reason: string };

const NO_BOARD: DiscussionTarget = {
  kind: "disabled",
  reason: "Add a board to discuss its cards.",
};

const NOT_READ: DiscussionTarget = {
  kind: "disabled",
  reason: "The board hasn't been read yet.",
};

/**
 * discussionTarget is what New discussion does from a place: nothing without a
 * board, and nothing while no board was read; the board of the place when it
 * has one, and the only board when there is one; else it asks, starting from
 * the board last used.
 */
export function discussionTarget(app: State | null, location: Location): DiscussionTarget {
  const boards = app?.boards ?? [];
  const [only] = boards;
  if (app === null || only === undefined) {
    return NO_BOARD;
  }
  if (!boards.some((board) => board.readAt !== "")) {
    return NOT_READ;
  }
  const here = placeBoard(app, location);
  if (here !== null) {
    return { kind: "open", boardId: here, askBoard: false };
  }
  if (boards.length === 1) {
    return { kind: "open", boardId: only.id, askBoard: false };
  }
  const boardId = defaultDiscussionBoard(app);
  return boardId === null ? NOT_READ : { kind: "open", boardId, askBoard: true };
}

/** placeBoard is the board of the place on screen, null when it has none. */
function placeBoard(app: State, location: Location): string | null {
  switch (location.kind) {
    case "board":
      return findBoard(app, location.id)?.id ?? null;
    case "task": {
      const task = app.tasks?.find((candidate) => candidate.id === location.id);
      return task === undefined ? null : (boardOfRepository(app, task.repositoryId)?.id ?? null);
    }
    case "discussion": {
      const discussion = app.discussions?.find((candidate) => candidate.id === location.id);
      return discussion === undefined ? null : (findBoard(app, discussion.boardId)?.id ?? null);
    }
    default:
      return null;
  }
}
