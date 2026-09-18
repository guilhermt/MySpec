import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PullRequestRow } from "@/features/reviews/PullRequestRow";
import { ReadFailures } from "@/features/reviews/ReadFailures";
import { ReviewsFilterBar } from "@/features/reviews/ReviewsFilterBar";
import { ReviewsHeader } from "@/features/reviews/ReviewsHeader";
import {
  EMPTY_REVIEW_FILTERS,
  emptyText,
  isFiltering,
  visibleRows,
} from "@/features/reviews/reviews-view";
import { refreshPullRequests, setReviewFilters } from "@/store/actions";
import { useAppStore, useReviewCenter } from "@/store/app-store";

/** SKELETON_ROWS is how many placeholder rows stand for pull requests never read. */
const SKELETON_ROWS = 6;

/** ReviewsView is the open pull requests of every registered repository, as the filters show them. */
export function ReviewsView() {
  const app = useAppStore((state) => state.app);
  const center = useReviewCenter();

  // Opening the view reads the pull requests again; the stored reading shows
  // meanwhile.
  useEffect(() => {
    void refreshPullRequests();
  }, []);

  const rows = visibleRows(center);
  const filtering = isFiltering(center.filters);

  let content: React.ReactNode;
  if (center.readAt === "" && center.reading) {
    content = (
      <div className="flex flex-col gap-2 p-4" aria-hidden="true">
        {Array.from({ length: SKELETON_ROWS }, (_, row) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: the placeholder rows never move
          <Skeleton key={row} className="h-11" />
        ))}
      </div>
    );
  } else if (rows.length === 0) {
    content = (
      <div className="flex flex-col items-start gap-2 p-4">
        <p className="text-sm text-muted-foreground">{emptyText(app)}</p>
        {filtering && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => void setReviewFilters(EMPTY_REVIEW_FILTERS)}
          >
            Clear filters
          </Button>
        )}
      </div>
    );
  } else {
    content = (
      <ul className="flex flex-col gap-1 overflow-y-auto p-2">
        {rows.map((row) => (
          <PullRequestRow key={row.key} row={row} />
        ))}
      </ul>
    );
  }

  return (
    <main aria-label="Reviews" className="flex h-dvh min-w-0 flex-col bg-background">
      <ReviewsHeader center={center} />
      <ReadFailures failures={center.failures ?? []} />
      <ReviewsFilterBar center={center} />
      <div className="flex min-h-0 flex-1 flex-col">{content}</div>
    </main>
  );
}
