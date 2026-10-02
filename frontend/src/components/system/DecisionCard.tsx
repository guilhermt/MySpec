import { type KeyboardEvent, type ReactNode, useLayoutEffect, useRef, useState } from "react";
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
  /** lockMs is how long A, D and the decide of renderItem stay inert after a decision; 0, the default, for none. */
  lockMs?: number;
  /** preferred is the item current until the user moves to one: a draft the request names. Absent or null: the first undecided. */
  preferred?: string | null;
  /** idle is the current item when nothing is left to decide and the user moved to none: the first ("first", the default) or none ("none"). */
  idle?: "first" | "none";
  /** sections wrap an item and the ones under it in a group: an epic and its cards, the cards indented under a guide of --line-2. */
  sections?: readonly { head: string; members: readonly string[]; label: string }[];
  /** renderItem draws one item: current is the one open and holding the tab stop; tabStop holds it without being open (idle "none"); decide is the click of Approve or Discard, through the same lock and the same advance as the keys. */
  renderItem: (
    item: DecisionCardItem,
    current: boolean,
    extra: { tabStop: boolean; decide: (key: "approve" | "discard") => void },
  ) => ReactNode;
}

/**
 * DecisionCard is a card of items to be decided one by one, with one tab stop: A and D decide the
 * item in focus and move to the next one undecided; the arrows walk the items. It knows nothing of
 * what an item is: the screens draw them. A screen puts data-card-item on its focusable element.
 */
export function DecisionCard({
  title,
  count,
  label,
  items,
  onDecide,
  onLeave,
  lockMs = 0,
  preferred = null,
  idle = "first",
  sections = [],
  renderItem,
}: DecisionCardProps) {
  const root = useRef<HTMLElement>(null);
  const lockedUntil = useRef(0);
  const [focused, setFocused] = useState<string | null>(null);
  const has = (id: string | null) => id !== null && items.some((item) => item.id === id);
  const current =
    (has(focused) ? focused : null) ??
    (has(preferred) ? preferred : null) ??
    items.find((item) => !item.decided && !item.disabled)?.id ??
    (idle === "first" ? (items[0]?.id ?? null) : null);
  const tabStop = current ?? items[0]?.id ?? null;

  const focusItem = (id: string) => {
    const element = root.current?.querySelector<HTMLElement>(`[data-card-item="${id}"]`);
    element?.focus();
    element?.scrollIntoView({ block: "center" });
  };

  // An item that leaves holding the focus hands it back to the card: the one current now.
  useLayoutEffect(() => {
    if (focused === null || has(focused)) return;
    if (document.activeElement === document.body && current !== null) focusItem(current);
    setFocused(null);
  });

  const decideItem = (index: number, key: "approve" | "discard") => {
    const item = items[index];
    if (item === undefined || item.disabled || Date.now() < lockedUntil.current) return;
    const result = onDecide(item.id, key);
    if (lockMs > 0) lockedUntil.current = Date.now() + lockMs;
    if (result === "advance") {
      const others = [...items.slice(index + 1), ...items.slice(0, index)];
      const next = others.find((other) => !other.decided && !other.disabled);
      if (next !== undefined) focusItem(next.id);
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.repeat || isTyping(event.target)) return;
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const origin = (event.target as HTMLElement).closest<HTMLElement>("[data-card-item]");
    const index = items.findIndex((item) => item.id === origin?.dataset.cardItem);
    if (index < 0) return;
    const item = items[index] as DecisionCardItem;
    const key = event.key.toLowerCase();

    if ((key === "a" || key === "d") && !item.disabled) {
      event.preventDefault();
      decideItem(index, key === "a" ? "approve" : "discard");
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
        const id = (event.target as HTMLElement).closest<HTMLElement>("[data-card-item]")?.dataset
          .cardItem;
        if (id !== undefined) setFocused(id);
      }}
      className="flex flex-col gap-(--space-2) rounded-lg bg-surface-2 p-(--space-3) shadow-xs outline-none"
    >
      <h3 className="flex items-baseline gap-(--space-2) text-(length:--text-meta) leading-(--leading-meta) font-medium text-ink-3">
        {title}
        <span className="tabular-nums">{count}</span>
      </h3>
      {items.map((item, index) => {
        if (sections.some((section) => section.members.includes(item.id))) return null;
        const draw = (one: DecisionCardItem, at: number) => (
          <div key={one.id}>
            {renderItem(one, one.id === current, {
              tabStop: one.id === tabStop,
              decide: (key) => decideItem(at, key),
            })}
          </div>
        );
        const section = sections.find((one) => one.head === item.id);
        if (section === undefined) return draw(item, index);
        const members = items.flatMap((one, at) =>
          section.members.includes(one.id) ? [{ one, at }] : [],
        );
        return (
          // biome-ignore lint/a11y/useSemanticElements: a fieldset draws a frame and a legend the section does not want
          <div
            key={item.id}
            role="group"
            aria-label={section.label}
            className="flex flex-col gap-(--space-2)"
          >
            {draw(item, index)}
            {members.length > 0 && (
              <div className="flex flex-col gap-(--space-2) border-l border-line-2 pl-(--list-indent)">
                {members.map(({ one, at }) => draw(one, at))}
              </div>
            )}
          </div>
        );
      })}
    </article>
  );
}
