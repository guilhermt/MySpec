import { ExternalLink, LoaderCircle, MessagesSquare, RefreshCw, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNow } from "@/features/attention/useNow";
import { relativeTime } from "@/lib/boards";
import type { Board } from "@/lib/wails";
import { openExternal, refreshBoard } from "@/store/actions";

/** READING_CLOCK_MS is how often the time since the last reading is told again: a minute. */
const READING_CLOCK_MS = 60_000;

export interface BoardHeaderProps {
  board: Board;
  /** onNewDiscussion opens a discussion of the board with no card picked. */
  onNewDiscussion: () => void;
}

/** BoardHeader names the board on screen and tells how its last reading went. */
export function BoardHeader({ board, onNewDiscussion }: BoardHeaderProps) {
  const now = useNow(READING_CLOCK_MS, board.readAt !== "");

  return (
    <header className="flex flex-col gap-1 border-b px-4 py-3">
      <div className="flex min-w-0 items-center gap-2">
        <h1 className="min-w-0 truncate font-medium">{board.title}</h1>
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label="Open on GitHub"
          onClick={() => void openExternal(board.url)}
        >
          <ExternalLink aria-hidden="true" />
        </Button>
        <span className="flex-1" />
        {board.readAt !== "" && (
          <span className="text-xs text-muted-foreground">
            {`Updated ${relativeTime(board.readAt, now)}`}
          </span>
        )}
        {board.reading && (
          <LoaderCircle
            role="status"
            aria-label="Reading the board"
            className="size-3.5 animate-spin text-muted-foreground"
          />
        )}
        <Button
          variant="outline"
          size="sm"
          disabled={board.readAt === ""}
          onClick={onNewDiscussion}
        >
          <MessagesSquare aria-hidden="true" />
          New discussion
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Refresh"
          disabled={board.reading}
          onClick={() => void refreshBoard(board.id)}
        >
          <RefreshCw aria-hidden="true" />
        </Button>
      </div>
      {/* A board never read shows its failure in place of the cards. */}
      {board.failure !== null && board.readAt !== "" && (
        <p role="alert" className="flex items-start gap-1.5 text-xs text-destructive">
          <TriangleAlert aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
          <span className="break-all">{board.failure.message}</span>
        </p>
      )}
    </header>
  );
}
