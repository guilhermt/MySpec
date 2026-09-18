import { LoaderCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNow } from "@/features/attention/useNow";
import { relativeTime } from "@/lib/boards";
import type { ReviewCenter } from "@/lib/wails";
import { refreshPullRequests } from "@/store/actions";

/** READING_CLOCK_MS is how often the time since the last reading is told again: a minute. */
const READING_CLOCK_MS = 60_000;

export interface ReviewsHeaderProps {
  center: ReviewCenter;
}

/** ReviewsHeader names the Reviews view and tells how its last reading went. */
export function ReviewsHeader({ center }: ReviewsHeaderProps) {
  const now = useNow(READING_CLOCK_MS, center.readAt !== "");

  return (
    <header className="flex min-w-0 items-center gap-2 border-b px-4 py-3">
      <h1 className="min-w-0 truncate font-medium">Reviews</h1>
      <span className="flex-1" />
      {center.readAt !== "" && (
        <span className="text-xs text-muted-foreground">
          {`Updated ${relativeTime(center.readAt, now)}`}
        </span>
      )}
      {center.reading && (
        <LoaderCircle
          role="status"
          aria-label="Reading pull requests"
          className="size-3.5 animate-spin text-muted-foreground"
        />
      )}
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Refresh"
        disabled={center.reading}
        onClick={() => void refreshPullRequests()}
      >
        <RefreshCw aria-hidden="true" />
      </Button>
    </header>
  );
}
