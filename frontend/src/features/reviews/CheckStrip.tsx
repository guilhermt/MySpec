import { useState } from "react";
import { Button } from "@/components/system/Button";
import { LiveRegion } from "@/components/system/LiveRegion";
import { NoticeStrip } from "@/components/system/NoticeStrip";
import { Spinner } from "@/components/system/Spinner";
import { useArrivedLater } from "@/components/system/useArrivedLater";
import { useNow } from "@/features/attention/useNow";
import { COLUMN_CLASS } from "@/features/chat/ConversationColumn";
import { checkStrip } from "@/features/reviews/review-header";
import type { ReviewSummary } from "@/lib/wails";
import { refreshReviewPR } from "@/store/actions";

// MINUTE is how often the age of the failure is told again.
const MINUTE = 60_000;

export interface CheckStripProps {
  review: ReviewSummary;
}

/**
 * CheckStrip says the reading of the pull request of a review failed, under the header and in the
 * column of the conversation. It is a notice, never a situation: nothing waits for the user, and
 * Try again reads the pull request once more. It says nothing while the bar of a blocked pass tells
 * the same failure.
 */
export function CheckStrip({ review }: CheckStripProps) {
  const [reading, setReading] = useState(false);
  const now = useNow(MINUTE, review.checkError !== "");
  const strip = checkStrip(review, now);
  const role = useArrivedLater(strip !== null) ? "alert" : undefined;
  if (strip === null) {
    return null;
  }

  const retry = async () => {
    setReading(true);
    try {
      await refreshReviewPR(review.id);
    } finally {
      setReading(false);
    }
  };

  return (
    <div className="shrink-0 px-(--space-6) pt-(--space-1)">
      <div className={COLUMN_CLASS}>
        <NoticeStrip
          title={strip.title}
          reason={strip.reason}
          role={role}
          action={
            <>
              <LiveRegion
                kind="status"
                className="inline-flex items-center gap-(--space-1-5) text-(length:--text-meta) leading-(--leading-meta) text-ink-3"
              >
                {reading && (
                  <span className="inline-flex items-center gap-(--space-1-5) px-(--space-2)">
                    <Spinner />
                    Reading…
                  </span>
                )}
              </LiveRegion>
              {!reading && (
                <Button variant="secondary" size="sm" onClick={() => void retry()}>
                  Try again
                </Button>
              )}
            </>
          }
        />
      </div>
    </div>
  );
}
