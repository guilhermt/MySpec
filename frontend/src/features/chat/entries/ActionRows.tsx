import { useLayoutEffect, useRef, useState } from "react";
import { Icon } from "@/components/system/Icon";
import { ICONS } from "@/components/system/icons";
import type { ActionNode } from "@/features/chat/conversation";
import { CommandRow } from "@/features/chat/entries/CommandRow";
import { SubagentRow } from "@/features/chat/entries/SubagentRow";
import { cn } from "@/lib/utils";

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
  // reveal is Show earlier having held the focus as it went: the first row it shows takes it,
  // before anything sees the focus fall to the body.
  const reveal = useRef(false);
  const listRef = useRef<HTMLUListElement>(null);
  const earlier = !all && nodes.length > ALL_ROWS ? nodes.length - SHOWN_ROWS : 0;

  useLayoutEffect(() => {
    if (!all || !reveal.current) {
      return;
    }
    reveal.current = false;
    const first = listRef.current?.firstElementChild;
    const row = first?.matches("[data-feed-item]")
      ? first
      : first?.querySelector("[data-feed-item]");
    if (row instanceof HTMLElement) {
      row.focus();
    }
  }, [all]);

  return (
    <ul ref={listRef} className={cn("flex flex-col divide-y divide-line-1", className)}>
      {earlier > 0 && (
        <li className="py-(--space-0-5) pl-[calc(var(--space-2)+var(--icon-xs)+var(--space-2))]">
          <button
            type="button"
            data-feed-item
            tabIndex={-1}
            onClick={(event) => {
              reveal.current = event.currentTarget === document.activeElement;
              setAll(true);
            }}
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
