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
  /** final marks a section of a final status, which says so after the count. */
  final: boolean;
  tooltip: string | null;
  /** label is the accessible name: "Backlog, 27 cards". */
  label: string;
  /** tabStop is the header the list's one tab stop sits on. */
  tabStop: boolean;
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
  final,
  tooltip,
  label,
  tabStop,
  onToggle,
  onFocus,
}: ListSectionHeaderProps) {
  const header = (
    // biome-ignore lint/a11y/useKeyWithClickEvents: the list owns the keyboard of its rows
    <div
      role="treeitem"
      aria-level={1}
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
        {final && (
          <span className="text-(length:--text-micro) leading-(--leading-micro) font-normal text-ink-4">
            final
          </span>
        )}
      </span>
    </div>
  );
  return tooltip === null ? header : <Tooltip content={tooltip}>{header}</Tooltip>;
}
