import { useState } from "react";
import { Button } from "@/components/system/Button";
import { Tooltip } from "@/components/system/Tooltip";
import type { SessionState } from "@/features/chat/session";
import { asSessionStatus, type UserEntry } from "@/lib/wails";
import { removePending } from "@/store/actions";

export interface QueuedMessageProps {
  taskId: string;
  stage: string;
  entryId: string;
  user: UserEntry;
  /** session says when the queue is sent. */
  session: SessionState;
}

// sendsWhen is when the queue goes out: once the task resumes, after the retry, or as the turn ends.
function sendsWhen(session: SessionState): string {
  if (asSessionStatus(session.sessionStatus) === "paused") {
    return "sends when the task resumes";
  }
  return session.lastError !== "" ? "sends after the retry" : "sends when the turn ends";
}

/** QueuedMessage is a message that waits for the turn to end, and can still be taken back. */
export function QueuedMessage({ taskId, stage, entryId, user, session }: QueuedMessageProps) {
  const [removing, setRemoving] = useState(false);
  const when = sendsWhen(session);

  const remove = async () => {
    setRemoving(true);
    try {
      await removePending(taskId, stage, entryId);
    } finally {
      setRemoving(false);
    }
  };

  return (
    <article
      data-feed-item
      tabIndex={-1}
      aria-label={`You, queued, ${when}`}
      className="flex flex-col gap-(--space-1) rounded-lg bg-surface-0 px-(--space-4) py-(--space-3) outline-none focus-visible:focus-ring"
    >
      <div className="flex items-center justify-between gap-(--space-2) text-(length:--text-meta) leading-(--leading-meta)">
        <span className="text-ink-3">Queued · {when}</span>
        <Tooltip content="Remove the message from the queue">
          <Button
            variant="ghost"
            size="xs"
            loading={removing}
            loadingLabel="Removing…"
            onClick={() => void remove()}
          >
            Remove
          </Button>
        </Tooltip>
      </div>
      <p className="text-(length:--text-body) leading-(--leading-body) break-words whitespace-pre-wrap text-ink-2 select-text">
        {user.text}
      </p>
    </article>
  );
}
