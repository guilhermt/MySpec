import { Composer } from "@/features/chat/Composer";
import { useConversationCards } from "@/features/chat/useConversationCards";
import { reviewComposerContext } from "@/features/reviews/review-request";
import { useReviewRequest } from "@/features/reviews/useReviewRequest";
import { REVIEW_STAGE, type ReviewSummary } from "@/lib/wails";

export interface ReviewComposerProps {
  review: ReviewSummary;
}

/**
 * ReviewComposer is the composer of the review screen, told what the review asks: revising the
 * findings of a pass, asking the agent for a change. The primary is the bar's, or a pending card's.
 */
export function ReviewComposer({ review }: ReviewComposerProps) {
  const cards = useConversationCards(review.id, REVIEW_STAGE);
  const request = useReviewRequest(review);
  const barPrimary = request?.actions.some((button) => button.variant === "primary") ?? false;
  return (
    <Composer
      taskId={review.id}
      stage={REVIEW_STAGE}
      session={review}
      question={cards.question}
      permissionPending={cards.permission}
      otherPrimary={barPrimary || cards.question !== null || cards.permission !== null}
      context={{ ...reviewComposerContext(review), drafts: null }}
    />
  );
}
