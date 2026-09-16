import { Badge } from "@/components/ui/badge";
import { issueLabel } from "@/lib/boards";
import type { BoardCard } from "@/lib/wails";

export interface CardSummaryProps {
  card: BoardCard;
}

/** CardSummary names the card a task is being created from, at the top of the dialog. */
export function CardSummary({ card }: CardSummaryProps) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border px-3 py-2 text-sm">
      <p className="flex min-w-0 gap-2">
        <span className="shrink-0 text-muted-foreground tabular-nums">{issueLabel(card)}</span>
        <span className="min-w-0 font-medium">{card.title}</span>
      </p>
      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <span>{card.repository}</span>
        {card.status !== "" && <Badge variant="outline">{card.status}</Badge>}
      </p>
    </div>
  );
}
