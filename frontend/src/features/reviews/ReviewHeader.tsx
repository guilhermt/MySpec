import { Trash2 } from "lucide-react";
import { useState } from "react";
import { CardLink } from "@/components/CardLink";
import { PauseButton } from "@/components/PauseButton";
import { PanelGroup } from "@/components/system/AuxPanel";
import { ICONS } from "@/components/system/icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { useAppStore, usePanel } from "@/store/app-store";

/** MODE_LABEL names what the review does with the findings the user approves. */
const MODE_LABEL: Record<PullReviewMode, string> = { publish: "Publish", apply: "Apply" };

export interface ReviewHeaderProps {
  review: ReviewSummary;
}

/**
 * ReviewHeader is the header of the place of a pull request under review, with what the user can
 * do to it on the right.
 */
export function ReviewHeader({ review }: ReviewHeaderProps) {
  const [deleting, setDeleting] = useState(false);
  const panel = usePanel();
  const openPanel = useAppStore((state) => state.openPanel);

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
      <PanelGroup
        panels={[
          { id: "reports", label: "Reports", tooltip: "Reports of every pass", icon: ICONS.file },
        ]}
        open={panel}
        onOpenChange={openPanel}
      />
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
