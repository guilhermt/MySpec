import { CircleCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { issueLabel } from "@/lib/boards";
import { asIssueState, type TaskCard } from "@/lib/wails";
import { openExternal } from "@/store/actions";

export interface TaskCardBadgeProps {
  card: TaskCard;
}

/**
 * TaskCardBadge is the card a task was created from, as the last reading saw
 * it: its number, which opens the issue, its status and whether it was closed.
 */
export function TaskCardBadge({ card }: TaskCardBadgeProps) {
  return (
    <>
      <Tooltip>
        <TooltipTrigger
          render={<Button variant="link" size="xs" className="h-auto px-0 tabular-nums" />}
          onClick={() => void openExternal(card.url)}
        >
          {issueLabel(card)}
        </TooltipTrigger>
        <TooltipContent>{card.title}</TooltipContent>
      </Tooltip>
      {card.status !== "" && <Badge variant="outline">{card.status}</Badge>}
      {asIssueState(card.state) === "closed" && (
        <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
          <CircleCheck aria-hidden="true" className="size-3.5" />
          Issue closed
        </span>
      )}
    </>
  );
}
