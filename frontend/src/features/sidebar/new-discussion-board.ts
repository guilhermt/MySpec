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
