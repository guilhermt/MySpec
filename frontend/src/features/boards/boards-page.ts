import { pluralize } from "@/features/boards/board-dialog";
import type { Board, BoardRemoval, Repository } from "@/lib/wails";
import { age } from "@/lib/when";

/** TRAILER is what a removal never touches: the cards of the tasks, GitHub and the disk. */
const TRAILER = "Tasks keep their cards, and nothing changes on GitHub or on disk.";

/** projectRef is "acme/projects/7". */
export function projectRef(board: Board): string {
  return `${board.owner}/projects/${board.number}`;
}

/** namesOf are the short names, or owner/name in all when one is not of the board's owner. */
export function namesOf(owner: string, fullNames: readonly string[]): string {
  const prefix = `${owner}/`;
  const ofOwner = fullNames.every((name) => name.startsWith(prefix));
  const names = fullNames.map((name) => (ofOwner ? name.slice(prefix.length) : name));
  return names.sort((a, b) => a.localeCompare(b)).join(", ");
}

/** repositoriesLine is "Organization · 6 repositories: api, billing, …", "1 repository: api", "No repositories". */
export function repositoriesLine(board: Board, repositories: readonly Repository[]): string {
  const type = board.ownerType === "user" ? "User" : "Organization";
  const ids = new Set(board.repositoryIds ?? []);
  const names = repositories.filter((repository) => ids.has(repository.id));
  if (names.length === 0) {
    return `${type} · No repositories`;
  }
  const list = namesOf(
    board.owner,
    names.map((repository) => repository.fullName),
  );
  return `${type} · ${pluralize(names.length, "repository", "repositories")}: ${list}`;
}

/** finalsLine is "Final: Done, Won't do, Duplicate · New cards: None", or the line of a board without Status. */
export function finalsLine(board: Board): string {
  const statuses = board.statuses ?? [];
  if (!board.hasStatus || statuses.length === 0) {
    return "No Status field: its cards end when their issues close";
  }
  const finals = statuses.filter((status) => status.final).map((status) => status.name);
  const newCard = statuses.find((status) => status.id === board.newCardStatus);
  return `Final: ${finals.length === 0 ? "None" : finals.join(", ")} · New cards: ${newCard?.name ?? "None"}`;
}

/** boardRowName is "Platform Roadmap, acme, 6 repositories, read 2m ago[, the last reading failed]". */
export function boardRowName(board: Board, count: number, now: number): string {
  const read = board.readAt === "" ? "not read yet" : `read ${age(board.readAt, now)}`;
  const failed = board.failure === null ? "" : ", the last reading failed";
  return `${board.title}, ${board.owner}, ${pluralize(count, "repository", "repositories")}, ${read}${failed}`;
}

/** removalSentence is "5 repositories move to No board and 1 leaves MySpec. Tasks keep their cards, …". */
export function removalSentence(removal: BoardRemoval): string {
  const { toNoBoard, removed } = removal;
  const moving = toNoBoard === 1 ? "1 repository moves" : `${toNoBoard} repositories move`;
  const leaving = removed === 1 ? "1 leaves" : `${removed} leave`;
  if (toNoBoard > 0 && removed > 0) {
    return `${moving} to No board and ${leaving} MySpec. ${TRAILER}`;
  }
  if (toNoBoard > 0) {
    return `${moving} to No board. ${TRAILER}`;
  }
  if (removed > 0) {
    return `${removed === 1 ? "1 repository leaves" : `${removed} repositories leave`} MySpec. ${TRAILER}`;
  }
  return `The board has no repositories. ${TRAILER}`;
}

/** removalLines are "To No board: …" and "Leaves MySpec: …, with no clone, tasks or reviews", each only when it has names. */
export function removalLines(
  board: Board,
  removal: BoardRemoval,
): { label: string; names: string }[] {
  const lines: { label: string; names: string }[] = [];
  const moving = removal.toNoBoardNames ?? [];
  const leaving = removal.removedNames ?? [];
  if (moving.length > 0) {
    lines.push({ label: "To No board:", names: namesOf(board.owner, moving) });
  }
  if (leaving.length > 0) {
    lines.push({
      label: "Leaves MySpec:",
      names: `${namesOf(board.owner, leaving)}, with no clone, tasks or reviews`,
    });
  }
  return lines;
}
