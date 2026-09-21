import { Button } from "@/components/ui/button";
import { pluralize } from "@/features/boards/board-dialog";

export interface SelectionBarProps {
  /** count is how many cards are selected; the bar only shows with at least one. */
  count: number;
  onDiscuss: () => void;
  onClear: () => void;
}

/** SelectionBar is what the cards picked on a board view offer: discussing them, or letting them go. */
export function SelectionBar({ count, onDiscuss, onClear }: SelectionBarProps) {
  return (
    <div
      role="toolbar"
      aria-label="Selection"
      className="flex items-center gap-2 border-b px-4 py-2"
    >
      <span className="text-sm">{`${pluralize(count, "card")} selected`}</span>
      <span className="flex-1" />
      <Button variant="outline" size="sm" onClick={onDiscuss}>
        Discuss selected
      </Button>
      <Button variant="ghost" size="sm" onClick={onClear}>
        Clear selection
      </Button>
    </div>
  );
}
