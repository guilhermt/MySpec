import { useEffect } from "react";
import { AuxPanel, PanelLayout } from "@/components/system/AuxPanel";
import { Conversation } from "@/features/chat/Conversation";
import { ConversationComposer } from "@/features/chat/ConversationComposer";
import { DiscussionBar } from "@/features/discussion/DiscussionBar";
import { DiscussionHeader } from "@/features/discussion/DiscussionHeader";
import { DocumentsPanel } from "@/features/discussion/DocumentsPanel";
import { DraftsPanel } from "@/features/discussion/DraftsPanel";
import { DISCUSSION_STAGE, sessionKey } from "@/lib/wails";
import { loadTranscript } from "@/store/actions";
import { useAppStore, useDiscussion, usePanel } from "@/store/app-store";

export interface DiscussionViewProps {
  discussionId: string;
}

/** DiscussionView is the screen of one discussion: the conversation and the documents. */
export function DiscussionView({ discussionId }: DiscussionViewProps) {
  const discussion = useDiscussion(discussionId);
  const panel = usePanel();
  const openPanel = useAppStore((state) => state.openPanel);

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
    return <section className="min-h-0 flex-1 bg-background" />;
  }

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col bg-background">
      <DiscussionHeader discussion={discussion} />
      <DiscussionBar discussion={discussion} />
      <PanelLayout
        panel={
          panel === "documents" && (
            <AuxPanel id="documents" title="Documents" onClose={() => openPanel(null)}>
              <DocumentsPanel discussion={discussion} />
            </AuxPanel>
          )
        }
      >
        <DraftsPanel discussion={discussion} />
        <Conversation taskId={discussion.id} stage={DISCUSSION_STAGE} session={discussion} />
        <ConversationComposer
          taskId={discussion.id}
          stage={DISCUSSION_STAGE}
          session={discussion}
        />
      </PanelLayout>
    </section>
  );
}
