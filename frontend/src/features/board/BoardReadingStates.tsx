import { Button } from "@/components/system/Button";
import { EmptyState } from "@/components/system/EmptyState";
import { LiveRegion } from "@/components/system/LiveRegion";
import { NoticeStrip } from "@/components/system/NoticeStrip";
import { Skeleton, SkeletonBar } from "@/components/system/Skeleton";
import { Spinner } from "@/components/system/Spinner";
import { useArrivedLater } from "@/components/system/useArrivedLater";
import { type BoardFilters, noMatchSentence, showsFailureStrip } from "@/features/board/board-view";
import type { Board } from "@/lib/wails";
import { age } from "@/lib/when";
import { refreshBoard } from "@/store/actions";

/** SKELETON_BARS is how many bars stand for the cards of a board never read. */
const SKELETON_BARS = 4;

/** TryAgain reads the board again, or says that it is being read. */
function TryAgain({ board }: { board: Board }) {
  return (
    <>
      <LiveRegion
        kind="status"
        className="inline-flex items-center gap-(--space-1-5) text-(length:--text-meta) leading-(--leading-meta) text-ink-3"
      >
        {board.reading && (
          <span className="inline-flex items-center gap-(--space-1-5) px-(--space-2)">
            <Spinner />
            Reading…
          </span>
        )}
      </LiveRegion>
      {!board.reading && (
        <Button variant="secondary" size="sm" onClick={() => void refreshBoard(board.id)}>
          Try again
        </Button>
      )}
    </>
  );
}

export interface FailureStripProps {
  board: Board;
  now: number;
}

/** FailureStrip says the last reading failed, above the cards of the reading before it. */
export function FailureStrip({ board, now }: FailureStripProps) {
  const shows = showsFailureStrip(board);
  const role = useArrivedLater(shows) ? "alert" : undefined;
  if (!shows || board.failure === null) {
    return null;
  }
  return (
    <NoticeStrip
      title={`Couldn't read the board · ${age(board.failure.failedAt, now)}`}
      reason={board.failure.message}
      role={role}
      action={<TryAgain board={board} />}
      className="mt-(--space-4) mb-(--space-4)"
    />
  );
}

/** ReadingSkeleton stands in for the cards of a board never read, while it is read. */
export function ReadingSkeleton() {
  return (
    <Skeleton label="Reading the board…">
      {Array.from({ length: SKELETON_BARS }, (_, bar) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: the bars never move
        <SkeletonBar key={bar} className="h-(--size-control) w-full" />
      ))}
    </Skeleton>
  );
}

/** NeverReadFailed is what a board never read shows once its reading failed. */
export function NeverReadFailed({ board }: { board: Board }) {
  return (
    <EmptyState title="Couldn't read the board" action={<TryAgain board={board} />}>
      {board.failure?.message}
    </EmptyState>
  );
}

/** NoCards is a board that was read and has no issues. */
export function NoCards({ onNewDiscussion }: { onNewDiscussion: () => void }) {
  return (
    <EmptyState
      title="This board has no issues."
      action={
        <Button variant="secondary" size="sm" onClick={onNewDiscussion}>
          New discussion
        </Button>
      }
    >
      Cards appear after a reading finds open issues, or issues closed in the last 14 days. A
      discussion publishes new cards here.
    </EmptyState>
  );
}

export interface NoMatchProps {
  board: Board;
  filters: BoardFilters;
  onClear: () => void;
}

/** NoMatch says what the filters ask when no card passes them. */
export function NoMatch({ board, filters, onClear }: NoMatchProps) {
  return (
    <EmptyState
      title="No cards match the filters."
      action={
        <Button variant="secondary" size="sm" onClick={onClear}>
          Clear filters
        </Button>
      }
    >
      {noMatchSentence(filters, board.viewer)}
    </EmptyState>
  );
}
