import { LoaderCircle, MessagesSquare, RefreshCw, TriangleAlert } from "lucide-react";
import { IconButton } from "@/components/system/IconButton";
import { ICONS } from "@/components/system/icons";
import { Button } from "@/components/ui/button";
import { useNow } from "@/features/attention/useNow";
import { LocationHeader } from "@/features/navigation/LocationHeader";
import type { Board } from "@/lib/wails";
import { age } from "@/lib/when";
import { openExternal, refreshBoard } from "@/store/actions";

/** READING_CLOCK_MS is how often the time since the last reading is told again: a minute. */
const READING_CLOCK_MS = 60_000;

export interface BoardHeaderProps {
  board: Board;
  /** onNewDiscussion opens a discussion of the board with the cards picked, if any. */
  onNewDiscussion: () => void;
}

/**
 * BoardHeader is the header of the place of a board, with how its last reading went and what the
 * user can do to it on the right. A failed reading shows as a line under it.
 */
export function BoardHeader({ board, onNewDiscussion }: BoardHeaderProps) {
  const now = useNow(READING_CLOCK_MS, board.readAt !== "");

  return (
    <>
      <LocationHeader>
        {board.readAt !== "" && (
          <span className="text-xs text-muted-foreground">
            {`checked ${age(board.readAt, now)}`}
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
        <IconButton
          label="Open on GitHub"
          icon={ICONS.external}
          size="sm"
          onClick={() => void openExternal(board.url)}
        />
      </LocationHeader>
      {/* A board never read shows its failure in place of the cards. */}
      {board.failure !== null && board.readAt !== "" && (
        <p
          role="alert"
          className="flex items-start gap-1.5 border-b px-4 py-2 text-xs text-destructive"
        >
          <TriangleAlert aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
          <span className="break-all">{board.failure.message}</span>
        </p>
      )}
    </>
  );
}
