import { type KeyboardEvent, type ReactNode, useEffect, useRef } from "react";
import { ArrivalFocus } from "@/components/ArrivalFocus";
import { PanelLayout } from "@/components/system/AuxPanel";
import { Conversation } from "@/features/chat/Conversation";
import { CheckStrip } from "@/features/reviews/CheckStrip";
import { ReportsPanel } from "@/features/reviews/ReportsPanel";
import { ReviewComposer } from "@/features/reviews/ReviewComposer";
import { ReviewDetails } from "@/features/reviews/ReviewDetails";
import { ReviewHeader } from "@/features/reviews/ReviewHeader";
import { ReviewRequest } from "@/features/reviews/ReviewRequest";
import {
  currentCardPass,
  reviewFixedCard,
  waitingChecksFoot,
} from "@/features/reviews/review-conversation";
import { hasReviewComposer, reviewChecks } from "@/features/reviews/review-request";
import { useConversationAnchors } from "@/features/reviews/useConversationAnchors";
import { currentReviewRequest, useReviewRequest } from "@/features/reviews/useReviewRequest";
import { ChangedFilesCard } from "@/features/task/ChangedFilesCard";
import { LiveChecks } from "@/features/task/LiveChecks";
import { useFocusRescue } from "@/features/task/request-focus";
import { focusFindingToDecide } from "@/lib/focus";
import { modalOpen } from "@/lib/layers";
import { REVIEW_STAGE, type ReviewSummary, sessionKey } from "@/lib/wails";
import { loadTranscript, refreshReviewPR } from "@/store/actions";
import { useAppStore, usePanel, useReview } from "@/store/app-store";

// fixedOf is the fixed card at the end of the conversation of the review, if any.
function fixedOf(review: ReviewSummary): ReactNode {
  switch (reviewFixedCard(review)) {
    case "checks":
      return (
        <LiveChecks
          reading={reviewChecks(review)}
          foot={waitingChecksFoot(review)}
          onRefresh={() => refreshReviewPR(review.id)}
          fixed
        />
      );
    case "files":
      return <ChangedFilesCard taskId={review.id} review={review.review} />;
    case null:
      return undefined;
  }
}

// ReviewConversation is the conversation of a review, with the card of findings after the report
// being decided, the decisions of the passes it never recorded, and the card that is fixed at its end.
function ReviewConversation({ review }: { review: ReviewSummary }) {
  const anchors = useConversationAnchors(review);
  return (
    <Conversation
      key="conversation:review"
      taskId={review.id}
      stage={REVIEW_STAGE}
      session={review}
      after={anchors}
      fixed={fixedOf(review)}
      replyWaiting={false}
    />
  );
}

// ReviewArrival is the focus on arriving at a situation of the review, apart from ReviewView so only
// it follows the clock of the request.
function ReviewArrival({ review, ready }: { review: ReviewSummary; ready: boolean }) {
  const request = useReviewRequest(review);
  return <ArrivalFocus target={request?.focus ?? null} ready={ready} />;
}

export interface ReviewViewProps {
  reviewId: string;
}

/** ReviewView is the screen of one review: the conversation with its findings, the request, the composer and the panels. */
export function ReviewView({ reviewId }: ReviewViewProps) {
  const review = useReview(reviewId);
  const panel = usePanel();
  const openReviewDialog = useAppStore((state) => state.openReviewDialog);
  const rescue = useRef<HTMLElement>(null);
  useFocusRescue(rescue);
  // A conversation that couldn't be read is settled too: the focus lands without it.
  const transcriptSettled = useAppStore((state) => {
    const status = state.transcripts[sessionKey(reviewId, REVIEW_STAGE)]?.status;
    return status === "ready" || status === "error";
  });

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

  // Alt+↓ and Alt+↑ go to the next and the previous finding to decide from anywhere on the screen,
  // the composer included. Ctrl+Enter on the bar or on the card of findings opens the publication
  // when the primary of the bar is Publish review…, enabled; the composer and the dialogs have their
  // own Enter.
  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.defaultPrevented || modalOpen()) {
      return;
    }
    if (event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey) {
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        focusFindingToDecide(
          currentCardPass(review)?.findings ?? null,
          event.key === "ArrowDown" ? 1 : -1,
        );
      }
      return;
    }
    if (
      event.key !== "Enter" ||
      !event.ctrlKey ||
      event.repeat ||
      !(event.target instanceof Element)
    ) {
      return;
    }
    if (
      event.target.closest('[data-slot="composer"]') !== null ||
      event.target.closest("[aria-label=Request], [data-decision-card]") === null
    ) {
      return;
    }
    const primary = currentReviewRequest(review)?.actions.find(
      (button) => button.variant === "primary",
    );
    if (primary?.action === "publish" && primary.disabledReason === undefined) {
      event.preventDefault();
      openReviewDialog(review.id, "publish");
    }
  };

  return (
    <section
      ref={rescue}
      aria-label={review.title}
      onKeyDown={onKeyDown}
      className="flex min-h-0 min-w-0 flex-1 flex-col bg-background"
    >
      <ReviewHeader review={review} />
      <ReviewArrival review={review} ready={transcriptSettled} />
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
        <ReviewConversation review={review} />
        <ReviewRequest review={review} />
        {hasReviewComposer(review) && <ReviewComposer review={review} />}
      </PanelLayout>
    </section>
  );
}
