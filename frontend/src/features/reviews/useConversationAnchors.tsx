import { type ReactNode, useMemo } from "react";
import { FindingsCard } from "@/components/FindingsCard";
import { MarkerLine } from "@/features/chat/entries/MarkerLine";
import { Markdown } from "@/features/chat/Markdown";
import { derivedDecidedLineOf } from "@/features/chat/markers";
import { leaveDecisionCard } from "@/features/chat/useFeed";
import { passRevision } from "@/features/reviews/pass-revision";
import {
  currentCardPass,
  derivedDecidedPasses,
  EDIT_NOTES,
  findingViews,
  reportMarkerIds,
} from "@/features/reviews/review-conversation";
import { type Entry, REVIEW_STAGE, type ReviewSummary } from "@/lib/wails";
import { decideFindingInPlace, openFindingInEditor, saveFindingTextInPlace } from "@/store/actions";
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
        <FindingsCard
          key="findings"
          owner={review.id}
          pass={card.pass}
          revision={card.revision}
          currentRevision={() => passRevision(review.id, card.pass)}
          findings={card.findings ?? []}
          views={findingViews(review, card, now)}
          editNote={EDIT_NOTES[review.mode === "apply" ? "apply" : "publish"]}
          disabled={false}
          decide={(number, decision) =>
            decideFindingInPlace(review.id, card.pass, number, decision)
          }
          saveText={(number, text) => saveFindingTextInPlace(review.id, card.pass, number, text)}
          openEditor={(number) => void openFindingInEditor(review.id, card.pass, number)}
          renderText={(text) => <Markdown cutCode>{text}</Markdown>}
          onLeave={leaveDecisionCard}
        />,
      );
    }
    return anchors;
  }, [review, entries]);
}
