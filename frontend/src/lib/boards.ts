import { findRepository } from "@/lib/repositories";
import type { Board, IssueState, PullRequestState, Repository, State } from "@/lib/wails";

/**
 * STALE_CARD_MS is how old the reading of a card can be before the creation
 * dialog refreshes it: five minutes.
 */
export const STALE_CARD_MS = 5 * 60_000;

const NO_BOARDS: readonly Board[] = [];

function boardsOf(app: State | null): readonly Board[] {
  return app?.boards ?? NO_BOARDS;
}

/** findBoard is the registered board of an id, null when none is. */
export function findBoard(app: State | null, id: string): Board | null {
  return boardsOf(app).find((board) => board.id === id) ?? null;
}

/** boardOfRepository is the board that manages a repository, null when none does. */
export function boardOfRepository(app: State | null, repositoryId: string): Board | null {
  const boardId = findRepository(app, repositoryId)?.boardId ?? "";
  return boardId === "" ? null : findBoard(app, boardId);
}

/**
 * repositoryByFullName is the registered repository of an owner/name, ignoring
 * case as GitHub does; null when none is.
 */
export function repositoryByFullName(app: State | null, fullName: string): Repository | null {
  const wanted = fullName.toLowerCase();
  return (
    (app?.repositories ?? []).find((repository) => repository.fullName.toLowerCase() === wanted) ??
    null
  );
}

/** issueLabel is how an issue is named next to its title: "#12". */
export function issueLabel(issue: { number: number }): string {
  return `#${issue.number}`;
}

/** prStateLabel names what became of a pull request. */
export function prStateLabel(state: PullRequestState): string {
  switch (state) {
    case "open":
      return "Open";
    case "merged":
      return "Merged";
    case "closed":
      return "Closed";
  }
}

/** stateLabel names whether an issue is open or closed. */
export function stateLabel(state: IssueState): string {
  switch (state) {
    case "open":
      return "Open";
    case "closed":
      return "Closed";
  }
}
