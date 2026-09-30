import { useEffect, useState } from "react";
import { Button } from "@/components/system/Button";
import { Chip } from "@/components/system/Chip";
import {
  FilterBar,
  FilterChip,
  type FilterCycleGroup,
  FilterMenu,
} from "@/components/system/FilterBar";
import type { FilterCycle } from "@/components/system/Menu";
import {
  cycled,
  EMPTY_REVIEW_FILTERS,
  filterChips,
  filterGroups,
  filtersActive,
  sameFilters,
  withBoard,
  withoutChip,
  withRepository,
} from "@/features/reviews/review-list";
import type { ReviewCenter, ReviewFilters } from "@/lib/wails";
import { setReviewFilters } from "@/store/actions";
import { useAppStore } from "@/store/app-store";

/** CYCLE_NOTE follows the legend of Author and Label in the menu. */
const CYCLE_NOTE = "click to hide, again to keep only";

export interface ReviewsFilterBarProps {
  center: ReviewCenter;
  /** pendingOnly is the switch that keeps only what waits for the user; the view applies it. */
  pendingOnly: boolean;
  onPendingOnlyChange: (pendingOnly: boolean) => void;
}

/**
 * ReviewsFilterBar narrows what the Reviews view lists and counts: the chosen filters as chips and
 * the Filter menu. The filters live in Go, so what the user chooses here is remembered between
 * runs; the pending-only switch is not one of them, and lasts while the view is open.
 */
export function ReviewsFilterBar({
  center,
  pendingOnly,
  onPendingOnlyChange,
}: ReviewsFilterBarProps) {
  const app = useAppStore((state) => state.app);
  // The last choice sent, shown at once until a snapshot carries it: the
  // menu stays open for several clicks in a row, and each click builds on the
  // one before it, not on a snapshot that has not caught up yet.
  const [pending, setPending] = useState<ReviewFilters | null>(null);
  const filters = pending ?? center.filters;

  useEffect(() => {
    if (pending !== null && sameFilters(pending, center.filters)) {
      setPending(null);
    }
  }, [pending, center.filters]);

  if (app === null) {
    return null;
  }

  const change = (next: ReviewFilters) => {
    setPending(next);
    void setReviewFilters(next).then((stored) => {
      // A choice Go refused gives the view back to the snapshot, unless another followed it.
      if (!stored) {
        setPending((current) => (current === next ? null : current));
      }
    });
  };

  const { board, repository, authors, labels } = filterGroups(filters, center, app);
  const cycles: FilterCycleGroup[] = [
    { label: "Author", note: CYCLE_NOTE, items: authors },
    { label: "Label", note: CYCLE_NOTE, items: labels },
  ];
  const nameOf = (group: { items: { value: string; label: string }[] }, value: string) =>
    group.items.find((item) => item.value === value)?.label ?? "";

  const pick = (group: string, value: string) => {
    if (group === "Board") {
      change(withBoard(filters, value, nameOf(board, value)));
    } else {
      change(withRepository(filters, value, nameOf(repository, value)));
    }
  };
  const cycle = (group: string, value: string, next: FilterCycle) =>
    change(cycled(filters, group === "Author" ? "author" : "label", value, next));

  return (
    <FilterBar label="Filter the pull requests">
      <Chip kind="toggle" pressed={pendingOnly} onPressedChange={onPendingOnlyChange}>
        Pending only
      </Chip>
      {filterChips(filters, app).map((chip) => (
        <FilterChip
          key={`${chip.kind}:${chip.value}:${chip.label}`}
          model={chip}
          onRemove={() => change(withoutChip(filters, chip))}
        />
      ))}
      <FilterMenu
        tooltip="Board, repository, author, label"
        groups={[board, repository]}
        onPick={pick}
        cycles={cycles}
        onCycle={cycle}
      />
      {(filtersActive(filters) || pendingOnly) && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            onPendingOnlyChange(false);
            change(EMPTY_REVIEW_FILTERS);
          }}
        >
          Clear filters
        </Button>
      )}
    </FilterBar>
  );
}
