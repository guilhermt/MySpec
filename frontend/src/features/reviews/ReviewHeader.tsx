import { GitPullRequest, PanelRight, Pause, Play, Trash2 } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { DeleteReviewDialog } from "@/features/reviews/DeleteReviewDialog";
import { PullCardBadge } from "@/features/reviews/PullCardBadge";
import { reviewStatusLabel, reviewStatusTone } from "@/features/reviews/review-status";
import { ContextGauge } from "@/features/task/ContextGauge";
import { ToneDot } from "@/features/task/StatusDot";
import { shortName } from "@/lib/repositories";
import { reviewSituation, situationTone } from "@/lib/situations";
import {
  asPullReviewMode,
  asSessionStatus,
  type PullReviewMode,
  type ReviewSummary,
} from "@/lib/wails";
import { pause, resume } from "@/store/actions";

/** MODE_LABEL names what the review does with the findings the user approves. */
const MODE_LABEL: Record<PullReviewMode, string> = { publish: "Publish", apply: "Apply" };

export interface ReviewHeaderProps {
  review: ReviewSummary;
  /** artifactsOpen is whether the panel of the reports is showing right now. */
  artifactsOpen: boolean;
  onToggleArtifacts: () => void;
}

/** ReviewHeader names the pull request under review and holds what the user can do to it. */
export function ReviewHeader({ review, artifactsOpen, onToggleArtifacts }: ReviewHeaderProps) {
  const [deleting, setDeleting] = useState(false);

  const situation = reviewSituation(review);
  // What waits on the user takes the colour of its situation; without one, the
  // dot shows what the review is doing.
  const tone = situation !== null ? situationTone(situation) : reviewStatusTone(review);
  const status = asSessionStatus(review.sessionStatus);
  const paused = status === "paused";
  const running = review.sessionStage !== "";

  return (
    <header className="flex h-11 shrink-0 items-center gap-2 border-b px-3">
      <GitPullRequest aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
      <span className="shrink-0 text-muted-foreground tabular-nums">{`#${review.number}`}</span>
      <span className="min-w-0 truncate font-medium">{review.title}</span>
      <Badge variant="secondary">{shortName(review.repository)}</Badge>
      <span className="shrink-0 text-xs text-muted-foreground">{review.author}</span>
      {review.card !== null && <PullCardBadge card={review.card} />}
      <Badge variant="outline">{MODE_LABEL[asPullReviewMode(review.mode)]}</Badge>
      <Badge variant="outline" className="gap-1.5">
        <ToneDot tone={tone} />
        {reviewStatusLabel(review)}
      </Badge>

      <span className="flex-1" />

      <ContextGauge percent={review.contextPercent} />
      {running && (
        <Button
          variant="ghost"
          size="sm"
          disabled={!paused && status === "error"}
          onClick={() =>
            void (paused
              ? resume(review.id, review.sessionStage)
              : pause(review.id, review.sessionStage))
          }
        >
          {paused ? <Play /> : <Pause />}
          {paused ? "Resume" : "Pause"}
        </Button>
      )}
      <Tooltip>
        <TooltipTrigger
          render={<Button variant="ghost" size="icon-sm" />}
          aria-label="Reports"
          aria-pressed={artifactsOpen}
          onClick={onToggleArtifacts}
        >
          <PanelRight />
        </TooltipTrigger>
        <TooltipContent>Reports</TooltipContent>
      </Tooltip>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Delete review"
        onClick={() => setDeleting(true)}
      >
        <Trash2 />
      </Button>

      <DeleteReviewDialog review={review} open={deleting} onOpenChange={setDeleting} />
    </header>
  );
}
