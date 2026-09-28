import { type KeyboardEvent, type ReactNode, useRef } from "react";
import { cn } from "@/lib/utils";
import { Tooltip } from "./Tooltip";

/** TabItem is one tab: its label, the glyph of its session, and the word that says it waits. */
export interface TabItem<T extends string> {
  id: T;
  label: string;
  glyph?: ReactNode;
  /** word follows the label on a tab that is not chosen: "waits", "error". */
  word?: { text: string; tone: "wait" | "error" };
  disabled?: boolean;
  /** disabledLabel follows the label of a disabled tab: "starts with pass 1". */
  disabledLabel?: string;
  accessibleName: string;
  tooltip?: string;
  /** flash blinks the tab once for a new situation, in the veil of its gravity. */
  flash?: "wait" | "error" | null;
}

export interface TabsProps<T extends string> {
  label: string;
  items: readonly TabItem<T>[];
  value: T;
  onValueChange: (id: T) => void;
  /** controls is the id of the panel the tabs switch. */
  controls: string;
}

const WORD_TONES = {
  wait: "font-medium text-state-wait",
  error: "font-medium text-state-error",
} as const;

/** tabId is the stable id of a tab button, for the panel it controls to point its aria-labelledby at. */
export function tabId(controls: string, item: string): string {
  return `${controls}-tab-${item}`;
}

/**
 * Tabs is the minimal tab list: text tabs over a line, the chosen one in the first ink with the
 * brand underline. It is one Tab stop, the chosen tab; ← and → move to the next enabled tab and
 * choose it.
 */
export function Tabs<T extends string>({
  label,
  items,
  value,
  onValueChange,
  controls,
}: TabsProps<T>) {
  const list = useRef<HTMLDivElement>(null);

  // Walks from the tab's own position in items, not from an index into the enabled-only list:
  // when the chosen tab is itself disabled, its id has no place in that list, and indexing into
  // it lands on the wrong neighbour.
  const move = (event: KeyboardEvent, from: T) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const at = items.findIndex((item) => item.id === from);
    if (at === -1) return;
    const step = event.key === "ArrowRight" ? 1 : -1;
    for (let i = 1; i <= items.length; i++) {
      const index = (((at + step * i) % items.length) + items.length) % items.length;
      const next = items[index];
      if (next === undefined) return;
      if (next.id === from) return;
      if (!next.disabled) {
        onValueChange(next.id);
        list.current?.querySelector<HTMLElement>(`[data-tab="${next.id}"]`)?.focus();
        return;
      }
    }
  };

  return (
    <div
      ref={list}
      role="tablist"
      aria-label={label}
      className="flex h-(--size-tab) items-stretch gap-(--space-5) shadow-[inset_0_calc(var(--border)*-1)_0_var(--line-1)]"
    >
      {items.map((item) => {
        const selected = item.id === value;
        const tab = (
          <button
            key={item.id}
            id={tabId(controls, item.id)}
            type="button"
            role="tab"
            data-tab={item.id}
            aria-selected={selected}
            aria-controls={controls}
            aria-label={item.accessibleName}
            aria-disabled={item.disabled || undefined}
            tabIndex={selected ? 0 : -1}
            data-flash={item.flash ?? undefined}
            onClick={() => {
              if (!item.disabled && !selected) onValueChange(item.id);
            }}
            onKeyDown={(event) => move(event, item.id)}
            className={cn(
              "relative inline-flex items-center gap-(--space-1-5) rounded-sm px-(--space-0-5) text-(length:--text-meta) leading-(--leading-meta) whitespace-nowrap outline-none transition-colors duration-(--duration-fast) focus-visible:focus-ring focus-visible:outline-offset-[calc(var(--focus-offset)*-1)]",
              item.disabled
                ? "cursor-not-allowed text-ink-4 outline-dashed outline-(length:--border) outline-offset-[calc(var(--border)*-1)] outline-line-3"
                : selected
                  ? "font-semibold text-ink-1 after:absolute after:inset-x-0 after:bottom-0 after:h-(--border-2) after:rounded-t-(--radius-pill) after:bg-brand"
                  : "text-ink-3 hover:text-ink-1 active:text-ink-1",
              item.flash != null && "situation-flash",
            )}
          >
            {item.glyph}
            {item.label}
            {item.disabled && item.disabledLabel !== undefined && ` · ${item.disabledLabel}`}
            {!selected && item.word !== undefined && (
              <span className={WORD_TONES[item.word.tone]}>· {item.word.text}</span>
            )}
          </button>
        );
        return item.tooltip !== undefined ? (
          <Tooltip key={item.id} content={item.tooltip}>
            {tab}
          </Tooltip>
        ) : (
          tab
        );
      })}
    </div>
  );
}
