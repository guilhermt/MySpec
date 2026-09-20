import type { Board, BoardCard, Repository } from "@/lib/wails";

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
