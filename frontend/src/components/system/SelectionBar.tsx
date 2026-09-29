import { Button } from "./Button";
import { Tooltip } from "./Tooltip";

export interface SelectionBarProps {
  count: number;
  /** numbers are the references of the selected cards: #474 #412. */
  numbers: string;
  /** filtered tells that the list is filtered, which the bar says after the numbers. */
  filtered: boolean;
  filteredTooltip: readonly string[];
  onDiscuss: () => void;
  onCancel: () => void;
}

/** SelectionBar takes the place of the filter bar in the select mode: what is selected, Discuss and Cancel. */
export function SelectionBar({
  count,
  numbers,
  filtered,
  filteredTooltip,
  onDiscuss,
  onCancel,
}: SelectionBarProps) {
  return (
    <div
      role="toolbar"
      aria-label="Selected cards"
      className="flex min-h-(--size-control-sm) items-center gap-(--space-2) rounded-md bg-surface-0 py-(--space-1) pr-(--space-1) pl-(--space-3) ring-1 ring-line-2"
    >
      <span
        role="status"
        className="text-(length:--text-ui) leading-(--leading-ui) font-semibold whitespace-nowrap text-ink-1"
      >
        {`${count} selected`}
      </span>
      <span className="flex min-w-0 flex-1 items-baseline gap-(--space-2) text-(length:--text-meta) leading-(--leading-meta) text-ink-3">
        {numbers !== "" && (
          <Tooltip content={numbers}>
            <span className="min-w-0 truncate">{numbers}</span>
          </Tooltip>
        )}
        {filtered && (
          <Tooltip content={filteredTooltip}>
            <span className="whitespace-nowrap">· filtered</span>
          </Tooltip>
        )}
      </span>
      <Button
        variant="primary"
        size="sm"
        shortcut="D"
        onClick={onDiscuss}
        {...(count === 0 ? { disabled: true, disabledReason: "Select a card with Space" } : {})}
      >
        {count === 0 ? "Discuss cards" : `Discuss ${count} ${count === 1 ? "card" : "cards"}`}
      </Button>
      <Tooltip content="Leave the select mode" shortcut="Esc">
        <Button variant="ghost" size="sm" shortcut="Esc" onClick={onCancel}>
          Cancel
        </Button>
      </Tooltip>
    </div>
  );
}
