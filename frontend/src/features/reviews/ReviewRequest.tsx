import { useEffect, useRef, useState } from "react";
import { RequestBar } from "@/components/system/RequestBar";
import { PublishDialog } from "@/features/reviews/PublishDialog";
import { ReviewAgainDialog } from "@/features/reviews/ReviewAgainDialog";
import { currentCardPass } from "@/features/reviews/review-conversation";
import { type ReviewRequestAction, reviewAnnouncement } from "@/features/reviews/review-request";
import { useReviewRequest } from "@/features/reviews/useReviewRequest";
import { RequestButtons } from "@/features/task/request-buttons";
import { useBornStatus } from "@/features/task/useBornStatus";
import { focusFindingToDecide, focusRequest } from "@/lib/focus";
import { REVIEW_STAGE, type ReviewSummary } from "@/lib/wails";
import {
  applyReview,
  approveRestOfFindings,
  approveReview,
  openExternal,
  openReviewInEditor,
  retry,
} from "@/store/actions";
import { useAppStore, useFlashing } from "@/store/app-store";

// run starts what a button of the bar does; the ones that open a dialog are pressed apart.
function run(action: ReviewRequestAction, review: ReviewSummary, stage: string): Promise<void> {
  switch (action) {
    case "retrySession":
      return retry(review.id, stage);
    case "apply":
      return applyReview(review.id);
    case "openInEditor":
      return openReviewInEditor(review.id);
    case "approve":
      return approveReview(review.id);
    case "openPR":
      return openExternal(review.url);
    default:
      return Promise.resolve();
  }
}

export interface ReviewRequestProps {
  review: ReviewSummary;
}

/**
 * ReviewRequest is the request bar of the review screen, and the dialogs its buttons open: what the
 * review or its conversation asks of the user, and the actions that resolve it.
 */
export function ReviewRequest({ review }: ReviewRequestProps) {
  const [running, setRunning] = useState<ReviewRequestAction | null>(null);
  const flashing = useFlashing();
  const announce = useAppStore((state) => state.announce);
  const dialog = useAppStore((state) => state.reviewDialog);
  const openReviewDialog = useAppStore((state) => state.openReviewDialog);
  const closeReviewDialog = useAppStore((state) => state.closeReviewDialog);
  const request = useReviewRequest(review);
  const situationId = request?.situationId ?? null;
  const status = useBornStatus(situationId, request?.status ?? "");

  // Once Approve the rest went through, the focus goes to the primary the bar has then: the button
  // that was pressed leaves with the findings it approved.
  const focusPrimaryNext = useRef(false);
  const offersApproveRest = request?.actions.some((button) => button.action === "approveRest");
  // biome-ignore lint/correctness/useExhaustiveDependencies: the bar changing is what moves the focus
  useEffect(() => {
    if (focusPrimaryNext.current && !offersApproveRest) {
      focusPrimaryNext.current = false;
      focusRequest("primary");
    }
  }, [request?.label, offersApproveRest]);

  // A situation born with the screen open is said once, with its pass.
  const announced = useRef<string | null>(null);
  useEffect(() => {
    if (status !== "" && request !== null && situationId !== announced.current) {
      announced.current = situationId;
      announce(reviewAnnouncement(review, request));
    }
  }, [status, request, situationId, review, announce]);

  // A dialog left open goes with the screen: the store holds it, and coming back must not bring it.
  useEffect(() => closeReviewDialog, [closeReviewDialog]);

  const mine = dialog !== null && dialog.reviewId === review.id ? dialog.kind : null;
  const close = (open: boolean) => {
    if (!open) {
      closeReviewDialog();
    }
  };
  const dialogs = (
    <>
      <PublishDialog
        review={review}
        open={mine === "publish"}
        onOpenChange={close}
        onReviewAgain={() => openReviewDialog(review.id, "again")}
      />
      <ReviewAgainDialog review={review} open={mine === "again"} onOpenChange={close} />
    </>
  );
  if (request === null) {
    return dialogs;
  }

  const press = async (action: ReviewRequestAction, stage: string | undefined) => {
    switch (action) {
      case "show":
        focusRequest(request.focus);
        return;
      case "nextToDecide":
        focusFindingToDecide(currentCardPass(review)?.findings ?? null, 1);
        return;
      case "publish":
        openReviewDialog(review.id, "publish");
        return;
      case "reviewAgain":
        openReviewDialog(review.id, "again");
        return;
    }
    setRunning(action);
    try {
      const pass = currentCardPass(review)?.pass;
      if (action === "approveRest" && pass !== undefined) {
        focusPrimaryNext.current = await approveRestOfFindings(review.id, pass);
      } else {
        await run(action, review, stage ?? REVIEW_STAGE);
      }
    } finally {
      setRunning(null);
    }
  };

  const flash =
    request.situationId !== null && flashing.has(request.situationId)
      ? request.glyph === "error"
        ? "error"
        : "wait"
      : undefined;

  return (
    <>
      <div className="shrink-0 px-(--space-6) pt-(--space-2)">
        <RequestBar
          form={request.form}
          glyph={request.glyph}
          label={request.label}
          status={status}
          {...(request.place !== undefined ? { place: request.place } : {})}
          {...(request.time !== undefined ? { time: request.time } : {})}
          {...(request.progress !== undefined ? { progress: request.progress } : {})}
          {...(request.progressTooltip !== undefined
            ? { progressTooltip: request.progressTooltip }
            : {})}
          {...(flash !== undefined ? { flash } : {})}
          actions={RequestButtons({
            buttons: request.actions,
            running,
            onPress: (button) => void press(button.action, button.stage),
          })}
        />
      </div>
      {dialogs}
    </>
  );
}
