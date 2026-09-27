import { useEffect } from "react";
import { AuxPanel, PanelLayout } from "@/components/system/AuxPanel";
import { Composer } from "@/features/chat/Composer";
import { Conversation } from "@/features/chat/Conversation";
import { FindingsPanel } from "@/features/reviews/FindingsPanel";
import { ReportsPanel } from "@/features/reviews/ReportsPanel";
import { ReviewBar } from "@/features/reviews/ReviewBar";
import { ReviewHeader } from "@/features/reviews/ReviewHeader";
import { showsChanges } from "@/features/reviews/review-status";
import { ReviewStrip } from "@/features/task/ReviewStrip";
import { REVIEW_STAGE, sessionKey } from "@/lib/wails";
import { loadTranscript } from "@/store/actions";
import { useAppStore, usePanel, useReview } from "@/store/app-store";

export interface ReviewViewProps {
  reviewId: string;
}

/** ReviewView is the screen of one review: the findings, the conversation and the reports. */
export function ReviewView({ reviewId }: ReviewViewProps) {
  const review = useReview(reviewId);
  const panel = usePanel();
  const openPanel = useAppStore((state) => state.openPanel);

  // The conversation is fetched once and then kept: leaving the review and
  // coming back costs nothing, and the events keep being applied while it is
  // away.
  useEffect(() => {
    const key = sessionKey(reviewId, REVIEW_STAGE);
    if (useAppStore.getState().transcripts[key] === undefined) {
      void loadTranscript(reviewId, REVIEW_STAGE);
    }
  }, [reviewId]);

  if (review === null) {
    return <section className="min-h-0 flex-1 bg-background" />;
  }

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col bg-background">
      <ReviewHeader review={review} />
      <ReviewBar review={review} />
      <PanelLayout
        panel={
          panel === "reports" && (
            <AuxPanel id="reports" title="Reports" onClose={() => openPanel(null)}>
              <ReportsPanel review={review} />
            </AuxPanel>
          )
        }
      >
        {showsChanges(review) && review.review !== null && (
          <ReviewStrip taskId={review.id} subject="pr" review={review.review} />
        )}
        <FindingsPanel review={review} />
        <Conversation taskId={review.id} stage={REVIEW_STAGE} session={review} />
        <Composer taskId={review.id} stage={REVIEW_STAGE} session={review} />
      </PanelLayout>
    </section>
  );
}
