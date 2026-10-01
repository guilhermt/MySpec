import { type KeyboardEvent, type ReactNode, useRef, useState } from "react";
import { isTyping } from "./keys";

export interface DecisionCardItem {
  id: string;
  decided: boolean;
  disabled: boolean;
}

export interface DecisionCardProps {
  /** title and count are the header: "Findings" and 3. */
  title: string;
  count: number;
  /** label names the group: "Findings of pass 1". */
  label: string;
  items: readonly DecisionCardItem[];
  /** onDecide is A or D on the item in focus; it says whether the press decided ("advance") or undid ("stay"). */
  onDecide: (id: string, key: "approve" | "discard") => "advance" | "stay";
  /** onLeave hands the arrows over to what is around the card at its ends. */
  onLeave?: (by: -1 | 1) => void;
  /** renderItem draws one item, with whether it holds the card's tab stop. */
  renderItem: (item: DecisionCardItem, current: boolean) => ReactNode;
}

/**
 * DecisionCard is a card of items to be decided one by one, with one tab stop: A and D decide the
 * item in focus and move to the next one undecided; the arrows walk the items. It knows nothing of
 * what an item is: the screens draw them.
 */
export function DecisionCard({
  title,
  count,
  label,
  items,
  onDecide,
  onLeave,
  renderItem,
}: DecisionCardProps) {
  const root = useRef<HTMLElement>(null);
  const [focused, setFocused] = useState<string | null>(null);
  const current =
    items.find((item) => item.id === focused)?.id ??
    (items.find((item) => !item.decided && !item.disabled) ?? items[0])?.id ??
    null;

  const focusItem = (id: string) => {
    const element = root.current?.querySelector<HTMLElement>(`[data-finding-id="${id}"]`);
    element?.focus();
    element?.scrollIntoView({ block: "center" });
  };

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.repeat || isTyping(event.target)) return;
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const origin = (event.target as HTMLElement).closest<HTMLElement>("[data-finding-id]");
    const index = items.findIndex((item) => item.id === origin?.dataset.findingId);
    if (index < 0) return;
    const item = items[index] as DecisionCardItem;
    const key = event.key.toLowerCase();

    if ((key === "a" || key === "d") && !item.disabled) {
      event.preventDefault();
      const result = onDecide(item.id, key === "a" ? "approve" : "discard");
      if (result === "advance") {
        const others = [...items.slice(index + 1), ...items.slice(0, index)];
        const next = others.find((other) => !other.decided && !other.disabled);
        if (next !== undefined) focusItem(next.id);
      }
    } else if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      event.preventDefault();
      const by = event.key === "ArrowUp" ? -1 : 1;
      const target = items[index + by];
      if (target === undefined) onLeave?.(by);
      else focusItem(target.id);
    }
  };

  return (
    // biome-ignore lint/a11y/useSemanticElements: a fieldset draws a frame and a legend the card does not want
    <article
      ref={root}
      role="group"
      aria-label={label}
      data-decision-card=""
      data-feed-item=""
      data-feed-keys="own"
      data-feed-stop="inner"
      tabIndex={-1}
      onKeyDown={onKeyDown}
      onFocus={(event) => {
        // The card is never the stop itself: focus that lands on it, from the feed's arrows or a
        // click between the items, goes on to the current item.
        if (event.target === event.currentTarget) {
          if (current !== null) focusItem(current);
          return;
        }
        const id = (event.target as HTMLElement).closest<HTMLElement>("[data-finding-id]")?.dataset
          .findingId;
        if (id !== undefined) setFocused(id);
      }}
      className="flex flex-col gap-(--space-2) rounded-lg bg-surface-2 p-(--space-3) shadow-xs outline-none"
    >
      <h3 className="flex items-baseline gap-(--space-2) text-(length:--text-meta) leading-(--leading-meta) font-medium text-ink-3">
        {title}
        <span className="tabular-nums">{count}</span>
      </h3>
      {items.map((item) => (
        <div key={item.id}>{renderItem(item, item.id === current)}</div>
      ))}
    </article>
  );
}
