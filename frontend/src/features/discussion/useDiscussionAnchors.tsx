import { type ReactNode, useMemo } from "react";
import { roundFolds, roundLineOf } from "@/features/chat/discussion-markers";
import { MarkerLine } from "@/features/chat/entries/MarkerLine";
import { discussionInputOf } from "@/features/discussion/discussion-request";
import { DISCUSSION_STAGE, type DiscussionSummary, type Entry } from "@/lib/wails";
import { useTranscript } from "@/store/app-store";

const NO_ENTRIES: readonly Entry[] = [];

/**
 * useDiscussionAnchors is what the conversation of a discussion draws next to its entries: the card
 * of drafts after the latest marker of the current round, and the rounds without a marker, folded
 * before the Drafts written of the next round. The folded round carries no time: it was never an
 * event of the conversation.
 */
export function useDiscussionAnchors(
  discussion: DiscussionSummary,
  card: ReactNode | null,
): { after: ReadonlyMap<string, ReactNode>; before: ReadonlyMap<string, ReactNode> } {
  const entries = useTranscript(discussion.id, DISCUSSION_STAGE)?.entries ?? NO_ENTRIES;
  return useMemo(() => {
    const input = discussionInputOf(discussion);
    const folds = roundFolds(entries, input.drafts);
    const before = new Map<string, ReactNode>();
    for (const [key, round] of folds.before) {
      before.set(
        key,
        <MarkerLine
          key={`round-${round}`}
          view={roundLineOf(round, input.drafts, 0)}
          createdAt=""
          discussion={input}
        />,
      );
    }
    const after = new Map<string, ReactNode>();
    if (card !== null) {
      after.set(folds.cardAfter, card);
    }
    return { after, before };
  }, [discussion, entries, card]);
}
