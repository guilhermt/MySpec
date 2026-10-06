import type { SelectOption } from "@/components/system/Select";
import { findBoard } from "@/lib/boards";
import { findRepository, shortName } from "@/lib/repositories";
import { counted, listed } from "@/lib/situations";
import type { Board, BoardCard, Repository, State } from "@/lib/wails";
import { age } from "@/lib/when";

/** TITLE_MAX is how long the title of a discussion can be. */
export const TITLE_MAX = 120;

/**
 * NOTHING_TO_DISCUSS says what a discussion without text and without cards is
 * missing.
 */
export const NOTHING_TO_DISCUSS = "Write what to discuss or select at least one card.";

/** READS_CLONES says why a discussion wants the repositories of the board cloned. */
export const READS_CLONES = "The conversation reads the code of the cloned repositories only.";

/**
 * suggestedTitle is the title the dialog opens with: the title of the one card
 * picked, and nothing when several were.
 */
export function suggestedTitle(cards: readonly BoardCard[]): string {
  return cards.length === 1 ? (cards[0]?.title ?? "") : "";
}

/** codePoints counts a text as the Go side does: by code point. */
export function codePoints(text: string): number {
  return [...text].length;
}

/** TITLE_HELP_FROM is the length from which the title says how much room is left. */
const TITLE_HELP_FROM = 100;

/** titleHelp is "104 of 120" from 100 code points on, "" before. */
export function titleHelp(title: string): string {
  const length = codePoints(title.trim());
  return length >= TITLE_HELP_FROM ? `${length} of ${TITLE_MAX}` : "";
}

/** titleError is "Use at most 120 characters." above 120, null otherwise. */
export function titleError(title: string): string | null {
  return codePoints(title.trim()) > TITLE_MAX ? `Use at most ${TITLE_MAX} characters.` : null;
}

/** startReason is the reason of the footer, in the order of the material; null when it starts. */
export function startReason(input: {
  board: string | null;
  title: string;
  text: string;
  cards: number;
}): string | null {
  if (input.text.trim() === "" && input.cards === 0) {
    return NOTHING_TO_DISCUSS;
  }
  if (input.title.trim() === "") {
    return "Name the discussion to start it.";
  }
  const problem = titleError(input.title);
  if (problem !== null) {
    return problem;
  }
  return input.board === null ? "Choose a board." : null;
}

/** contextCharacters is "5,690 characters": the code points of the context, with the English thousands separator. */
export function contextCharacters(context: string): string {
  const length = codePoints(context);
  return `${length.toLocaleString("en-US")} character${length === 1 ? "" : "s"}`;
}

// distinct keeps the first of each key, leaving out the keys of the cards picked.
function distinct<T extends { key: string }>(all: readonly T[], picked: ReadonlySet<string>): T[] {
  const seen = new Set(picked);
  return all.filter((one) => {
    if (seen.has(one.key)) {
      return false;
    }
    seen.add(one.key);
    return true;
  });
}

/**
 * contextLine is the line of the context (material §4.2, O diálogo, 5): "From the cards: #455, #461,
 * the epic …, 4 cards of the epic and 1 dependency · 5,690 characters". Without the context read
 * yet, the line has no count.
 */
export function contextLine(cards: readonly BoardCard[], context: string | null): string {
  const count = context === null ? "" : ` · ${contextCharacters(context)}`;
  if (cards.length === 0) {
    return `From the board and your text${count}`;
  }
  const picked = new Set(cards.map((card) => card.key));
  const epics = distinct(
    cards.flatMap((card) => (card.epic === null ? [] : [card.epic])),
    new Set(),
  );
  const siblings = distinct(
    cards.flatMap((card) => card.siblings ?? []),
    picked,
  );
  const dependencies = distinct(
    cards.flatMap((card) => card.dependencies ?? []),
    picked,
  );
  const parts = cards.map((card) => `#${card.number}`);
  const [epic] = epics;
  if (epic !== undefined) {
    parts.push(epics.length === 1 ? `the epic ${epic.title}` : `${epics.length} epics`);
  }
  if (siblings.length > 0) {
    parts.push(`${counted(siblings.length, "card")} of the epic${epics.length > 1 ? "s" : ""}`);
  }
  if (dependencies.length > 0) {
    parts.push(dependencies.length === 1 ? "1 dependency" : `${dependencies.length} dependencies`);
  }
  return `From the ${cards.length === 1 ? "card" : "cards"}: ${listed(parts)}${count}`;
}

/** boardLine is "acme · project 7 · api, billing, docs, gateway, web": the owner, the project, the short names of the repositories alphabetically. */
export function boardLine(board: Board, repositories: readonly Repository[]): string {
  const names = (board.repositoryIds ?? [])
    .map((id) => repositories.find((repository) => repository.id === id))
    .filter((repository): repository is Repository => repository !== undefined)
    .map((repository) => shortName(repository.fullName))
    .sort((a, b) => a.localeCompare(b));
  return [board.owner, `project ${board.number}`, names.join(", ")]
    .filter((part) => part !== "")
    .join(" · ");
}

/** whatHint is the complement of What to discuss: "optional with cards" or "or pick cards on the board". */
export function whatHint(cards: number): string {
  return cards > 0 ? "optional with cards" : "or pick cards on the board";
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
export function boardOptions(app: State, now: number): SelectOption[] {
  const last = lastUsedBoard(app);
  return (app.boards ?? []).map((board) => {
    if (board.readAt === "") {
      return { value: board.id, label: board.title, sub: "not read yet", disabled: true };
    }
    const reading =
      board.failure === null
        ? `read ${age(board.readAt, now)}`
        : `read failed ${age(board.failure.failedAt, now)} · uses the last reading`;
    const parts = [repositoryNames(app, board), reading];
    if (board.id === last) {
      parts.push("last used");
    }
    return {
      value: board.id,
      label: board.title,
      sub: parts.join(" · "),
      ...(board.failure === null ? {} : { blocked: true }),
    };
  });
}
