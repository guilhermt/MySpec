import { Ban, Check, ChevronRight, Loader2, type LucideIcon, TriangleAlert, X } from "lucide-react";
import { useState } from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { type ActionEntry, type ActionStatus, asActionStatus } from "@/lib/wails";

const STATUS_ICON: Record<ActionStatus, LucideIcon> = {
  running: Loader2,
  done: Check,
  error: X,
  interrupted: Ban,
};

const STATUS_CLASS: Record<ActionStatus, string> = {
  running: "animate-spin",
  done: "text-[var(--status-success)]",
  error: "text-destructive",
  interrupted: "",
};

function summaryIcon(statuses: readonly ActionStatus[]): LucideIcon {
  if (statuses.includes("error")) {
    return TriangleAlert;
  }
  if (statuses.includes("interrupted")) {
    return Ban;
  }
  return Check;
}

export interface ActionGroupProps {
  /** actions are the consecutive tool calls of one turn, in order. */
  actions: readonly ActionEntry[];
}

/**
 * ActionGroup is what the agent did between two things it said: a single quiet
 * line that unfolds into the list of tool calls.
 */
export function ActionGroup({ actions }: ActionGroupProps) {
  const [open, setOpen] = useState(false);

  if (actions.length === 0) {
    return null;
  }
  const statuses = actions.map((action) => asActionStatus(action.status));
  const running = actions.find((action) => asActionStatus(action.status) === "running");
  const SummaryIcon = running === undefined ? summaryIcon(statuses) : Loader2;
  const spinning = running !== undefined;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex h-8 w-full items-center gap-1.5 rounded-md px-2 text-xs text-muted-foreground hover:bg-accent/50">
        <ChevronRight className={cn("size-3 shrink-0 transition-transform", open && "rotate-90")} />
        <SummaryIcon className={cn("size-3 shrink-0", spinning && "animate-spin")} />
        {running === undefined ? (
          <span>{actions.length === 1 ? "1 action" : `${actions.length} actions`}</span>
        ) : (
          <>
            <span className="shrink-0">{running.label}</span>
            <span className="truncate font-mono">{running.target}</span>
          </>
        )}
      </CollapsibleTrigger>
      <CollapsibleContent>
        <ul className="flex flex-col gap-0.5 py-1 pl-7">
          {actions.map((action) => {
            const status = asActionStatus(action.status);
            const StatusIcon = STATUS_ICON[status];
            return (
              <li
                key={action.toolUseId}
                className="flex items-center gap-1.5 text-xs text-muted-foreground"
              >
                <StatusIcon className={cn("size-3 shrink-0", STATUS_CLASS[status])} />
                <span className="shrink-0">{action.label}</span>
                <span className="truncate font-mono" title={action.target || undefined}>
                  {action.target}
                </span>
              </li>
            );
          })}
        </ul>
      </CollapsibleContent>
    </Collapsible>
  );
}
