import { Composer } from "@/features/chat/Composer";
import { useConversationCards } from "@/features/chat/useConversationCards";
import {
  discussionComposerContext,
  discussionOtherPrimary,
  discussionStarters,
} from "@/features/discussion/discussion-request";
import { useDiscussionRequest } from "@/features/discussion/useDiscussionRequest";
import { discussionSituation } from "@/lib/situations";
import { asSituationKind, DISCUSSION_STAGE, type DiscussionSummary } from "@/lib/wails";

export interface DiscussionComposerProps {
  discussion: DiscussionSummary;
}

/**
 * DiscussionComposer is the composer of the discussion screen, told what the discussion asks:
 * changing the drafts, fixing the file the agent wrote, going on for more cards. The primary is the
 * bar's, or a pending card's.
 */
export function DiscussionComposer({ discussion }: DiscussionComposerProps) {
  const cards = useConversationCards(discussion.id, DISCUSSION_STAGE);
  const request = useDiscussionRequest(discussion);
  const situation = discussionSituation(discussion);
  const kind = situation === null ? null : asSituationKind(situation.kind);
  return (
    <Composer
      taskId={discussion.id}
      stage={DISCUSSION_STAGE}
      session={discussion}
      question={cards.question}
      permissionPending={cards.permission}
      chips={kind === "reply" ? cards.chips : []}
      otherPrimary={
        discussionOtherPrimary(discussion, request) || cards.question !== null || cards.permission
      }
      context={discussionComposerContext(discussion)}
      starters={discussionStarters(discussion)}
    />
  );
}
