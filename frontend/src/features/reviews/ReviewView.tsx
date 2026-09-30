import { useEffect, useRef } from "react";
import { PanelLayout } from "@/components/system/AuxPanel";
import { Conversation } from "@/features/chat/Conversation";
import { ConversationComposer } from "@/features/chat/ConversationComposer";
import { CheckStrip } from "@/features/reviews/CheckStrip";
import { FindingsPanel } from "@/features/reviews/FindingsPanel";
import { ReportsPanel } from "@/features/reviews/ReportsPanel";
import { ReviewBar } from "@/features/reviews/ReviewBar";
import { ReviewDetails } from "@/features/reviews/ReviewDetails";
import { ReviewHeader } from "@/features/reviews/ReviewHeader";
import { showsChanges } from "@/features/reviews/review-status";
import { useDecidedLines } from "@/features/reviews/useDecidedLines";
import { ReviewStrip } from "@/features/task/ReviewStrip";
import { useFocusRescue } from "@/features/task/request-focus";
import { REVIEW_STAGE, type ReviewSummary, sessionKey } from "@/lib/wails";
import { loadTranscript } from "@/store/actions";
import { useAppStore, usePanel, useReview } from "@/store/app-store";

export interface ReviewViewProps {
  reviewId: string;
}

// ReviewConversation is the conversation of a review, with the decisions of the passes it never recorded.
function ReviewConversation({ review }: { review: ReviewSummary }) {
  const decided = useDecidedLines(review);
  return <Conversation taskId={review.id} stage={REVIEW_STAGE} session={review} after={decided} />;
}

/** ReviewView is the screen of one review: the findings, the conversation and the panels. */
export function ReviewView({ reviewId }: ReviewViewProps) {
  const review = useReview(reviewId);
  const panel = usePanel();
  const rescue = useRef<HTMLElement>(null);
  useFocusRescue(rescue);

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
    return <section ref={rescue} className="min-h-0 flex-1 bg-background" />;
  }

  return (
    <section ref={rescue} className="flex min-h-0 min-w-0 flex-1 flex-col bg-background">
      <ReviewHeader review={review} />
      <ReviewBar review={review} />
      <PanelLayout
        panel={
          panel === "details" ? (
            <ReviewDetails key="details" review={review} />
          ) : panel === "reports" ? (
            <ReportsPanel key="reports" review={review} />
          ) : null
        }
      >
        <CheckStrip review={review} />
        {showsChanges(review) && review.review !== null && (
          <ReviewStrip taskId={review.id} subject="pr" review={review.review} />
        )}
        <FindingsPanel review={review} />
        <ReviewConversation review={review} />
        <ConversationComposer taskId={review.id} stage={REVIEW_STAGE} session={review} />
      </PanelLayout>
    </section>
  );
}
