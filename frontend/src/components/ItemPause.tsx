import { useState } from "react";
import { endedBy, hasSubagent } from "@/components/background-work";
import { PauseButton } from "@/components/PauseButton";
import { StopBackgroundDialog } from "@/components/StopBackgroundDialog";
import { asSessionStatus, type SessionTasks } from "@/lib/wails";
import { clockTime } from "@/lib/when";
import { pause, pauseInPlace, resume } from "@/store/actions";

/** PausableSession is the part of a session Pause needs: which one it is, its state and since when it is paused. */
export interface PausableSession {
  /** stage is the session stage: prd, step:<n>, pr, review… */
  stage: string;
  sessionStatus: string;
  /** pausedAt is when the session was paused, ISO; "" when it isn't or it is unknown. */
  pausedAt: string;
}

export interface ItemPauseProps<S extends PausableSession> {
  /** id is the item whose session it pauses. */
  id: string;
  /** item is what it pauses, named in the tooltip and the description: "the task", "the review". */
  item: string;
  /** session is the conversation the item waits on; null without one, which draws nothing. */
  session: S | null;
  /** refusal is why the session can't be paused, null when it can; asked only while it isn't paused. */
  refusal: (session: S) => string | null;
  /** running is what runs in the conversations of the item; a subagent among it asks before the pause. */
  running: readonly SessionTasks[] | null;
  now: number;
}

/**
 * ItemPause pauses or resumes the conversation an item waits on: Pausing… until the call comes
 * back. With a subagent running in the conversation, Pause asks first, because what runs does not
 * resume.
 */
export function ItemPause<S extends PausableSession>({
  id,
  item,
  session,
  refusal,
  running,
  now,
}: ItemPauseProps<S>) {
  const [loading, setLoading] = useState(false);
  const [asking, setAsking] = useState(false);
  if (session === null) {
    return null;
  }
  const paused = asSessionStatus(session.sessionStatus) === "paused";
  const reason = paused ? null : refusal(session);

  const ended = endedBy({ kind: "pause", stage: session.stage }, { running });

  const act = async () => {
    setLoading(true);
    try {
      await (paused ? resume(id, session.stage) : pause(id, session.stage));
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <PauseButton
        paused={paused}
        loading={loading}
        {...(reason !== null ? { disabledReason: reason } : {})}
        pausedSince={session.pausedAt === "" ? "" : clockTime(session.pausedAt, now)}
        item={item}
        onClick={() => (!paused && hasSubagent(ended) ? setAsking(true) : void act())}
      />
      <StopBackgroundDialog
        open={asking}
        onOpenChange={setAsking}
        verb="pause"
        itemId={id}
        sessions={ended}
        onConfirm={() => pauseInPlace(id, session.stage)}
      />
    </>
  );
}
