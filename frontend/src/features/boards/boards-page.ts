import { relativeTime } from "@/lib/boards";
import type { Board, BoardRemoval } from "@/lib/wails";

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
  return `Updated ${relativeTime(board.readAt, now)}`;
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
