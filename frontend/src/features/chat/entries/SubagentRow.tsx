import { useState } from "react";
import { Icon } from "@/components/system/Icon";
import { IconButton } from "@/components/system/IconButton";
import { ICONS } from "@/components/system/icons";
import { Spinner } from "@/components/system/Spinner";
import { useNow } from "@/features/attention/useNow";
import { actionLabel, actionRight, progressOf, summaryOf } from "@/features/chat/actions";
import { conversationViewport } from "@/features/chat/ConversationColumn";
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
import { useAppStore } from "@/store/app-store";

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
  const openSubagentConversation = useAppStore((state) => state.openSubagentConversation);
  const { action } = node;
  const status = asActionStatus(action.status);
  const now = useNow(1000, status === "running");
  const right = actionRight(action, false, now);
  const live = status === "running";
  const progress = progressOf(node.children.map((child) => child.action));
  // A subagent that works shows how far it is and what it does; a finished one, what it did.
  const summary = live
    ? [progress.count, progress.doing].filter((part) => part !== "").join(" · ")
    : subagentSummary(node);
  const hasReport = action.outputLines > 0 && status !== "running";
  const opens = node.children.length > 0 || hasReport;
  const name = [commandName(action, right, false), summary]
    .filter((part) => part !== "")
    .join(", ");
  const who = action.description || action.target || "the subagent";

  // The row goes back to where it was when the conversation of the subagent is left.
  const openConversation = (button: HTMLElement) => {
    const row = button.closest("li");
    const viewport = conversationViewport(button);
    const offset =
      row === null || viewport === null
        ? null
        : row.getBoundingClientRect().top - viewport.getBoundingClientRect().top;
    openSubagentConversation({ itemId: taskId, stage, toolUseId: action.toolUseId, offset });
  };

  const conversation = (
    <IconButton
      size="xs"
      icon={ICONS.conversation}
      label={`Open the conversation of ${who}`}
      tooltip="Open conversation"
      data-feed-item
      data-open-conversation
      tabIndex={-1}
      className="shrink-0"
      onClick={(event) => openConversation(event.currentTarget)}
    />
  );

  const cells = (
    <>
      {opens ? <Chevron open={open} /> : <span />}
      <span className="grid w-(--icon-sm) place-items-center">
        <Icon icon={ICONS.subagent} size="xs" className="text-ink-4" />
      </span>
      <span className={cn("truncate", status === "error" && "text-state-error")}>
        {actionLabel(action).label}
      </span>
      <span className="flex min-w-0 items-center gap-(--space-1-5) text-(length:--text-micro) leading-(--leading-micro) text-ink-3">
        {live ? (
          <>
            {progress.count !== "" && <span className="shrink-0">{progress.count} ·</span>}
            {progress.acting && <Spinner />}
            <span className="truncate">{progress.doing}</span>
          </>
        ) : (
          <span className="truncate">{summary}</span>
        )}
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
        data-subagent={action.toolUseId}
        tabIndex={-1}
        aria-label={name}
        className="flex items-center gap-(--space-1)"
      >
        <div className={cn(ROW_GRID, "min-w-0 flex-1 hover:bg-veil-hover")}>{cells}</div>
        {conversation}
      </li>
    );
  }
  return (
    <li data-feed-entry data-subagent={action.toolUseId} className="flex flex-col">
      <div className="flex items-center gap-(--space-1)">
        <button
          type="button"
          data-feed-item
          data-feed-toggle
          tabIndex={-1}
          aria-expanded={open}
          aria-label={name}
          onClick={() => setOpen(!open)}
          className={cn(ROW_GRID, "min-w-0 flex-1 hover:bg-veil-hover active:bg-veil-press")}
        >
          {cells}
        </button>
        {conversation}
      </div>
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
