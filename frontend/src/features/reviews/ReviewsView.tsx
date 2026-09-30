import { useEffect, useState } from "react";
import { ScrollArea } from "@/components/system/ScrollArea";
import { useNow } from "@/features/attention/useNow";
import { LIST_COLUMN } from "@/features/board/BoardView";
import { PullRequestRow } from "@/features/reviews/PullRequestRow";
import { ReviewsFilterBar } from "@/features/reviews/ReviewsFilterBar";
import { ReviewsHeader } from "@/features/reviews/ReviewsHeader";
import {
  NoMatch,
  NoPullRequests,
  NoRepositories,
  ReadingSkeleton,
  ReviewsFailureStrips,
} from "@/features/reviews/ReviewsReadingStates";
import { EMPTY_REVIEW_FILTERS, reviewsReadingView } from "@/features/reviews/review-list";
import { visibleRows } from "@/features/reviews/reviews-view";
import { refreshPullRequests, setReviewFilters } from "@/store/actions";
import { useAppStore, useReviewCenter } from "@/store/app-store";

/** READING_CLOCK_MS is how often the time since the last reading is told again: a minute. */
const READING_CLOCK_MS = 60_000;

/** ReviewsView is the open pull requests of every registered repository, as the filters show them. */
export function ReviewsView() {
  const app = useAppStore((state) => state.app);
  const center = useReviewCenter();
  const [pendingOnly, setPendingOnly] = useState(false);
  const now = useNow(READING_CLOCK_MS, center.readAt !== "" || (center.failures ?? []).length > 0);

  // Opening the view reads the pull requests again; the stored reading shows
  // meanwhile.
  useEffect(() => {
    void refreshPullRequests();
  }, []);

  const rows = visibleRows(center, pendingOnly);
  const view = app === null ? "skeleton" : reviewsReadingView(app);
  const clear = () => {
    setPendingOnly(false);
    void setReviewFilters(EMPTY_REVIEW_FILTERS);
  };

  let content: React.ReactNode;
  if (view === "skeleton") {
    content = <ReadingSkeleton />;
  } else if (app !== null && view === "no-repositories") {
    content = <NoRepositories />;
  } else if (app !== null && view === "no-pull-requests") {
    content = <NoPullRequests app={app} />;
  } else if (view === "no-match" || rows.length === 0) {
    content = <NoMatch center={center} onClear={clear} />;
  } else {
    content = (
      <ul className="flex flex-col gap-1">
        {rows.map((row) => (
          <PullRequestRow key={row.key} row={row} />
        ))}
      </ul>
    );
  }

  const showsBar = view === "list" || view === "no-match";

  return (
    <section aria-label="Reviews" className="flex min-h-0 min-w-0 flex-1 flex-col bg-surface-1">
      <ReviewsHeader center={center} now={now} />
      <ScrollArea className="list-area min-h-0 flex-1">
        <div className={LIST_COLUMN}>
          <ReviewsFailureStrips center={center} now={now} />
          {showsBar && (
            <ReviewsFilterBar
              center={center}
              pendingOnly={pendingOnly}
              onPendingOnlyChange={setPendingOnly}
            />
          )}
          {content}
        </div>
      </ScrollArea>
    </section>
  );
}
