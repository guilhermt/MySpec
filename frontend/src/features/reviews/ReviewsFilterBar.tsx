import { useEffect, useState } from "react";
import { FilterMenu } from "@/components/FilterMenu";
import { Button } from "@/components/ui/button";
import { Toggle } from "@/components/ui/toggle";
import { MultiFilterMenu } from "@/features/reviews/MultiFilterMenu";
import {
  EMPTY_REVIEW_FILTERS,
  isFiltering,
  NO_BOARD,
  sameFilters,
} from "@/features/reviews/reviews-view";
import { shortName } from "@/lib/repositories";
import type { ReviewCenter, ReviewFilters } from "@/lib/wails";
import { setReviewFilters } from "@/store/actions";
import { useBoards, useRepositories } from "@/store/app-store";

export interface ReviewsFilterBarProps {
  center: ReviewCenter;
  /** pendingOnly is the switch that keeps only what waits for the user; the view applies it. */
  pendingOnly: boolean;
  onPendingOnlyChange: (pendingOnly: boolean) => void;
}

/**
 * ReviewsFilterBar narrows what the Reviews view lists and counts. The filters
 * live in Go, so what the user chooses here is remembered between runs; the
 * pending-only switch is not one of them, and lasts while the view is open.
 */
export function ReviewsFilterBar({
  center,
  pendingOnly,
  onPendingOnlyChange,
}: ReviewsFilterBarProps) {
  const boards = useBoards();
  const repositories = useRepositories();
  // The last choice sent, shown at once until a snapshot carries it: the
  // menus stay open for several clicks in a row, and each click builds on the
  // one before it, not on a snapshot that has not caught up yet.
  const [pending, setPending] = useState<ReviewFilters | null>(null);
  const filters = pending ?? center.filters;

  useEffect(() => {
    if (pending !== null && sameFilters(pending, center.filters)) {
      setPending(null);
    }
  }, [pending, center.filters]);

  const change = (next: ReviewFilters) => {
    setPending(next);
    void setReviewFilters(next).then((stored) => {
      // A choice Go refused gives the view back to the snapshot, unless another followed it.
      if (!stored) {
        setPending((current) => (current === next ? null : current));
      }
    });
  };
  const set = (partial: Partial<ReviewFilters>) => change({ ...filters, ...partial });

  const boardOptions = [
    ...boards.map((board) => ({ value: board.id, label: board.title })),
    { value: NO_BOARD, label: "No board" },
  ];
  const repositoryOptions = repositories.map((repository) => ({
    value: repository.id,
    label: shortName(repository.fullName),
    title: repository.fullName,
  }));

  return (
    <div className="flex flex-wrap items-center gap-2 border-b px-4 py-2">
      <FilterMenu
        name="Board"
        value={filters.boardId}
        options={boardOptions}
        onChange={(boardId) => set({ boardId })}
      />
      <FilterMenu
        name="Repository"
        value={filters.repositoryId}
        options={repositoryOptions}
        onChange={(repositoryId) => set({ repositoryId })}
      />
      <MultiFilterMenu
        name="Author"
        kind="author"
        values={center.authors ?? []}
        filters={filters}
        onChange={change}
      />
      <MultiFilterMenu
        name="Label"
        kind="label"
        values={center.labels ?? []}
        filters={filters}
        onChange={change}
      />
      <Toggle
        variant="outline"
        size="sm"
        pressed={pendingOnly}
        onPressedChange={onPendingOnlyChange}
      >
        Pending only
      </Toggle>
      {(isFiltering(filters) || pendingOnly) && (
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
    </div>
  );
}
