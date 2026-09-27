import { PanelRight, Trash2 } from "lucide-react";
import { useState } from "react";
import { CardLink } from "@/components/CardLink";
import { PauseButton } from "@/components/PauseButton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { LocationHeader } from "@/features/navigation/LocationHeader";
import { DeleteReviewDialog } from "@/features/reviews/DeleteReviewDialog";
import { reviewStatusLabel, reviewStatusTone } from "@/features/reviews/review-status";
import { ContextGauge } from "@/features/task/ContextGauge";
import { ToneDot } from "@/features/task/StatusDot";
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

/**
 * ReviewHeader is the header of the place of a pull request under review, with what the user can
 * do to it on the right.
 */
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
    <LocationHeader>
      <Badge variant="outline">{MODE_LABEL[asPullReviewMode(review.mode)]}</Badge>
      <Badge variant="outline" className="gap-1.5">
        <ToneDot tone={tone} />
        {reviewStatusLabel(review)}
      </Badge>
      <ContextGauge percent={review.contextPercent} />
      {running && (
        <PauseButton
          paused={paused}
          disabled={!paused && status === "error"}
          onClick={() =>
            void (paused
              ? resume(review.id, review.sessionStage)
              : pause(review.id, review.sessionStage))
          }
        />
      )}
      {review.card !== null && <CardLink card={review.card} />}
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
    </LocationHeader>
  );
}
