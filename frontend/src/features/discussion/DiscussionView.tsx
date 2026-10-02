import { useEffect, useMemo, useRef } from "react";
import { PanelLayout } from "@/components/system/AuxPanel";
import { Conversation } from "@/features/chat/Conversation";
import { ConversationComposer } from "@/features/chat/ConversationComposer";
import { DiscussionBar } from "@/features/discussion/DiscussionBar";
import { DiscussionDetails } from "@/features/discussion/DiscussionDetails";
import { DiscussionDialogs } from "@/features/discussion/DiscussionDialogs";
import { DiscussionHeader } from "@/features/discussion/DiscussionHeader";
import { DocumentsPanel } from "@/features/discussion/DocumentsPanel";
import { DraftsPanel } from "@/features/discussion/DraftsPanel";
import { discussionInputOf } from "@/features/discussion/discussion-request";
import { useDiscussionAnchors } from "@/features/discussion/useDiscussionAnchors";
import { useFocusRescue } from "@/features/task/request-focus";
import { discussionSituation } from "@/lib/situations";
import { asSituationKind, DISCUSSION_STAGE, type DiscussionSummary, sessionKey } from "@/lib/wails";
import { loadTranscript } from "@/store/actions";
import { useAppStore, useDiscussion, usePanel } from "@/store/app-store";

// DiscussionConversation is the conversation of a discussion, with what its markers know of it.
function DiscussionConversation({ discussion }: { discussion: DiscussionSummary }) {
  const situation = discussionSituation(discussion);
  // A question in text waits for a reply, unless it is the drafts file that can't be read.
  const replyWaiting =
    situation !== null &&
    asSituationKind(situation.kind) === "reply" &&
    discussion.unreadableDrafts === "";
  const input = useMemo(() => discussionInputOf(discussion), [discussion]);
  // The card of drafts enters the anchors with the card itself.
  const { after, before } = useDiscussionAnchors(discussion, null);
  return (
    <Conversation
      key="conversation:discussion"
      taskId={discussion.id}
      stage={DISCUSSION_STAGE}
      session={discussion}
      discussion={input}
      after={after}
      before={before}
      replyWaiting={replyWaiting}
    />
  );
}

export interface DiscussionViewProps {
  discussionId: string;
}

/** DiscussionView is the screen of one discussion: the conversation, the drafts and the panels. */
export function DiscussionView({ discussionId }: DiscussionViewProps) {
  const discussion = useDiscussion(discussionId);
  const panel = usePanel();
  const rescue = useRef<HTMLElement>(null);
  useFocusRescue(rescue);

  // The conversation is fetched once and then kept: leaving the discussion and
  // coming back costs nothing, and the events keep being applied while it is
  // away.
  useEffect(() => {
    const key = sessionKey(discussionId, DISCUSSION_STAGE);
    if (useAppStore.getState().transcripts[key] === undefined) {
      void loadTranscript(discussionId, DISCUSSION_STAGE);
    }
  }, [discussionId]);

  if (discussion === null) {
    return <section ref={rescue} className="min-h-0 flex-1 bg-background" />;
  }

  return (
    <section
      ref={rescue}
      aria-label={discussion.title}
      className="flex min-h-0 min-w-0 flex-1 flex-col bg-background"
    >
      <DiscussionHeader discussion={discussion} />
      <DiscussionBar discussion={discussion} />
      <PanelLayout
        panel={
          panel === "details" ? (
            <DiscussionDetails key="details" discussion={discussion} />
          ) : panel === "documents" ? (
            <DocumentsPanel key="documents" discussion={discussion} />
          ) : null
        }
      >
        <DraftsPanel discussion={discussion} />
        <DiscussionConversation discussion={discussion} />
        <ConversationComposer
          taskId={discussion.id}
          stage={DISCUSSION_STAGE}
          session={discussion}
        />
      </PanelLayout>
      <DiscussionDialogs discussion={discussion} />
    </section>
  );
}
