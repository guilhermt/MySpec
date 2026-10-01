import { type ReactNode, useMemo } from "react";
import { MarkerLine } from "@/features/chat/entries/MarkerLine";
import { derivedDecidedLineOf } from "@/features/chat/markers";
import { FindingsCard } from "@/features/reviews/FindingsCard";
import {
  currentCardPass,
  derivedDecidedPasses,
  reportMarkerIds,
} from "@/features/reviews/review-conversation";
import { type Entry, REVIEW_STAGE, type ReviewSummary } from "@/lib/wails";
import { useTranscript } from "@/store/app-store";

const NO_ENTRIES: readonly Entry[] = [];

// END is the key the conversation gives what has no entry to follow: the end of the conversation.
const END = "end";

/**
 * useConversationAnchors is what the conversation of a review draws after one of its entries, by the
 * id of the entry: the card of findings after the latest report of the pass being decided, and the
 * line You decided of each pass published or sent before the conversation recorded its decisions,
 * derived from its findings, after the report of the pass. The derived line carries no time: the
 * moment of the publication would read out of order among the entries that follow the report.
 */
export function useConversationAnchors(review: ReviewSummary): ReadonlyMap<string, ReactNode> {
  const entries = useTranscript(review.id, REVIEW_STAGE)?.entries ?? NO_ENTRIES;
  return useMemo(() => {
    const now = Date.now();
    const ids = reportMarkerIds(entries);
    const anchors = new Map<string, ReactNode>();
    for (const pass of derivedDecidedPasses(review, entries)) {
      anchors.set(
        ids.get(pass.pass) ?? `pass-${pass.pass}`,
        <MarkerLine
          key={`decided-${pass.pass}`}
          view={derivedDecidedLineOf(review, pass, now)}
          createdAt=""
          review={review}
        />,
      );
    }
    const card = currentCardPass(review);
    if (card !== null) {
      anchors.set(
        ids.get(card.pass) ?? END,
        <FindingsCard key="findings" review={review} pass={card} />,
      );
    }
    return anchors;
  }, [review, entries]);
}
