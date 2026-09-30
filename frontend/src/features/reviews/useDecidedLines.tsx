import { type ReactNode, useMemo } from "react";
import { MarkerLine } from "@/features/chat/entries/MarkerLine";
import { derivedDecidedLineOf } from "@/features/chat/markers";
import { derivedDecidedPasses, reportMarkerIds } from "@/features/reviews/review-conversation";
import { type Entry, REVIEW_STAGE, type ReviewSummary } from "@/lib/wails";
import { useTranscript } from "@/store/app-store";

const NO_ENTRIES: readonly Entry[] = [];

/**
 * useDecidedLines is the line You decided of each pass published or sent before the conversation
 * recorded its decisions, derived from the findings of the pass and keyed by the marker of its report,
 * which it follows.
 */
export function useDecidedLines(review: ReviewSummary): ReadonlyMap<string, ReactNode> {
  const entries = useTranscript(review.id, REVIEW_STAGE)?.entries ?? NO_ENTRIES;
  return useMemo(() => {
    const now = Date.now();
    const ids = reportMarkerIds(entries);
    const lines = new Map<string, ReactNode>();
    for (const pass of derivedDecidedPasses(review, entries)) {
      lines.set(
        ids.get(pass.pass) ?? `pass-${pass.pass}`,
        <MarkerLine
          key={`decided-${pass.pass}`}
          view={derivedDecidedLineOf(review, pass, now)}
          createdAt={pass.publishedAt !== "" ? pass.publishedAt : pass.sentAt}
          review={review}
        />,
      );
    }
    return lines;
  }, [review, entries]);
}
