import { Check, Code, ExternalLink, GitPullRequestArrow, RotateCcw, Wrench } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { PublishDialog } from "@/features/reviews/PublishDialog";
import { ReviewAgainDialog } from "@/features/reviews/ReviewAgainDialog";
import { reviewStatusLabel, reviewStatusTone } from "@/features/reviews/review-status";
import { ToneDot } from "@/features/task/StatusDot";
import { reviewSituation, situationTone } from "@/lib/situations";
import { asPullReviewMode, type ReviewSummary } from "@/lib/wails";
import { applyReview, approveReview, openExternal, openReviewInEditor } from "@/store/actions";

export interface ReviewBarProps {
  review: ReviewSummary;
}

/** ReviewBar says where the review stands and holds what can be done to it. */
export function ReviewBar({ review }: ReviewBarProps) {
  const [publishing, setPublishing] = useState(false);
  const [asking, setAsking] = useState(false);

  const situation = reviewSituation(review);
  // What waits on the user takes the colour of its situation; without one, the
  // dot shows what the review is doing.
  const tone = situation !== null ? situationTone(situation) : reviewStatusTone(review);
  const applying = asPullReviewMode(review.mode) === "apply";
  const canOpenEditor = review.worktreePath !== "";

  const openButton = (
    <Button
      variant="outline"
      size="sm"
      disabled={!canOpenEditor}
      onClick={() => void openReviewInEditor(review.id)}
    >
      <Code />
      Open in VS Code
    </Button>
  );

  return (
    <div className="flex h-10 shrink-0 items-center gap-2 border-b px-3">
      <button
        type="button"
        onClick={() => void openExternal(review.url)}
        className="flex shrink-0 items-center gap-1 rounded-md text-xs text-muted-foreground transition-colors hover:text-foreground"
      >
        {`#${review.number}`}
        <ExternalLink aria-hidden="true" className="size-3.5" />
      </button>
      <span
        role="status"
        aria-live="polite"
        className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground"
      >
        <ToneDot tone={tone} />
        {reviewStatusLabel(review)}
      </span>
      {review.stalePass && (
        <span className="shrink-0 text-xs text-[var(--status-attention)]">
          New commits since this pass
        </span>
      )}
      {review.checkError !== "" && (
        <span className="shrink-0 text-xs text-[var(--status-attention)]" title={review.checkError}>
          Couldn't check GitHub
        </span>
      )}
      {review.publishError !== "" && (
        <span className="min-w-0 truncate text-xs text-destructive" title={review.publishError}>
          {review.publishError}
        </span>
      )}
      {review.unreadableReport !== "" && (
        <span
          className="min-w-0 truncate text-xs text-[var(--status-attention)]"
          title={review.unreadableReport}
        >
          {review.unreadableReport}
        </span>
      )}
      {review.commitFailed && (
        <span className="shrink-0 text-xs text-muted-foreground">
          The last approval didn't produce a commit.
        </span>
      )}

      <span className="flex-1" />

      {applying ? (
        <>
          <Button size="sm" disabled={!review.canApply} onClick={() => void applyReview(review.id)}>
            <Wrench />
            Apply
          </Button>
          <Button
            size="sm"
            disabled={!review.canApprove}
            onClick={() => void approveReview(review.id)}
          >
            <Check />
            Approve
          </Button>
        </>
      ) : (
        <Button size="sm" disabled={!review.canPublish} onClick={() => setPublishing(true)}>
          <GitPullRequestArrow />
          Publish review
        </Button>
      )}

      <Button
        variant="outline"
        size="sm"
        disabled={!review.canReviewAgain}
        onClick={() => setAsking(true)}
      >
        <RotateCcw />
        Review again
      </Button>

      {canOpenEditor ? (
        openButton
      ) : (
        <Tooltip>
          <TooltipTrigger render={<span />}>{openButton}</TooltipTrigger>
          <TooltipContent>The worktree doesn't exist yet</TooltipContent>
        </Tooltip>
      )}

      <PublishDialog
        review={review}
        open={publishing}
        onOpenChange={setPublishing}
        onReviewAgain={() => setAsking(true)}
      />
      <ReviewAgainDialog review={review} open={asking} onOpenChange={setAsking} />
    </div>
  );
}
