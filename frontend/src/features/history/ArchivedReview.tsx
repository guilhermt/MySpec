import { useRef, useState } from "react";
import { Button } from "@/components/system/Button";
import { Icon } from "@/components/system/Icon";
import { ICONS } from "@/components/system/icons";
import { Skeleton, SkeletonBar } from "@/components/system/Skeleton";
import { Tag } from "@/components/system/Tag";
import { Tooltip } from "@/components/system/Tooltip";
import { MarkerLine } from "@/features/chat/entries/MarkerLine";
import type { MarkerView } from "@/features/chat/markers";
import { ArchivedBody } from "@/features/history/ArchivedBody";
import { ArchivedFacts } from "@/features/history/ArchivedFacts";
import { ArchivedFindings } from "@/features/history/ArchivedFindings";
import { ArchivedMarkers } from "@/features/history/ArchivedMarkers";
import { ArchivedMenu } from "@/features/history/ArchivedMenu";
import { ArchivedTags } from "@/features/history/ArchivedTags";
import {
  archivedReviewFacts,
  outFindings,
  passHeading,
  recordedPasses,
} from "@/features/history/archived";
import { historyEntries, historyNeighbor } from "@/features/history/history-list";
import { useArchivedItem } from "@/features/history/useArchivedItem";
import { LocationHeader } from "@/features/navigation/LocationHeader";
import { DeleteReviewDialog } from "@/features/reviews/DeleteReviewDialog";
import { outcomeLabel } from "@/features/reviews/review-status";
import { olderKey } from "@/lib/history";
import { shortRef } from "@/lib/repositories";
import type { ReviewPass } from "@/lib/wails";
import { openExternal } from "@/store/actions";
import { useAppStore } from "@/store/app-store";

/** reportMarker is the line of the report of a pass, which opens in place. */
function reportMarker(pass: ReviewPass): MarkerView {
  return {
    icon: "file",
    text: "Report",
    complement: pass.file,
    body: { kind: "artifact", name: pass.file, openIn: "artifacts" },
    timeHidden: true,
  };
}

interface PassSectionProps {
  reviewId: string;
  mode: string;
  pass: ReviewPass;
  now: number;
}

// PassSection is one pass of the review: what became of it and when, the findings that left it and its report.
function PassSection({ reviewId, mode, pass, now }: PassSectionProps) {
  const { title, outcome, time } = passHeading(pass, now);
  const findings = outFindings(pass, mode);
  return (
    <section
      aria-label={title}
      className="flex flex-col gap-(--space-2) border-t border-line-1 pt-(--space-4) first:border-t-0 first:pt-0"
    >
      <div className="flex items-baseline gap-(--space-3) text-(length:--text-ui) leading-(--leading-ui)">
        <h2 className="font-semibold text-ink-1">{title}</h2>
        <span className="min-w-0 flex-1 text-ink-1">{outcome}</span>
        {time !== "" && (
          <span className="shrink-0 text-(length:--text-micro) leading-(--leading-micro) text-ink-4 tabular-nums">
            {time}
          </span>
        )}
      </div>
      {findings.length > 0 && <ArchivedFindings pass={pass.pass} findings={findings} />}
      <ArchivedMarkers label={`Report of pass ${pass.pass}`}>
        <MarkerLine
          view={reportMarker(pass)}
          createdAt=""
          archived={{ kind: "review", id: reviewId }}
        />
      </ArchivedMarkers>
    </section>
  );
}

export interface ArchivedReviewProps {
  reviewId: string;
}

/**
 * ArchivedReview is a review whose pull request was merged or closed, as History keeps it: the facts,
 * and each pass with what became of it and its report read in place. Nothing runs; going back and
 * deleting are what is left.
 */
export function ArchivedReview({ reviewId }: ArchivedReviewProps) {
  const review = useArchivedItem("review", reviewId);
  const moreRef = useRef<HTMLButtonElement>(null);
  const [deleting, setDeleting] = useState(false);
  const [neighbor, setNeighbor] = useState<string | null>(null);

  if (review === null) {
    return (
      <section className="flex min-h-0 min-w-0 flex-1 flex-col bg-background">
        <LocationHeader />
        <ArchivedBody>
          <Skeleton label="Reading the review">
            <SkeletonBar className="w-1/2" />
            <SkeletonBar className="w-full" />
            <SkeletonBar className="w-3/4" />
          </Skeleton>
        </ArchivedBody>
      </section>
    );
  }

  const now = Date.now();
  const passes = recordedPasses(review);

  // The entries History shows, as of the moment the dialog opens: the row that takes the place of this one.
  const openDialog = () => {
    const { app, olderArchived, olderLists, historyQuery } = useAppStore.getState();
    const filter = app?.repositoryFilter ?? "";
    const ids = olderLists[olderKey(historyQuery, filter)]?.ids ?? [];
    setNeighbor(
      historyNeighbor(
        historyEntries(app, { archived: olderArchived, ids }, historyQuery, filter, null),
        review.id,
      ),
    );
    setDeleting(true);
  };

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col bg-background">
      <LocationHeader
        lead={<Icon icon={ICONS.review} className="text-ink-3" />}
        progress={
          <ArchivedTags>
            <Tag>{outcomeLabel(review.outcome)}</Tag>
          </ArchivedTags>
        }
      >
        <Tooltip content={`Open ${shortRef(`${review.repository}#${review.number}`)} on GitHub`}>
          <Button variant="ghost" size="sm" onClick={() => void openExternal(review.url)}>
            Open on GitHub
            <Icon icon={ICONS.external} size="sm" />
          </Button>
        </Tooltip>
        <ArchivedMenu tooltip="Delete from History" onDelete={openDialog} triggerRef={moreRef} />
      </LocationHeader>

      <ArchivedBody>
        <ArchivedFacts facts={archivedReviewFacts(review, now)} />

        {passes.length === 0 ? (
          <p className="text-(length:--text-meta) leading-(--leading-meta) text-ink-3">
            No report was written.
          </p>
        ) : (
          <div className="flex flex-col gap-(--space-4)">
            {passes.map((pass) => (
              <PassSection
                key={pass.pass}
                reviewId={review.id}
                mode={review.mode}
                pass={pass}
                now={now}
              />
            ))}
          </div>
        )}

        <p className="text-(length:--text-meta) leading-(--leading-meta) text-ink-3">
          The conversation of a review isn't kept in History.
        </p>
      </ArchivedBody>

      <DeleteReviewDialog
        review={review}
        archived
        neighbor={neighbor}
        open={deleting}
        onOpenChange={(open) => {
          setDeleting(open);
          if (!open) {
            moreRef.current?.focus();
          }
        }}
      />
    </section>
  );
}
