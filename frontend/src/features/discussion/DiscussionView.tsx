import { type KeyboardEvent, useEffect, useMemo, useRef } from "react";
import { ArrivalFocus } from "@/components/ArrivalFocus";
import { PanelLayout } from "@/components/system/AuxPanel";
import { Conversation } from "@/features/chat/Conversation";
import { DiscussionComposer } from "@/features/discussion/DiscussionComposer";
import { DiscussionDetails } from "@/features/discussion/DiscussionDetails";
import { DiscussionDialogs } from "@/features/discussion/DiscussionDialogs";
import { DiscussionHeader } from "@/features/discussion/DiscussionHeader";
import { DiscussionRequest } from "@/features/discussion/DiscussionRequest";
import { DocumentsPanel } from "@/features/discussion/DocumentsPanel";
import { DraftsCard } from "@/features/discussion/DraftsCard";
import { discussionInputOf } from "@/features/discussion/discussion-request";
import { cardEntries, nextToDecide } from "@/features/discussion/drafts-card";
import { useDiscussionAnchors } from "@/features/discussion/useDiscussionAnchors";
import { useDiscussionRequest } from "@/features/discussion/useDiscussionRequest";
import { useFocusRescue } from "@/features/task/request-focus";
import { activeDraftId, currentDraftId, focusDraft } from "@/lib/focus";
import { modalOpen } from "@/lib/layers";
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
  const target = useDiscussionRequest(discussion)?.target ?? null;
  const card = useMemo(
    () =>
      cardEntries(discussion).length === 0 ? null : (
        <DraftsCard discussion={discussion} target={target} />
      ),
    [discussion, target],
  );
  const { after, before } = useDiscussionAnchors(discussion, card);
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
      endRoom
      pillAvoids="[data-current]"
    />
  );
}

// DiscussionArrival is the focus on arriving at a situation of the discussion, apart from
// DiscussionView so only it follows the clock of the request.
function DiscussionArrival({
  discussion,
  ready,
}: {
  discussion: DiscussionSummary;
  ready: boolean;
}) {
  const request = useDiscussionRequest(discussion);
  return <ArrivalFocus target={request?.focus ?? null} ready={ready} />;
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
  // A conversation that couldn't be read is settled too: the focus lands without it.
  const transcriptSettled = useAppStore((state) => {
    const status = state.transcripts[sessionKey(discussionId, DISCUSSION_STAGE)]?.status;
    return status === "ready" || status === "error";
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

  if (discussion === null) {
    return <section ref={rescue} className="min-h-0 flex-1 bg-surface-1" />;
  }

  // Alt+↓ and Alt+↑ go to the next and the previous draft to decide from anywhere on the screen,
  // the composer included, with no dialog open.
  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.defaultPrevented || modalOpen()) {
      return;
    }
    if (!event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
      return;
    }
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") {
      return;
    }
    const from = activeDraftId() ?? currentDraftId();
    const id = nextToDecide(cardEntries(discussion), from, event.key === "ArrowDown" ? 1 : -1);
    if (id !== null) {
      event.preventDefault();
      focusDraft(id, false);
    }
  };

  return (
    <section
      ref={rescue}
      aria-label={discussion.title}
      onKeyDown={onKeyDown}
      className="flex min-h-0 min-w-0 flex-1 flex-col bg-surface-1"
    >
      <DiscussionHeader discussion={discussion} />
      <DiscussionArrival discussion={discussion} ready={transcriptSettled} />
      <PanelLayout
        panel={
          panel === "details" ? (
            <DiscussionDetails key="details" discussion={discussion} />
          ) : panel === "documents" ? (
            <DocumentsPanel key="documents" discussion={discussion} />
          ) : null
        }
      >
        <DiscussionConversation discussion={discussion} />
        <DiscussionRequest discussion={discussion} />
        <DiscussionComposer discussion={discussion} />
      </PanelLayout>
      <DiscussionDialogs discussion={discussion} />
    </section>
  );
}
