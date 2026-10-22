import { useState } from "react";
import { Button } from "@/components/system/Button";
import { Icon } from "@/components/system/Icon";
import { ICONS } from "@/components/system/icons";
import { LiveRegion } from "@/components/system/LiveRegion";
import { Tooltip } from "@/components/system/Tooltip";
import { useNow } from "@/features/attention/useNow";
import { voiceInSentence } from "@/features/chat/markers";
import { type SubagentStatus, subagentStatusText } from "@/features/chat/subagent";
import { leaveSubagentConversation } from "@/features/chat/subagent-conversation";
import { stopTasksInPlace } from "@/store/actions";
import { useRunningTask } from "@/store/app-store";

/**
 * FOOT is the strip in the conversation column, centered on a whole pixel, at least --size-ask high,
 * on the quiet ground of the request bar.
 */
const FOOT =
  "flex min-h-(--size-ask) w-full max-w-(--measure-conversation) ml-[max(0px,round(down,calc((100%_-_var(--measure-conversation))/2),1px))] items-center gap-(--space-3) rounded-md bg-surface-0 py-(--space-1-5) pr-(--space-1-5) pl-(--space-4) text-(length:--text-meta) leading-(--leading-meta) text-ink-3";

export interface SubagentFootProps {
  itemId: string;
  stage: string;
  toolUseId: string;
  name: string;
  status: SubagentStatus;
  /** startedAt is when the call began, RFC 3339; "" when unknown. */
  startedAt: string;
  /** voice is the agent of the conversation the subagent came from. */
  voice: string;
  /** sessionOpen says the session of the conversation can be told to stop a task. */
  sessionOpen: boolean;
}

/**
 * SubagentFoot takes the place of the composer while a subagent is read: what it is and how it
 * stands, that it takes no messages, the Stop of its task and the one way back to the conversation
 * it came from.
 */
export function SubagentFoot({
  itemId,
  stage,
  toolUseId,
  name,
  status,
  startedAt,
  voice,
  sessionOpen,
}: SubagentFootProps) {
  const running = status === "running";
  const now = useNow(1000, running);
  const task = useRunningTask(itemId, stage, toolUseId);
  const [stopRequested, setStopRequested] = useState(false);
  const stopping = stopRequested || task?.stopping === true;
  const stopError = task?.stopError ?? "";
  const stoppable = running && sessionOpen && task !== null;

  const stop = async () => {
    if (task === null) {
      return;
    }
    setStopRequested(true);
    await stopTasksInPlace(itemId, stage, [task.taskId]);
    setStopRequested(false);
  };

  return (
    <div className="shrink-0 px-(--space-6) py-(--space-3)">
      <div className={FOOT}>
        <p className="flex min-w-0 flex-1 items-center gap-(--space-2)">
          <Icon icon={ICONS.subagent} />
          <span className="min-w-0 truncate">
            <span className="font-semibold text-ink-1">{name}</span>
            {` · ${subagentStatusText(status, startedAt, now)}`}
          </span>
        </p>
        {stoppable && (
          <Button
            variant="secondary"
            size="sm"
            {...(stopping ? { disabled: true } : {})}
            onClick={() => void stop()}
          >
            {stopping ? "Stopping…" : "Stop"}
          </Button>
        )}
        <Tooltip content={`Back to the ${voiceInSentence(voice)}`} shortcut="Esc">
          <Button variant="secondary" size="sm" onClick={() => leaveSubagentConversation()}>
            Back to the conversation
          </Button>
        </Tooltip>
      </div>
      <LiveRegion kind="alert" as="div" className="empty:hidden">
        {stopError !== "" && (
          <p className="mt-(--space-1) text-(length:--text-meta) leading-(--leading-meta) text-state-error">
            {`Couldn't stop it · ${stopError}`}
          </p>
        )}
      </LiveRegion>
    </div>
  );
}
