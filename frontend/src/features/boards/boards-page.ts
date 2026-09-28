import type { Board, BoardRemoval } from "@/lib/wails";
import { age } from "@/lib/when";

/** ownerText names who owns a board: "dev · Organization". */
export function ownerText(board: Board): string {
  return `${board.owner} · ${board.ownerType === "user" ? "User" : "Organization"}`;
}

/** readingText is the last reading of a board: its failure, when it failed, or how long ago it succeeded. */
export function readingText(board: Board, now: number): string {
  if (board.failure !== null) {
    return board.failure.message;
  }
  if (board.readAt === "") {
    return "Not read yet";
  }
  return `checked ${age(board.readAt, now)}`;
}

/**
 * statusesText is what the statuses of a board do: which ones end the work on a
 * card, and which one a card created by a discussion gets. A board without a
 * Status field has none of it.
 */
export function statusesText(board: Board): string {
  const statuses = board.statuses ?? [];
  if (statuses.length === 0) {
    return "";
  }
  const finals = statuses.filter((status) => status.final).map((status) => status.name);
  const newCard = statuses.find((status) => status.id === board.newCardStatus);
  return `Final: ${finals.length === 0 ? "none" : finals.join(", ")} · New cards: ${newCard?.name ?? "none"}`;
}

/** removalText says what removing a board does to its repositories and to the rest. */
export function removalText(removal: BoardRemoval): string {
  const moving =
    removal.toNoBoard === 1
      ? "1 repository moves to No board"
      : `${removal.toNoBoard} repositories move to No board`;
  const leaving = removal.removed === 1 ? "1 leaves MySpec" : `${removal.removed} leave MySpec`;
  return `${moving} and ${leaving}. Tasks keep their cards, and nothing changes on GitHub or on disk.`;
}
