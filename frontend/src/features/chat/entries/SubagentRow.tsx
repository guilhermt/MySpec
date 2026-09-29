import { useState } from "react";
import { Icon } from "@/components/system/Icon";
import { ICONS } from "@/components/system/icons";
import { useNow } from "@/features/attention/useNow";
import { actionLabel, actionRight, summaryOf } from "@/features/chat/actions";
import type { ActionNode } from "@/features/chat/conversation";
import { CommandOutput } from "@/features/chat/entries/CommandOutput";
import {
  Chevron,
  CommandRow,
  commandName,
  OUTPUT_INDENT,
  RIGHT_TONES,
  ROW_GRID,
} from "@/features/chat/entries/CommandRow";
import { cn } from "@/lib/utils";
import { asActionStatus } from "@/lib/wails";

/** ALL_ROWS is the most rows a list shows whole; above it, the last SHOWN_ROWS and the way to the others. */
const ALL_ROWS = 8;
const SHOWN_ROWS = 6;

// isSubagent says the node started a subagent: an Agent or a Task call.
function isSubagent(node: ActionNode): boolean {
  return node.action.tool === "Agent" || node.action.tool === "Task";
}

export interface ActionRowsProps {
  taskId: string;
  stage: string;
  nodes: readonly ActionNode[];
  /** waitingToolUseId is the action the pending permission holds, null without one. */
  waitingToolUseId: string | null;
  /** nested is the list of a subagent: a subagent in it is one of its commands. */
  nested?: boolean;
  className?: string;
}

/** ActionRows lists the commands of a group or a subagent: up to eight, else the last six and Show N earlier actions. */
export function ActionRows({
  taskId,
  stage,
  nodes,
  waitingToolUseId,
  nested = false,
  className,
}: ActionRowsProps) {
  const [all, setAll] = useState(false);
  const earlier = !all && nodes.length > ALL_ROWS ? nodes.length - SHOWN_ROWS : 0;

  return (
    <ul className={cn("flex flex-col divide-y divide-line-1", className)}>
      {earlier > 0 && (
        <li className="py-(--space-0-5) pl-[calc(var(--space-2)+var(--icon-xs)+var(--space-2))]">
          <button
            type="button"
            data-feed-item
            tabIndex={-1}
            onClick={() => setAll(true)}
            className="-ml-(--space-1-5) inline-flex h-(--size-control-xs) items-center gap-(--space-1-5) rounded-sm px-(--space-1-5) text-(length:--text-micro) leading-(--leading-micro) text-ink-3 outline-none hover:bg-veil-hover hover:text-ink-1 active:bg-veil-press focus-visible:focus-ring"
          >
            <Icon icon={ICONS.history} size="xs" />
            {`Show ${earlier} earlier actions`}
          </button>
        </li>
      )}
      {nodes
        .slice(earlier)
        .map((node) =>
          !nested && isSubagent(node) ? (
            <SubagentRow
              key={node.entry.id}
              taskId={taskId}
              stage={stage}
              node={node}
              waitingToolUseId={waitingToolUseId}
            />
          ) : (
            <CommandRow
              key={node.entry.id}
              taskId={taskId}
              stage={stage}
              entry={node.entry}
              action={node.action}
              waiting={node.action.toolUseId === waitingToolUseId}
            />
          ),
        )}
    </ul>
  );
}

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
    <li
      data-feed-item
      tabIndex={-1}
      aria-label={name}
      className="flex flex-col rounded-sm outline-none focus-visible:focus-ring"
    >
      <button
        type="button"
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
