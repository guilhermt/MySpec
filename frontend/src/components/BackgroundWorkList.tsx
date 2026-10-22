import { conversationName, runningLine } from "@/components/background-work";
import { Icon } from "@/components/system/Icon";
import { ICONS } from "@/components/system/icons";
import { useNow } from "@/features/attention/useNow";
import { asRunningKind, type RunningKind, type SessionTasks } from "@/lib/wails";
import { useDiscussion, useReview, useTask } from "@/store/app-store";

const KIND_ICONS = {
  agent: ICONS.subagent,
  command: ICONS.terminal,
  monitor: ICONS.woke,
} as const satisfies Record<RunningKind, unknown>;

export interface BackgroundWorkListProps {
  /** sessions are the conversations that run something, from endedBy or from the quit request. */
  sessions: readonly SessionTasks[];
  /** itemId is the item the conversations belong to, which names them. */
  itemId: string;
}

/**
 * BackgroundWorkList is what runs in the conversations a confirmation ends: one line per task, with
 * the glyph of its kind and how long it runs, and a subtitle per conversation when there is more
 * than one.
 */
export function BackgroundWorkList({ itemId, sessions }: BackgroundWorkListProps) {
  const task = useTask(itemId);
  const review = useReview(itemId);
  const discussion = useDiscussion(itemId);
  const item = task ?? review ?? discussion;
  const now = useNow(1000, true);
  const named = sessions.length > 1;
  return (
    <ul
      aria-label="What runs"
      className="m-0 flex list-none flex-col gap-(--space-2) rounded-md bg-surface-0 p-(--space-3)"
    >
      {sessions.map((session) => (
        <li key={session.stage} className="flex flex-col gap-(--space-1)">
          {named && (
            <span className="font-medium text-ink-1">{conversationName(item, session.stage)}</span>
          )}
          <ul
            aria-label={named ? conversationName(item, session.stage) : "Tasks"}
            className="m-0 flex list-none flex-col gap-(--space-1) p-0"
          >
            {(session.tasks ?? []).map((task) => (
              <li
                key={task.taskId}
                className="flex items-center gap-(--space-2) text-(length:--text-meta) leading-(--leading-meta) text-ink-2"
              >
                <Icon
                  icon={KIND_ICONS[asRunningKind(task.kind) ?? "command"]}
                  size="xs"
                  className="text-ink-3"
                />
                <span className="min-w-0 truncate">{runningLine(task, now)}</span>
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ul>
  );
}
