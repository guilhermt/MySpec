import { useEffect, useRef, useState } from "react";
import { summaryOfRunning } from "@/components/background-work";
import { Button } from "@/components/system/Button";
import { Icon } from "@/components/system/Icon";
import { ICONS } from "@/components/system/icons";
import { LiveRegion } from "@/components/system/LiveRegion";
import { useNow } from "@/features/attention/useNow";
import { formatDuration } from "@/features/chat/actions";
import { COLUMN_CLASS } from "@/features/chat/ConversationColumn";
import { LiveOutput } from "@/features/chat/entries/LiveOutput";
import { shortAction } from "@/features/sidebar/sidebar-tree";
import { cn } from "@/lib/utils";
import { asRunningKind, type RunningKind, type RunningTask } from "@/lib/wails";
import { stopTasksInPlace } from "@/store/actions";
import { useAppStore } from "@/store/app-store";

const KIND_ICONS = {
  agent: ICONS.subagent,
  command: ICONS.terminal,
  monitor: ICONS.woke,
} as const;

// ALL is the scope of a failed stop of every task of the list.
const ALL = "*";

const TEXT = "text-(length:--text-meta) leading-(--leading-meta)";

// kindOf is the kind of a task; a kind this version does not know is told as a command.
function kindOf(task: RunningTask): RunningKind {
  return asRunningKind(task.kind) ?? "command";
}

// progressOf is what a subagent does now: its actions and the last one, or that it thinks.
function progressOf(task: RunningTask): string {
  if (task.actionLabel === "") {
    return "Thinking…";
  }
  const count = `${task.actions} ${task.actions === 1 ? "action" : "actions"}`;
  return `${count} · ${task.actionLabel} ${shortAction(task.actionLabel, task.actionTarget)}`;
}

// announcementOf tells what entered and what left between two renderings, by task id.
function announcementOf(before: readonly RunningTask[], after: readonly RunningTask[]): string {
  const told = (task: RunningTask) => {
    const kind = kindOf(task);
    return `${kind.charAt(0).toUpperCase()}${kind.slice(1)} "${task.name}"`;
  };
  const ids = (tasks: readonly RunningTask[]) => new Set(tasks.map((task) => task.taskId));
  const was = ids(before);
  const is = ids(after);
  return [
    ...after
      .filter((task) => !was.has(task.taskId))
      .map((task) => `${told(task)} started in the background.`),
    ...before.filter((task) => !is.has(task.taskId)).map((task) => `${told(task)} ended.`),
  ].join(" ");
}

interface TaskItemProps {
  itemId: string;
  stage: string;
  task: RunningTask;
  now: number;
  stopping: boolean;
  outputOpen: boolean;
  /** failure is why the call to stop it failed, "" when it did not. */
  failure: string;
  onStop: (task: RunningTask) => void;
  onToggleOutput: (task: RunningTask) => void;
}

function TaskItem({
  itemId,
  stage,
  task,
  now,
  stopping,
  outputOpen,
  failure,
  onStop,
  onToggleOutput,
}: TaskItemProps) {
  const openSubagentConversation = useAppStore((state) => state.openSubagentConversation);
  const kind = kindOf(task);
  const isAgent = kind === "agent";
  const started = Date.parse(task.startedAt);
  const name = `${kind} "${task.name}"`;
  const itemClick = () => {
    if (isAgent) {
      openSubagentConversation({ itemId, stage, toolUseId: task.toolUseId, offset: null });
    } else {
      onToggleOutput(task);
    }
  };
  return (
    <li>
      <div className="flex min-h-(--size-control) items-center gap-(--space-2) pr-(--space-1-5)">
        <button
          type="button"
          aria-label={isAgent ? `Open the conversation of ${task.name}` : `Output of ${name}`}
          {...(isAgent ? {} : { "aria-expanded": outputOpen })}
          onClick={itemClick}
          className={cn(
            "flex min-h-(--size-control) min-w-0 flex-1 items-center gap-(--space-2) rounded-sm px-(--space-2) text-left outline-none hover:bg-veil-hover focus-visible:focus-ring",
            TEXT,
          )}
        >
          <Icon icon={KIND_ICONS[kind]} size="xs" className="text-ink-3" />
          <span className="shrink-0 text-ink-3">{kind}</span>
          <span className="min-w-0 truncate text-ink-1">{task.name}</span>
          {isAgent && <span className="min-w-0 truncate text-ink-3">{progressOf(task)}</span>}
        </button>
        <span aria-hidden="true" className={cn(TEXT, "shrink-0 tabular-nums text-ink-3")}>
          {Number.isNaN(started) ? "" : formatDuration(Math.max(now - started, 0))}
        </span>
        <Button
          variant="secondary"
          size="xs"
          aria-label={`Stop ${name}`}
          {...(stopping ? { disabled: true } : {})}
          onClick={() => onStop(task)}
        >
          {stopping ? "Stopping…" : "Stop"}
        </Button>
      </div>
      {outputOpen && !isAgent && task.taskId !== "" && (
        <div className="mb-(--space-1-5) ml-(--space-8) mr-(--space-2)">
          <LiveOutput itemId={itemId} stage={stage} taskId={task.taskId} />
        </div>
      )}
      <LiveRegion kind="alert" as="div" className="empty:hidden">
        {(task.stopError !== "" || failure !== "") && (
          <p className={cn(TEXT, "px-(--space-2) pb-(--space-1) text-state-error")}>
            {`Couldn't stop it · ${task.stopError !== "" ? task.stopError : failure}`}
          </p>
        )}
      </LiveRegion>
    </li>
  );
}

export interface BackgroundWorkProps {
  itemId: string;
  stage: string;
  /** tasks is what runs in the background in this conversation, from backgroundOf. */
  tasks: RunningTask[];
}

/**
 * BackgroundWork is the line above the composer that tells what runs in the background in the
 * conversation, and opens in place into the list of it: each task, its stop, and the stop of all.
 * It is not there when nothing runs; only its announcements are.
 */
export function BackgroundWork({ itemId, stage, tasks }: BackgroundWorkProps) {
  const [open, setOpen] = useState(false);
  const [outputs, setOutputs] = useState<ReadonlySet<string>>(new Set());
  const [requested, setRequested] = useState<ReadonlySet<string>>(new Set());
  const [failure, setFailure] = useState<{ scope: string; reason: string } | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const now = useNow(1000, open && tasks.length > 0);
  const previous = useRef({ key: `${itemId}:${stage}`, tasks });
  const focusInside = useRef(false);
  const count = tasks.length;

  // What entered and what left, told once. Another conversation is no change of this one.
  useEffect(() => {
    const key = `${itemId}:${stage}`;
    const before = previous.current;
    previous.current = { key, tasks };
    if (before.key !== key) {
      setAnnouncement("");
      return;
    }
    const told = announcementOf(before.tasks, tasks);
    if (told !== "") {
      setAnnouncement(told);
    }
    if (before.tasks.length > 0 && tasks.length === 0) {
      // The last one left: a focus that was in the line or the list goes to the composer.
      if (focusInside.current) {
        document.querySelector<HTMLElement>('[data-slot="composer"] textarea')?.focus();
      }
      focusInside.current = false;
      setOpen(false);
      setOutputs(new Set());
    }
  }, [itemId, stage, tasks]);

  // stop asks for the stop of tasks; a call that fails is told where the click was: under the item
  // of one, at the foot of the list for all of them.
  const stop = async (ids: string[], scope: string) => {
    setFailure(null);
    setRequested((was) => new Set([...was, ...ids]));
    const reason = await stopTasksInPlace(itemId, stage, ids);
    if (reason !== null) {
      setFailure({ scope, reason });
    }
    setRequested((was) => new Set([...was].filter((id) => !ids.includes(id))));
  };
  const toggleOutput = (task: RunningTask) =>
    setOutputs((was) => {
      const next = new Set(was);
      if (!next.delete(task.taskId)) {
        next.add(task.taskId);
      }
      return next;
    });
  const isStopping = (task: RunningTask) => task.stopping || requested.has(task.taskId);

  const summary = summaryOfRunning(tasks);
  const kinds = summary.replaceAll(" · ", ", ");
  return (
    <>
      {count > 0 && (
        <div
          className="shrink-0 px-(--space-6) pt-(--space-2)"
          onFocusCapture={() => {
            focusInside.current = true;
          }}
          onBlurCapture={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) {
              focusInside.current = false;
            }
          }}
        >
          <div className={COLUMN_CLASS}>
            <button
              type="button"
              aria-expanded={open}
              aria-label={`Background work: ${kinds}. ${open ? "Hide" : "Show"} the list`}
              onClick={() => setOpen((was) => !was)}
              className={cn(
                "flex h-(--size-control-sm) w-full items-center gap-(--space-2) rounded-sm px-(--space-2) text-left outline-none hover:bg-veil-hover focus-visible:focus-ring",
                TEXT,
              )}
            >
              <Icon icon={open ? ICONS.expanded : ICONS.chevron} size="xs" className="text-ink-4" />
              <Icon icon={ICONS.background} size="xs" className="text-ink-4" />
              <span className="font-medium text-ink-2">Background</span>
              <span className="min-w-0 truncate text-ink-3">{`· ${summary}`}</span>
            </button>
            {open && (
              <div className="rounded-md bg-surface-0 py-(--space-1)">
                <ul aria-label="Background work">
                  {tasks.map((task) => (
                    <TaskItem
                      key={task.taskId}
                      itemId={itemId}
                      stage={stage}
                      task={task}
                      now={now}
                      stopping={isStopping(task)}
                      outputOpen={outputs.has(task.taskId)}
                      failure={failure?.scope === task.taskId ? failure.reason : ""}
                      onStop={(one) => void stop([one.taskId], one.taskId)}
                      onToggleOutput={toggleOutput}
                    />
                  ))}
                </ul>
                <div className="flex items-center justify-end gap-(--space-2) px-(--space-1-5) pt-(--space-1)">
                  <LiveRegion kind="alert" as="div" className="empty:hidden">
                    {failure?.scope === ALL && (
                      <p className={cn(TEXT, "text-state-error")}>
                        {`Couldn't stop it · ${failure.reason}`}
                      </p>
                    )}
                  </LiveRegion>
                  <Button
                    variant="secondary"
                    size="xs"
                    {...(tasks.some(isStopping) ? { disabled: true } : {})}
                    onClick={() =>
                      void stop(
                        tasks.map((task) => task.taskId),
                        ALL,
                      )
                    }
                  >
                    {tasks.some(isStopping) ? "Stopping…" : "Stop all"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      <LiveRegion kind="status" as="div" className="sr-only">
        {announcement}
      </LiveRegion>
    </>
  );
}
