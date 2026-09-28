import { LoaderCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNow } from "@/features/attention/useNow";
import { LocationHeader } from "@/features/navigation/LocationHeader";
import type { ReviewCenter } from "@/lib/wails";
import { age } from "@/lib/when";
import { refreshPullRequests } from "@/store/actions";

/** READING_CLOCK_MS is how often the time since the last reading is told again: a minute. */
const READING_CLOCK_MS = 60_000;

export interface ReviewsHeaderProps {
  center: ReviewCenter;
}

/** ReviewsHeader is the header of the place of Reviews, with how its last reading went on the right. */
export function ReviewsHeader({ center }: ReviewsHeaderProps) {
  const now = useNow(READING_CLOCK_MS, center.readAt !== "");

  return (
    <LocationHeader>
      {center.readAt !== "" && (
        <span className="text-xs text-muted-foreground">
          {`Updated ${age(center.readAt, now)}`}
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
    </LocationHeader>
  );
}
