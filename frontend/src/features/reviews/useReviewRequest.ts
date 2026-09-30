import { useNow } from "@/features/attention/useNow";
import {
  type ReviewRequestModel,
  reviewRequestOf,
  withoutFindingStop,
} from "@/features/reviews/review-request";
import { pendingRequestOf } from "@/features/task/request";
import { REVIEW_STAGE, type ReviewSummary, sessionKey } from "@/lib/wails";
import { useAppStore } from "@/store/app-store";

// MINUTE is how often the wait on the chip is read again.
const MINUTE = 60_000;

/**
 * useReviewRequest is the request bar of the review screen, from the review and the card its
 * conversation holds pending; null when the review asks nothing.
 */
export function useReviewRequest(review: ReviewSummary): ReviewRequestModel | null {
  const now = useNow(MINUTE, true);
  const entries = useAppStore(
    (state) => state.transcripts[sessionKey(review.id, REVIEW_STAGE)]?.entries,
  );
  const pending = entries === undefined ? null : pendingRequestOf(entries);
  return withoutFindingStop(reviewRequestOf(review, now, pending));
}
