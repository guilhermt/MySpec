import { useId, useState } from "react";
import { CutText } from "@/components/system/CutText";
import { Icon } from "@/components/system/Icon";
import { ICONS } from "@/components/system/icons";
import { Spinner } from "@/components/system/Spinner";
import { useNow } from "@/features/attention/useNow";
import { actionLabel, formatDuration } from "@/features/chat/actions";
import type { GroupModel } from "@/features/chat/conversation";
import { ActionRows } from "@/features/chat/entries/ActionRows";
import { Chevron } from "@/features/chat/entries/Chevron";
import { cn } from "@/lib/utils";
import { clockTime } from "@/lib/when";

// countOf is "14 actions", "1 action".
function countOf(count: number): string {
  return `${count} ${count === 1 ? "action" : "actions"}`;
}

// retriedOf is "retried on its own · 2 attempts", "" when no retry was folded in.
function retriedOf(attempts: number): string {
  if (attempts === 0) {
    return "";
  }
  return `retried on its own · ${attempts} ${attempts === 1 ? "attempt" : "attempts"}`;
}

// durationOf is the time of the group: from its start to now while one runs, from the first start to
// the last end after; null without the times.
function durationOf(group: GroupModel, now: number): string | null {
  if (group.running !== null) {
    const started = Date.parse(group.startedAt);
    return Number.isNaN(started) ? null : formatDuration(Math.max(now - started, 0));
  }
  return group.durationMs === null ? null : formatDuration(group.durationMs);
}

export interface GroupProps {
  taskId: string;
  stage: string;
  group: GroupModel;
  /** waitingToolUseId is the action the pending permission holds, null without one. */
  waitingToolUseId: string | null;
}

/**
 * Group is what the agent did between two things it said: one line, folded, that opens into its
 * commands. The line of a running group says what runs.
 */
export function Group({ taskId, stage, group, waitingToolUseId }: GroupProps) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const live = group.running !== null;
  const now = useNow(1000, live);
  const time = clockTime(group.startedAt, Date.now());
  const duration = durationOf(group, now);
  const retried = retriedOf(group.retried);
  const running = group.running === null ? null : actionLabel(group.running.action);
  const name =
    running === null
      ? [
          countOf(group.count),
          group.summary,
          ...group.notes.map((note) => note?.text ?? ""),
          retried,
          time === "" ? "" : `started ${time}`,
          duration ?? "",
        ]
          .filter((part) => part !== "")
          .join(", ")
      : `${countOf(group.count)}, running: ${running.label}`;

  return (
    // The line is the stop of the walk, with the state of the fold; the article holds the name.
    <article id={id} data-feed-entry aria-label={name} className="flex flex-col">
      <button
        type="button"
        data-feed-item
        data-feed-toggle
        tabIndex={-1}
        aria-expanded={open}
        aria-labelledby={id}
        onClick={() => setOpen(!open)}
        className="-mx-(--space-2) flex min-h-(--size-control-sm) min-w-0 items-center gap-(--space-2) rounded-sm px-(--space-2) text-left text-(length:--text-meta) leading-(--leading-meta) text-ink-3 outline-none transition-colors duration-(--duration-fast) ease-standard hover:bg-veil-hover active:bg-veil-press focus-visible:focus-ring"
      >
        <Chevron open={open} />
        <span
          className={cn(
            "shrink-0 font-medium whitespace-nowrap",
            live ? "text-ink-2" : "text-ink-3",
          )}
        >
          {countOf(group.count)}
        </span>
        {running === null ? (
          <span className="min-w-0 truncate text-ink-4">
            {group.summary}
            {group.notes.map(
              (note) =>
                note !== null && (
                  <span
                    key={note.text}
                    className={note.tone === "error" ? "text-state-error" : "text-ink-3"}
                  >
                    {` · ${note.text}`}
                  </span>
                ),
            )}
          </span>
        ) : (
          <span className="flex min-w-0 items-center gap-(--space-1-5)">
            <Spinner />
            <span className="shrink-0 truncate text-ink-2">{running.label}</span>
            {running.command !== "" && (
              <CutText
                text={running.command}
                className="font-mono text-(length:--text-micro) leading-(--leading-micro) text-ink-4 [font-variant-ligatures:none]"
              />
            )}
          </span>
        )}
        {retried !== "" && (
          <span className="inline-flex shrink-0 items-center gap-(--space-1) whitespace-nowrap text-ink-3">
            <Icon icon={ICONS.retry} size="xs" />
            {retried}
          </span>
        )}
        <span className="entry-time ml-auto shrink-0 text-(length:--text-micro) leading-(--leading-micro) text-ink-4 tabular-nums">
          {time}
        </span>
        {duration !== null && (
          <span className="shrink-0 text-(length:--text-micro) leading-(--leading-micro) whitespace-nowrap text-ink-4 tabular-nums">
            {duration}
          </span>
        )}
      </button>
      {open && (
        <div
          data-slot="group-block"
          className="mt-(--space-1) rounded-md bg-surface-0 px-(--space-2) py-(--space-1)"
        >
          <ActionRows
            taskId={taskId}
            stage={stage}
            nodes={group.nodes}
            waitingToolUseId={waitingToolUseId}
          />
        </div>
      )}
    </article>
  );
}
