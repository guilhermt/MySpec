import type { Ref } from "react";
import { cn } from "@/lib/utils";
import { Icon } from "./Icon";
import { ICONS } from "./icons";
import { Tooltip } from "./Tooltip";

export interface ListSectionHeaderProps {
  /** id is the section the list keys it by, on data-section-id. */
  id: string;
  name: string;
  count: number;
  collapsed: boolean;
  /** empty is a section without cards: no chevron, no hover, no action. */
  empty: boolean;
  tooltip: string | null;
  /** label is the accessible name: "Backlog, 27 cards". */
  label: string;
  /** tabStop is the header the list's one tab stop sits on. */
  tabStop: boolean;
  /** setSize and posInSet say which header this is among the headers: a windowed list, whose DOM does not, gives them. */
  setSize?: number;
  posInSet?: number;
  /** index is the position in a windowed list (data-index), and ref its measure. */
  index?: number;
  ref?: Ref<HTMLDivElement>;
  onToggle: () => void;
  onFocus: () => void;
}

/** ListSectionHeader is the header of a collapsible section of a list, a treeitem of level 1. */
export function ListSectionHeader({
  id,
  name,
  count,
  collapsed,
  empty,
  tooltip,
  label,
  tabStop,
  setSize,
  posInSet,
  index,
  ref,
  onToggle,
  onFocus,
}: ListSectionHeaderProps) {
  const header = (
    // biome-ignore lint/a11y/useKeyWithClickEvents: the list owns the keyboard of its rows
    <div
      ref={ref}
      data-index={index}
      role="treeitem"
      aria-level={1}
      aria-setsize={setSize}
      aria-posinset={posInSet}
      {...(empty ? {} : { "aria-expanded": !collapsed })}
      aria-label={label}
      data-section-id={id}
      tabIndex={tabStop ? 0 : -1}
      onClick={empty ? undefined : onToggle}
      onFocus={onFocus}
      className={cn(
        "grid min-h-(--size-node) grid-cols-[var(--icon)_minmax(0,1fr)] items-center gap-x-(--space-2) rounded-sm px-(--space-2) text-ink-2 outline-none focus-visible:focus-ring",
        empty
          ? "cursor-default"
          : "cursor-pointer hover:bg-veil-hover hover:text-ink-1 active:bg-veil-press",
      )}
    >
      <span className="grid place-items-center">
        {!empty && (
          <Icon
            icon={ICONS.chevron}
            size="xs"
            className={cn(
              "text-ink-4 transition-transform duration-(--duration-fast) ease-standard",
              !collapsed && "rotate-90",
            )}
          />
        )}
      </span>
      <span className="inline-flex min-w-0 items-baseline gap-(--space-2) text-(length:--text-meta) leading-(--leading-meta) font-semibold">
        {name}
        <span className="text-(length:--text-micro) leading-(--leading-micro) font-normal tabular-nums text-ink-4">
          {count}
        </span>
      </span>
    </div>
  );
  return tooltip === null ? header : <Tooltip content={tooltip}>{header}</Tooltip>;
}

export interface DaySectionHeaderProps {
  /** id is the day the list keys it by, on data-section-id. */
  id: string;
  name: string;
  count: number;
  /** label is the accessible name and the tooltip: "Archived on Monday, Sep 22: 5". */
  label: string;
  /** tabStop is the header the list's one tab stop sits on. */
  tabStop: boolean;
  onFocus: () => void;
}

/** DaySectionHeader is the header of a day of the History, a treeitem of level 1 that is always open: no chevron, no action. */
export function DaySectionHeader({
  id,
  name,
  count,
  label,
  tabStop,
  onFocus,
}: DaySectionHeaderProps) {
  return (
    <Tooltip content={label}>
      <div
        role="treeitem"
        aria-level={1}
        aria-expanded="true"
        aria-label={label}
        data-section-id={id}
        tabIndex={tabStop ? 0 : -1}
        onFocus={onFocus}
        className="flex min-h-(--size-node) cursor-default items-center rounded-sm px-(--space-2) text-ink-2 outline-none hover:bg-veil-hover focus-visible:focus-ring"
      >
        <span className="inline-flex min-w-0 items-baseline gap-(--space-2) text-(length:--text-meta) leading-(--leading-meta) font-semibold">
          {name}
          <span className="text-(length:--text-micro) leading-(--leading-micro) font-normal tabular-nums text-ink-4">
            {count}
          </span>
        </span>
      </div>
    </Tooltip>
  );
}
