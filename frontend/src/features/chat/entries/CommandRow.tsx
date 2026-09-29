import { type ReactElement, useState } from "react";
import { Icon } from "@/components/system/Icon";
import { ICONS } from "@/components/system/icons";
import { Spinner } from "@/components/system/Spinner";
import { Tooltip } from "@/components/system/Tooltip";
import { useNow } from "@/features/attention/useNow";
import { type ActionRight, actionLabel, actionRight } from "@/features/chat/actions";
import { Chevron } from "@/features/chat/entries/Chevron";
import { CommandOutput } from "@/features/chat/entries/CommandOutput";
import { cn } from "@/lib/utils";
import { type ActionEntry, type ActionStatus, asActionStatus, type Entry } from "@/lib/wails";

/** ROW_GRID is the grid of a row of the open group: chevron, state, label, command, right. */
export const ROW_GRID =
  "grid min-h-(--size-control) w-full grid-cols-[var(--icon-xs)_var(--icon-sm)_minmax(0,max-content)_minmax(0,1fr)_auto] items-center gap-x-(--space-2) rounded-sm px-(--space-2) text-left text-(length:--text-meta) leading-(--leading-meta) text-ink-2 outline-none focus-visible:focus-ring";

/** OUTPUT_INDENT puts the output under the label of its row. */
export const OUTPUT_INDENT =
  "mt-(--space-0-5) mb-(--space-1-5) ml-[calc(var(--space-2)+var(--icon-xs)+var(--space-2))]";

/** RIGHT_TONES are the colors of the right column of a row. */
export const RIGHT_TONES: Record<ActionRight["tone"], string> = {
  meta: "text-ink-4",
  error: "text-state-error",
  live: "text-ink-2",
  wait: "text-ink-2",
};

const LABEL_TONES: Record<ActionStatus, string> = {
  done: "",
  error: "text-state-error",
  running: "font-medium text-ink-1",
  interrupted: "text-ink-3",
};

// withTip gives the element the tooltip of the whole command, when there is one.
function withTip(tip: string, element: ReactElement): ReactElement {
  return tip === "" ? element : <Tooltip content={tip}>{element}</Tooltip>;
}

// StateIcon is the state of a command in the second column.
function StateIcon({ status, waiting }: { status: ActionStatus; waiting: boolean }) {
  if (waiting) {
    return <Icon icon={ICONS.waiting} size="xs" className="text-ink-4" />;
  }
  switch (status) {
    case "running":
      return <Spinner />;
    case "error":
      return <Icon icon={ICONS.close} size="xs" className="text-state-error" />;
    case "interrupted":
      return <Icon icon={ICONS.ban} size="xs" className="text-ink-4" />;
    case "done":
      return <Icon icon={ICONS.done} size="xs" className="text-ink-4" />;
  }
}

/** commandName is the accessible name of a command: "Run the tests: go test ./..., exit 1, 8.2s". */
export function commandName(
  action: ActionEntry,
  right: ActionRight | null,
  waiting: boolean,
): string {
  const label = actionLabel(action);
  const command = waiting ? "the command in the card below" : label.command;
  return [
    command === "" ? label.label : `${label.label}: ${command}`,
    right?.text.replaceAll(" · ", ", ") ?? "",
  ]
    .filter((part) => part !== "")
    .join(", ");
}

export interface CommandRowProps {
  taskId: string;
  stage: string;
  entry: Entry;
  action: ActionEntry;
  /** waiting says the action waits for the permission of the card below. */
  waiting: boolean;
}

/** CommandRow is one command of an open group, with the output it printed. */
export function CommandRow({ taskId, stage, entry, action, waiting }: CommandRowProps) {
  const status = asActionStatus(action.status);
  const now = useNow(1000, status === "running");
  // The CLI sends the output only at the end: a running command has none yet.
  const hasOutput = action.outputLines > 0 && status !== "running";
  const failed = status === "error" && hasOutput;
  const [open, setOpen] = useState(failed);
  // toggled is the user having opened or folded the output: a failure no longer opens it.
  const [toggled, setToggled] = useState(false);
  // A command that fails on screen opens its output once, as one that had failed would be.
  const [wasFailed, setWasFailed] = useState(failed);
  if (failed !== wasFailed) {
    setWasFailed(failed);
    if (failed && !toggled) {
      setOpen(true);
    }
  }
  const label = actionLabel(action);
  const right = actionRight(action, waiting, now);
  const name = commandName(action, right, waiting);

  const cells = (
    <>
      {hasOutput ? <Chevron open={open} /> : <span />}
      <span className="grid w-(--icon-sm) place-items-center">
        <StateIcon status={status} waiting={waiting} />
      </span>
      {withTip(
        label.mono ? label.tooltip : "",
        <span
          className={cn(
            "truncate",
            label.mono &&
              "font-mono text-(length:--text-micro) leading-(--leading-micro) [font-variant-ligatures:none]",
            LABEL_TONES[status],
          )}
        >
          {label.label}
        </span>,
      )}
      {waiting ? (
        <span className="truncate text-ink-3">the command in the card below</span>
      ) : (
        withTip(
          label.mono ? "" : label.tooltip,
          <span className="min-w-0 truncate font-mono text-(length:--text-micro) leading-(--leading-micro) text-ink-4 [font-variant-ligatures:none]">
            {label.command}
          </span>,
        )
      )}
      <span
        className={cn(
          "text-right text-(length:--text-micro) leading-(--leading-micro) whitespace-nowrap tabular-nums",
          right === null ? "" : RIGHT_TONES[right.tone],
        )}
      >
        {right?.text}
      </span>
    </>
  );

  if (!hasOutput) {
    return (
      <li
        data-feed-item
        tabIndex={-1}
        aria-label={name}
        className={cn(ROW_GRID, "hover:bg-veil-hover")}
      >
        {cells}
      </li>
    );
  }
  return (
    <li data-feed-entry className="flex flex-col">
      <button
        type="button"
        data-feed-item
        data-feed-toggle
        tabIndex={-1}
        aria-expanded={open}
        aria-label={`${name}, output`}
        onClick={() => {
          setToggled(true);
          setOpen(!open);
        }}
        className={cn(ROW_GRID, "hover:bg-veil-hover active:bg-veil-press")}
      >
        {cells}
      </button>
      {open && (
        <div className={OUTPUT_INDENT}>
          <CommandOutput
            taskId={taskId}
            stage={stage}
            entryId={entry.id}
            lines={action.outputLines}
            tail={action.outputTail}
            truncated={action.outputTruncated}
            failed={status === "error"}
          />
        </div>
      )}
    </li>
  );
}
