import type { ReactNode, Ref } from "react";
import { cn } from "@/lib/utils";
import { Chip } from "./Chip";
import { Icon } from "./Icon";
import { ICONS } from "./icons";
import {
  type FilterCycle,
  Menu,
  MenuCheckboxItem,
  MenuContent,
  MenuCycleItem,
  MenuGroup,
  MenuGroupLabel,
  MenuSeparator,
  MenuTrigger,
} from "./Menu";
import { StateGlyph } from "./StateGlyph";
import { Tooltip } from "./Tooltip";

/** STICKY_FADE is the fade under a bar stuck to the top of a list's scroll. */
export const STICKY_FADE =
  "after:pointer-events-none after:absolute after:inset-x-0 after:top-full after:h-(--space-3) after:bg-linear-to-b after:from-surface-1 after:to-transparent after:content-['']";

export interface FilterBarProps {
  /** label names the search landmark: "Filter the cards". */
  label: string;
  children: ReactNode;
  /** nowrap keeps the bar on one line; its owner folds what does not fit. */
  nowrap?: boolean;
  /** ref is the bar, which a windowed list reads to put a row it scrolls to below it. */
  ref?: Ref<HTMLDivElement> | undefined;
}

/**
 * FilterBar is the bar at the top of a list: the search, the toggles, the active filters and the
 * Filter menu, stuck to the top of the scroll with a fade under it. It is the search landmark, so
 * the search box inside it declares none.
 */
export function FilterBar({ label, children, nowrap = false, ref }: FilterBarProps) {
  return (
    // biome-ignore lint/a11y/useSemanticElements: jsdom gives the <search> element no role, so the landmark is declared.
    <div
      ref={ref}
      role="search"
      aria-label={label}
      className={cn(
        "sticky top-0 z-(--z-sticky) flex items-center gap-(--space-2) bg-surface-1 pt-(--space-4) pb-(--space-3)",
        nowrap ? "flex-nowrap" : "flex-wrap",
        STICKY_FADE,
      )}
    >
      {children}
    </div>
  );
}

/** FilterChipView is what FilterChip draws: an active filter. */
export interface FilterChipView {
  /** label is "acme/api", "Assignee: tchen" or "Status: Ready". */
  label: string;
  /** removeLabel is "Remove the filter acme/api". */
  removeLabel: string;
  /** orphan is why the filter no longer matches the list, null when it does. */
  orphan: string | null;
}

export interface FilterChipProps {
  model: FilterChipView;
  onRemove: () => void;
}

/** FilterChip is an active filter with its ×; a filter that matches nothing anymore carries ◇ and says why. */
export function FilterChip({ model, onRemove }: FilterChipProps) {
  const chip = (
    <Chip
      kind="action"
      onRemove={onRemove}
      removeLabel={model.removeLabel}
      {...(model.orphan === null ? {} : { "aria-label": `${model.label}, ${model.orphan}` })}
    >
      {model.orphan !== null && (
        <StateGlyph state="blocked" className="mr-(--space-1-5) align-middle" />
      )}
      {model.label}
    </Chip>
  );
  return model.orphan === null ? chip : <Tooltip content={model.orphan}>{chip}</Tooltip>;
}

export interface FilterGroup {
  label: string;
  items: { value: string; label: string; checked: boolean }[];
}

/** FilterCycleGroup is a group of three-way filters: each value any, hidden or the only one. */
export interface FilterCycleGroup {
  label: string;
  /** note follows the label: "click to hide, again to keep only". */
  note: string;
  items: { value: string; label: string; state: FilterCycle }[];
}

export interface FilterMenuProps {
  /** tooltip says what the menu filters by: "Repository, assignee, status". */
  tooltip: string;
  groups: readonly FilterGroup[];
  /** onPick chooses the item of a group; picking the checked one unchecks it. */
  onPick: (group: string, value: string, checked: boolean) => void;
  /** cycles are the groups of three-way filters, after the others. */
  cycles?: readonly FilterCycleGroup[];
  onCycle?: (group: string, value: string, next: FilterCycle) => void;
  /** active is how many filters are chosen; a bar that folds its chips says it after Filter. */
  active?: number;
}

/**
 * FilterMenu is the Filter chip and its menu: a group for each filter, one item checked at most in
 * each, then the groups of three-way filters.
 */
export function FilterMenu({
  tooltip,
  groups,
  onPick,
  cycles = [],
  onCycle,
  active = 0,
}: FilterMenuProps) {
  return (
    <Menu>
      <Tooltip content={tooltip}>
        <MenuTrigger
          render={
            <Chip kind="menu">
              <Icon icon={ICONS.filter} size="xs" />
              Filter
              {active > 0 && (
                <span className="hidden @max-[620px]/list:inline">{` · ${active}`}</span>
              )}
            </Chip>
          }
        />
      </Tooltip>
      <MenuContent align="start">
        {groups.map((group, index) => (
          <div key={group.label} className="flex flex-col gap-(--space-0-5)">
            {index > 0 && <MenuSeparator />}
            <MenuGroup>
              <MenuGroupLabel>{group.label}</MenuGroupLabel>
              {group.items.map((item) => (
                <MenuCheckboxItem
                  key={item.value}
                  checked={item.checked}
                  onCheckedChange={(checked) => onPick(group.label, item.value, checked)}
                >
                  {item.label}
                </MenuCheckboxItem>
              ))}
            </MenuGroup>
          </div>
        ))}
        {cycles.map((group, index) => (
          <div key={group.label} className="flex flex-col gap-(--space-0-5)">
            {(groups.length > 0 || index > 0) && <MenuSeparator />}
            <MenuGroup>
              <MenuGroupLabel note={group.note}>{group.label}</MenuGroupLabel>
              {group.items.map((item) => (
                <MenuCycleItem
                  key={item.value}
                  label={item.label}
                  state={item.state}
                  onStateChange={(next) => onCycle?.(group.label, item.value, next)}
                />
              ))}
            </MenuGroup>
          </div>
        ))}
      </MenuContent>
    </Menu>
  );
}
