import { useCallback, useEffect, useState } from "react";
import { useDefaultLayout, usePanelRef } from "react-resizable-panels";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { Composer } from "@/features/chat/Composer";
import { Conversation } from "@/features/chat/Conversation";
import { FindingsPanel } from "@/features/reviews/FindingsPanel";
import { ReportsPanel } from "@/features/reviews/ReportsPanel";
import { ReviewBar } from "@/features/reviews/ReviewBar";
import { ReviewHeader } from "@/features/reviews/ReviewHeader";
import { showsChanges } from "@/features/reviews/review-status";
import { ReviewStrip } from "@/features/task/ReviewStrip";
import { REVIEW_STAGE, sessionKey } from "@/lib/wails";
import { loadTranscript } from "@/store/actions";
import { useAppStore, useReview } from "@/store/app-store";

const CONVERSATION_PANEL = "conversation";
const REPORTS_PANEL = "reports";

const PANEL_IDS = [CONVERSATION_PANEL, REPORTS_PANEL];

export interface ReviewViewProps {
  reviewId: string;
}

/** ReviewView is the screen of one review: the findings, the conversation and the reports. */
export function ReviewView({ reviewId }: ReviewViewProps) {
  const review = useReview(reviewId);
  const panelRef = usePanelRef();
  const [reportsOpen, setReportsOpen] = useState(false);
  const { defaultLayout, onLayoutChanged } = useDefaultLayout({
    id: `myspec.review-panels:${reviewId}`,
    panelIds: PANEL_IDS,
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

  const toggleReports = useCallback(() => {
    const panel = panelRef.current;
    if (panel === null) {
      return;
    }
    if (panel.isCollapsed()) {
      panel.expand();
    } else {
      panel.collapse();
    }
  }, [panelRef]);

  if (review === null) {
    return <section className="h-dvh bg-background" />;
  }

  return (
    <section className="flex h-dvh min-w-0 flex-col bg-background">
      <ReviewHeader review={review} artifactsOpen={reportsOpen} onToggleArtifacts={toggleReports} />
      <ReviewBar review={review} />
      <ResizablePanelGroup
        orientation="horizontal"
        defaultLayout={defaultLayout}
        onLayoutChanged={onLayoutChanged}
        className="min-h-0 flex-1"
      >
        {/* The library's panel scrolls by default; only the conversation scrolls here, so it clips. */}
        <ResizablePanel
          id={CONVERSATION_PANEL}
          defaultSize="60%"
          minSize="40%"
          className="flex min-w-0 flex-col"
          style={{ overflow: "clip" }}
        >
          {showsChanges(review) && review.review !== null && (
            <ReviewStrip taskId={review.id} subject="pr" review={review.review} />
          )}
          <FindingsPanel review={review} />
          <Conversation taskId={review.id} stage={REVIEW_STAGE} session={review} />
          <Composer taskId={review.id} stage={REVIEW_STAGE} session={review} />
        </ResizablePanel>
        <ResizableHandle />
        <ResizablePanel
          id={REPORTS_PANEL}
          panelRef={panelRef}
          defaultSize="40%"
          minSize="25%"
          collapsible
          collapsedSize="0%"
          onResize={(size) => setReportsOpen(size.asPercentage > 0)}
        >
          <ReportsPanel review={review} />
        </ResizablePanel>
      </ResizablePanelGroup>
    </section>
  );
}
