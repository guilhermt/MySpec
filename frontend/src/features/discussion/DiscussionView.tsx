import { useCallback, useEffect, useState } from "react";
import { useDefaultLayout, usePanelRef } from "react-resizable-panels";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { Composer } from "@/features/chat/Composer";
import { Conversation } from "@/features/chat/Conversation";
import { DiscussionBar } from "@/features/discussion/DiscussionBar";
import { DiscussionHeader } from "@/features/discussion/DiscussionHeader";
import { DocumentsPanel } from "@/features/discussion/DocumentsPanel";
import { DraftsPanel } from "@/features/discussion/DraftsPanel";
import { DISCUSSION_STAGE, sessionKey } from "@/lib/wails";
import { loadTranscript } from "@/store/actions";
import { useAppStore, useDiscussion } from "@/store/app-store";

const CONVERSATION_PANEL = "conversation";
const DOCUMENTS_PANEL = "documents";

const PANEL_IDS = [CONVERSATION_PANEL, DOCUMENTS_PANEL];

export interface DiscussionViewProps {
  discussionId: string;
}

/** DiscussionView is the screen of one discussion: the conversation and the documents. */
export function DiscussionView({ discussionId }: DiscussionViewProps) {
  const discussion = useDiscussion(discussionId);
  const panelRef = usePanelRef();
  const [documentsOpen, setDocumentsOpen] = useState(false);
  const { defaultLayout, onLayoutChanged } = useDefaultLayout({
    id: `myspec.discussion-panels:${discussionId}`,
    panelIds: PANEL_IDS,
  });

  // The conversation is fetched once and then kept: leaving the discussion and
  // coming back costs nothing, and the events keep being applied while it is
  // away.
  useEffect(() => {
    const key = sessionKey(discussionId, DISCUSSION_STAGE);
    if (useAppStore.getState().transcripts[key] === undefined) {
      void loadTranscript(discussionId, DISCUSSION_STAGE);
    }
  }, [discussionId]);

  const toggleDocuments = useCallback(() => {
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

  if (discussion === null) {
    return <section className="h-dvh bg-background" />;
  }

  return (
    <section className="flex h-dvh min-w-0 flex-col bg-background">
      <DiscussionHeader
        discussion={discussion}
        documentsOpen={documentsOpen}
        onToggleDocuments={toggleDocuments}
      />
      <DiscussionBar discussion={discussion} />
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
          <DraftsPanel discussion={discussion} />
          <Conversation taskId={discussion.id} stage={DISCUSSION_STAGE} session={discussion} />
          <Composer taskId={discussion.id} stage={DISCUSSION_STAGE} session={discussion} />
        </ResizablePanel>
        <ResizableHandle />
        <ResizablePanel
          id={DOCUMENTS_PANEL}
          panelRef={panelRef}
          defaultSize="40%"
          minSize="25%"
          collapsible
          collapsedSize="0%"
          onResize={(size) => setDocumentsOpen(size.asPercentage > 0)}
        >
          <DocumentsPanel discussion={discussion} />
        </ResizablePanel>
      </ResizablePanelGroup>
    </section>
  );
}
