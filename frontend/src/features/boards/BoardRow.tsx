import { TriangleAlert } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useNow } from "@/features/attention/useNow";
import { BoardDialog } from "@/features/boards/BoardDialog";
import { pluralize } from "@/features/boards/board-dialog";
import { ownerText, readingText } from "@/features/boards/boards-page";
import { RemoveBoardDialog } from "@/features/boards/RemoveBoardDialog";
import { ExternalLink } from "@/features/chat/ExternalLink";
import type { Board } from "@/lib/wails";

/** READING_CLOCK_MS is how often the time since the last reading is told again: a minute. */
const READING_CLOCK_MS = 60_000;

export interface BoardRowProps {
  board: Board;
}

/** BoardRow is one registered board: who owns it, what it manages, how its last reading went, and what can be done to it. */
export function BoardRow({ board }: BoardRowProps) {
  const [editing, setEditing] = useState(false);
  const [removing, setRemoving] = useState(false);
  const now = useNow(READING_CLOCK_MS, board.failure === null && board.readAt !== "");

  return (
    <li className="flex flex-col gap-1 px-4 py-3">
      <div className="flex items-center gap-2">
        <span className="min-w-0 truncate font-medium">{board.title}</span>
        <span className="flex-1" />
        <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
          Edit
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setRemoving(true)}>
          Remove
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        {`${ownerText(board)} · ${pluralize((board.repositoryIds ?? []).length, "repository", "repositories")}`}
      </p>
      <ExternalLink
        href={board.url}
        className="w-fit break-all text-xs text-muted-foreground underline-offset-4 hover:underline"
      >
        {board.url}
      </ExternalLink>
      {board.failure === null ? (
        <p className="text-xs text-muted-foreground">{readingText(board, now)}</p>
      ) : (
        <p className="flex items-start gap-1.5 text-xs text-destructive">
          <TriangleAlert aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
          <span className="break-all">{readingText(board, now)}</span>
        </p>
      )}
      <BoardDialog mode="edit" boardId={board.id} open={editing} onOpenChange={setEditing} />
      <RemoveBoardDialog board={board} open={removing} onOpenChange={setRemoving} />
    </li>
  );
}
