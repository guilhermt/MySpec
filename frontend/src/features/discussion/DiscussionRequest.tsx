import { useEffect, useRef, useState } from "react";
import { RequestBar } from "@/components/system/RequestBar";
import {
  type DiscussionRequestAction,
  discussionAnnouncement,
} from "@/features/discussion/discussion-request";
import { cardEntries, nextToDecide } from "@/features/discussion/drafts-card";
import { useDiscussionRequest } from "@/features/discussion/useDiscussionRequest";
import { RequestButtons } from "@/features/task/request-buttons";
import { useBornStatus } from "@/features/task/useBornStatus";
import { activeDraftId, currentDraftId, focusDraft, focusRequest } from "@/lib/focus";
import { DISCUSSION_STAGE, type DiscussionSummary } from "@/lib/wails";
import { retry } from "@/store/actions";
import { useAppStore, useFlashing } from "@/store/app-store";

export interface DiscussionRequestProps {
  discussion: DiscussionSummary;
}

/**
 * DiscussionRequest is the request bar of the discussion screen: what the discussion or its
 * conversation asks of the user, and the actions that resolve it.
 */
export function DiscussionRequest({ discussion }: DiscussionRequestProps) {
  const [running, setRunning] = useState<DiscussionRequestAction | null>(null);
  const flashing = useFlashing();
  const announce = useAppStore((state) => state.announce);
  const openDiscussionDialog = useAppStore((state) => state.openDiscussionDialog);
  const request = useDiscussionRequest(discussion);
  const situationId = request?.situationId ?? null;
  const status = useBornStatus(situationId, request?.status ?? "");

  // A situation born with the screen open is said once, with its round.
  const announced = useRef<string | null>(null);
  useEffect(() => {
    if (status !== "" && request !== null && situationId !== announced.current) {
      announced.current = situationId;
      announce(discussionAnnouncement(discussion, request));
    }
  }, [status, request, situationId, discussion, announce]);

  if (request === null) {
    return null;
  }

  const press = async (action: DiscussionRequestAction, stage: string | undefined) => {
    switch (action) {
      case "show":
        if (request.target === null) {
          focusRequest(request.focus);
        } else {
          focusDraft(request.target.draft, request.target.retry, true);
        }
        return;
      case "nextToDecide": {
        const id = nextToDecide(cardEntries(discussion), activeDraftId() ?? currentDraftId(), 1);
        if (id !== null) {
          focusDraft(id, false);
        }
        return;
      }
      case "archive":
        openDiscussionDialog(discussion.id, "archive");
        return;
      case "retrySession":
        setRunning(action);
        try {
          await retry(discussion.id, stage ?? DISCUSSION_STAGE);
        } finally {
          setRunning(null);
        }
        return;
    }
  };

  const flash =
    request.situationId !== null && flashing.has(request.situationId)
      ? request.glyph === "error"
        ? "error"
        : "wait"
      : undefined;

  return (
    <div className="shrink-0 px-(--space-6) pt-(--space-2)">
      <RequestBar
        form={request.form}
        glyph={request.glyph}
        label={request.label}
        status={status}
        {...(request.place !== undefined ? { place: request.place } : {})}
        {...(request.time !== undefined ? { time: request.time } : {})}
        {...(request.progress !== undefined ? { progress: request.progress } : {})}
        {...(request.progressTooltip !== undefined
          ? { progressTooltip: request.progressTooltip }
          : {})}
        {...(flash !== undefined ? { flash } : {})}
        actions={RequestButtons({
          buttons: request.actions,
          running,
          onPress: (button) => void press(button.action, button.stage),
        })}
      />
    </div>
  );
}
