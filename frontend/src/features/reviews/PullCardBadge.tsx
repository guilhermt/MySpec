import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { issueLabel } from "@/lib/boards";
import type { PullCard } from "@/lib/wails";
import { openExternal } from "@/store/actions";

export interface PullCardBadgeProps {
  card: PullCard;
}

/**
 * PullCardBadge is the card a pull request is linked to, as the last reading of
 * the board saw it: its number, which opens the issue, and its status.
 */
export function PullCardBadge({ card }: PullCardBadgeProps) {
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
    </>
  );
}
