import { Button } from "@/components/system/Button";
import { Icon } from "@/components/system/Icon";
import { ICONS } from "@/components/system/icons";
import { Tooltip } from "@/components/system/Tooltip";
import { backTarget, earlierPlace } from "@/features/task/details";
import { leaveEarlierConversation } from "@/features/task/earlier-conversation";
import { screenSession } from "@/features/task/task-session";
import type { TaskSummary } from "@/lib/wails";
import { useOpenStepTab } from "@/store/app-store";

export interface EarlierConversationFootProps {
  task: TaskSummary;
  /** stage is the session of the earlier conversation on screen. */
  stage: string;
}

/**
 * FOOT is the strip in the conversation column, centered on a whole pixel, at least --size-ask high,
 * on the quiet ground of the request bar.
 */
const FOOT =
  "flex min-h-(--size-ask) w-full max-w-(--measure-conversation) ml-[max(0px,round(down,calc((100%_-_var(--measure-conversation))/2),1px))] items-center gap-(--space-3) rounded-md bg-surface-0 py-(--space-1-5) pr-(--space-1-5) pl-(--space-4) text-(length:--text-meta) leading-(--leading-meta) text-ink-3";

/**
 * EarlierConversationFoot takes the place of the composer while an earlier conversation is read: what
 * it is, that it takes no more messages, and the one way back to where the task is.
 */
export function EarlierConversationFoot({ task, stage }: EarlierConversationFootProps) {
  const tab = useOpenStepTab(task.id);
  const back = backTarget(task, screenSession(task, tab)?.stage ?? null);

  return (
    <div className="shrink-0 p-(--space-3)">
      <div className={FOOT}>
        <p className="flex min-w-0 flex-1 items-center gap-(--space-2)">
          <Icon icon={ICONS.history} />
          <span className="min-w-0 truncate">
            <span className="font-semibold text-ink-1">{earlierPlace(task, stage)}</span>
            {" · an earlier conversation. It takes no more messages."}
          </span>
        </p>
        <Tooltip content="Back to where the task is" shortcut="Esc">
          <Button variant="secondary" size="sm" onClick={() => leaveEarlierConversation()}>
            {`Back to ${back}`}
          </Button>
        </Tooltip>
      </div>
    </div>
  );
}
