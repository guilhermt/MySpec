import { ItemPause } from "@/components/ItemPause";
import { PanelGroup } from "@/components/system/AuxPanel";
import { ContextMeter } from "@/components/system/ContextMeter";
import { ICONS } from "@/components/system/icons";
import { Stepper } from "@/components/system/Stepper";
import { useNow } from "@/features/attention/useNow";
import { LocationHeader } from "@/features/navigation/LocationHeader";
import { ReviewMenu } from "@/features/reviews/ReviewMenu";
import {
  isPausedReview,
  reviewContextDetail,
  reviewPauseRefusal,
  reviewStepper,
} from "@/features/reviews/review-header";
import type { ReviewSummary } from "@/lib/wails";
import { useAppStore, usePanel } from "@/store/app-store";

/** PANELS are the panels of a review, in their order, each with what it shows. */
const PANELS = [
  {
    id: "details",
    label: "Details",
    tooltip: "The pull request, the checks read before each pass and the passes",
    icon: ICONS.details,
  },
  { id: "reports", label: "Reports", tooltip: "Reports of every pass", icon: ICONS.file },
] as const;

// MINUTE is how often the times in the header are read again.
const MINUTE = 60_000;

export interface ReviewHeaderProps {
  review: ReviewSummary;
}

/**
 * ReviewHeader is the header of the place of a pull request under review: the title, the pill of its
 * pass, and on the right the context meter, Pause or Resume, the panels and the ⋯. The meter and Pause
 * are there only while the review has a session.
 */
export function ReviewHeader({ review }: ReviewHeaderProps) {
  const now = useNow(MINUTE, true);
  const panel = usePanel();
  const openPanel = useAppStore((state) => state.openPanel);
  const stepper = reviewStepper(review, now);
  const hasSession = review.sessionStage !== "";

  return (
    <LocationHeader
      progress={
        <Stepper
          steps={stepper.steps}
          pill={stepper.pill}
          label={stepper.label}
          tooltip={stepper.tooltip}
        />
      }
    >
      {hasSession && (
        <ContextMeter
          percent={review.contextPercent === 0 ? null : review.contextPercent}
          paused={isPausedReview(review)}
          compact="narrow"
          detail={reviewContextDetail(review)}
        />
      )}
      <ItemPause
        id={review.id}
        item="the review"
        session={
          hasSession
            ? {
                stage: review.sessionStage,
                sessionStatus: review.sessionStatus,
                pausedAt: review.pausedAt,
              }
            : null
        }
        refusal={() => reviewPauseRefusal(review)}
        now={now}
      />
      <PanelGroup panels={PANELS} open={panel} onOpenChange={openPanel} />
      <ReviewMenu review={review} />
    </LocationHeader>
  );
}
