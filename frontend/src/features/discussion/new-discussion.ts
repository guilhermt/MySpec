import type { SelectOption } from "@/components/system/Select";
import { findBoard } from "@/lib/boards";
import { findRepository, shortName } from "@/lib/repositories";
import type { Board, BoardCard, Repository, State } from "@/lib/wails";
import { age } from "@/lib/when";

/** TITLE_MAX is how long the title of a discussion can be. */
export const TITLE_MAX = 120;

/** TitleProblem is what keeps a title from being used; null means it is fine. */
export type TitleProblem = "empty" | "too_long";

/**
 * NOTHING_TO_DISCUSS says what a discussion without text and without cards is
 * missing.
 */
export const NOTHING_TO_DISCUSS = "Write what to discuss or select at least one card.";

/** READS_CLONES says why a discussion wants the repositories of the board cloned. */
export const READS_CLONES = "The conversation reads the code of the cloned repositories.";

/**
 * suggestedTitle is the title the dialog opens with: the title of the one card
 * picked, and nothing when several were.
 */
export function suggestedTitle(cards: readonly BoardCard[]): string {
  return cards.length === 1 ? (cards[0]?.title ?? "") : "";
}

/** titleProblem tells what keeps a title from being used, null when nothing does. */
export function titleProblem(title: string): TitleProblem | null {
  const trimmed = title.trim();
  if (trimmed === "") {
    return "empty";
  }
  return trimmed.length > TITLE_MAX ? "too_long" : null;
}

/**
 * canStart tells whether the dialog has what a discussion needs: a title, and
 * something to discuss, which is text, cards, or both.
 */
export function canStart(title: string, text: string, cards: readonly BoardCard[]): boolean {
  return titleProblem(title) === null && (text.trim() !== "" || cards.length > 0);
}

/**
 * unclonedRepositories are the repositories of the board the conversation
 * cannot read: those without a clone, and those whose clone is gone. They come
 * in the order the board has them.
 */
export function unclonedRepositories(
  board: Board,
  repositories: readonly Repository[],
): Repository[] {
  return (board.repositoryIds ?? [])
    .map((id) => repositories.find((repository) => repository.id === id))
    .filter((repository): repository is Repository => repository !== undefined)
    .filter((repository) => !repository.cloned || repository.missing);
}

/** BOARD_FIELD_HELP is what sits under the Board field of the dialog. */
export const BOARD_FIELD_HELP =
  "The discussion reads the clones of the board's repositories and publishes its cards there.";

/** BoardOption is an option of the Board field: a board never read is disabled, its reason in sub. */
export type BoardOption = SelectOption & { disabled?: boolean };

/** lastUsedBoard is the board of the discussion created last, active or archived; null when none still exists. */
export function lastUsedBoard(app: State): string | null {
  const discussions = [...(app.discussions ?? []), ...(app.discussionHistory ?? [])];
  let last: { boardId: string; createdAt: number } | null = null;
  for (const discussion of discussions) {
    const createdAt = Date.parse(discussion.createdAt) || 0;
    if (last === null || createdAt > last.createdAt) {
      last = { boardId: discussion.boardId, createdAt };
    }
  }
  return last !== null && findBoard(app, last.boardId) !== null ? last.boardId : null;
}

/** defaultDiscussionBoard is the board the Board field starts on: the last used when read, else the first read board. */
export function defaultDiscussionBoard(app: State): string | null {
  const last = lastUsedBoard(app);
  if (last !== null && findBoard(app, last)?.readAt !== "") {
    return last;
  }
  return (app.boards ?? []).find((board) => board.readAt !== "")?.id ?? null;
}

// repositoryNames are the short names of the repositories of a board, alphabetically.
function repositoryNames(app: State, board: Board): string {
  return (board.repositoryIds ?? [])
    .map((id) => shortName(findRepository(app, id)?.fullName ?? id))
    .sort((a, b) => a.localeCompare(b))
    .join(", ");
}

/** boardOptions are the options of the Board field, in the order of app.boards. */
export function boardOptions(app: State, now: number): BoardOption[] {
  const last = lastUsedBoard(app);
  return (app.boards ?? []).map((board) => {
    if (board.readAt === "") {
      return { value: board.id, label: board.title, sub: "not read yet", disabled: true };
    }
    const reading =
      board.failure === null
        ? `read ${age(board.readAt, now)}`
        : `◇ read failed ${age(board.failure.failedAt, now)} · uses the last reading`;
    const parts = [repositoryNames(app, board), reading];
    if (board.id === last) {
      parts.push("last used");
    }
    return { value: board.id, label: board.title, sub: parts.join(" · ") };
  });
}
