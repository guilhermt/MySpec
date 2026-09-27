import { ExternalLink, Trash2 } from "lucide-react";
import { useState } from "react";
import { CardLink } from "@/components/CardLink";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Markdown } from "@/features/chat/Markdown";
import { formatDates } from "@/features/history/history-format";
import { LocationHeader } from "@/features/navigation/LocationHeader";
import { Banner } from "@/features/notice/Notice";
import { DeleteReviewDialog } from "@/features/reviews/DeleteReviewDialog";
import { Published } from "@/features/reviews/ReportsPanel";
import {
  findingLocation,
  outcomeLabel,
  placementLabel,
  reportLabel,
} from "@/features/reviews/review-status";
import { useReviewArtifact } from "@/features/reviews/useReviewArtifact";
import type { ReviewPass } from "@/lib/wails";
import { openExternal } from "@/store/actions";
import { useArchivedReview } from "@/store/app-store";

const LOADING_WIDTHS = ["w-1/2", "w-full", "w-3/4"];

interface PassReportProps {
  reviewId: string;
  pass: ReviewPass;
}

/** PassReport is one pass of an archived review: its report, and what of it went to GitHub. */
function PassReport({ reviewId, pass }: PassReportProps) {
  const artifact = useReviewArtifact(reviewId, pass.file, pass.revision);
  const [dismissed, setDismissed] = useState("");
  const sent = (pass.findings ?? []).filter((finding) => finding.placement !== "");

  return (
    <article aria-label={reportLabel(pass)} className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold">{reportLabel(pass)}</h2>
      {pass.published && (
        <div className="flex flex-col gap-2">
          <Published pass={pass} />
          {sent.length > 0 && (
            <ul
              aria-label={`Published findings of review ${pass.pass}`}
              className="flex flex-col gap-2"
            >
              {sent.map((finding) => (
                <li key={finding.number} className="flex flex-col gap-1 rounded-lg border p-3">
                  <span className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="font-mono">{findingLocation(finding)}</span>
                    <span>·</span>
                    <span>{placementLabel(finding.placement)}</span>
                  </span>
                  <p className="text-sm whitespace-pre-wrap">{finding.text}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {artifact.status === "loading" && (
        <div className="flex flex-col gap-3">
          {LOADING_WIDTHS.map((width) => (
            <Skeleton key={width} className={`h-4 ${width}`} />
          ))}
        </div>
      )}
      {artifact.status === "error" && artifact.error !== dismissed && (
        <Banner
          className="bg-destructive/10"
          title="Couldn't read the report"
          onDismiss={() => setDismissed(artifact.error)}
        >
          {artifact.error}
        </Banner>
      )}
      {artifact.status === "ready" && (
        <div className="select-text">
          <Markdown>{artifact.content}</Markdown>
        </div>
      )}
    </article>
  );
}

export interface ArchivedReviewViewProps {
  reviewId: string;
}

/**
 * ArchivedReviewView is a review whose pull request was merged or closed, as
 * the history keeps it: the report of every pass and what was published.
 * Only going back and deleting are left.
 */
export function ArchivedReviewView({ reviewId }: ArchivedReviewViewProps) {
  const review = useArchivedReview(reviewId);
  const [deleting, setDeleting] = useState(false);

  if (review === null) {
    return <section className="min-h-0 flex-1 bg-background" />;
  }

  const passes = (review.passes ?? []).filter((pass) => pass.recorded);

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col bg-background">
      <LocationHeader>
        <Badge variant="outline">{outcomeLabel(review.outcome)}</Badge>
        {review.card !== null && <CardLink card={review.card} />}
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Open on GitHub"
          onClick={() => void openExternal(review.url)}
        >
          <ExternalLink />
        </Button>
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

      <div className="flex h-9 shrink-0 items-center gap-3 border-b px-3 text-xs text-muted-foreground">
        <span className="shrink-0">{review.author}</span>
        <span className="shrink-0">{formatDates(review.createdAt, review.archivedAt)}</span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-6">
        {passes.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">No report was written.</p>
        ) : (
          <div className="flex max-w-[58.5rem] flex-col gap-8">
            {passes.map((pass) => (
              <PassReport key={pass.pass} reviewId={review.id} pass={pass} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
