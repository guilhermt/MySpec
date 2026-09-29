import { useState } from "react";
import { Icon } from "@/components/system/Icon";
import { ICONS } from "@/components/system/icons";
import { useNow } from "@/features/attention/useNow";
import { actionLabel, actionRight, summaryOf } from "@/features/chat/actions";
import type { ActionNode } from "@/features/chat/conversation";
import { ActionRows } from "@/features/chat/entries/ActionRows";
import { Chevron } from "@/features/chat/entries/Chevron";
import { CommandOutput } from "@/features/chat/entries/CommandOutput";
import {
  commandName,
  OUTPUT_INDENT,
  RIGHT_TONES,
  ROW_GRID,
} from "@/features/chat/entries/CommandRow";
import { cn } from "@/lib/utils";
import { asActionStatus } from "@/lib/wails";

// subagentSummary is "44 actions · Read 21 · Searched 14 · GitHub 9", "" without actions.
function subagentSummary(node: ActionNode): string {
  const count = node.children.length;
  if (count === 0) {
    return "";
  }
  const actions = node.children.map((child) => child.action);
  return [`${count} ${count === 1 ? "action" : "actions"}`, summaryOf(actions)].join(" · ");
}

export interface SubagentRowProps {
  taskId: string;
  stage: string;
  node: ActionNode;
  waitingToolUseId: string | null;
}

/** SubagentRow is a subagent the agent delegated to: folded, its commands and its report open. */
export function SubagentRow({ taskId, stage, node, waitingToolUseId }: SubagentRowProps) {
  const [open, setOpen] = useState(false);
  const { action } = node;
  const status = asActionStatus(action.status);
  const now = useNow(1000, status === "running");
  const right = actionRight(action, false, now);
  const summary = subagentSummary(node);
  const hasReport = action.outputLines > 0 && status !== "running";
  const opens = node.children.length > 0 || hasReport;
  const name = [commandName(action, right, false), summary]
    .filter((part) => part !== "")
    .join(", ");

  const cells = (
    <>
      {opens ? <Chevron open={open} /> : <span />}
      <span className="grid w-(--icon-sm) place-items-center">
        <Icon icon={ICONS.subagent} size="xs" className="text-ink-4" />
      </span>
      <span className={cn("truncate", status === "error" && "text-state-error")}>
        {actionLabel(action).label}
      </span>
      <span className="min-w-0 truncate text-(length:--text-micro) leading-(--leading-micro) text-ink-3">
        {summary}
      </span>
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

  if (!opens) {
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
        aria-label={name}
        onClick={() => setOpen(!open)}
        className={cn(ROW_GRID, "hover:bg-veil-hover active:bg-veil-press")}
      >
        {cells}
      </button>
      {open && (
        <div className="mb-(--space-1) ml-[calc(var(--space-2)+var(--icon-xs)+var(--space-2)+var(--icon-sm)/2)] flex flex-col pl-(--space-3) shadow-[inset_var(--border)_0_0_var(--line-2)]">
          {node.children.length > 0 && (
            <ActionRows
              taskId={taskId}
              stage={stage}
              nodes={node.children}
              waitingToolUseId={waitingToolUseId}
              nested
            />
          )}
          {hasReport && (
            <div className={OUTPUT_INDENT}>
              <CommandOutput
                taskId={taskId}
                stage={stage}
                entryId={node.entry.id}
                lines={action.outputLines}
                tail={action.outputTail}
                truncated={action.outputTruncated}
                failed={status === "error"}
              />
            </div>
          )}
        </div>
      )}
    </li>
  );
}
