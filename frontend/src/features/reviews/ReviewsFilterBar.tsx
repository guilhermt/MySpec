import { FilterMenu } from "@/components/FilterMenu";
import { Button } from "@/components/ui/button";
import { Toggle } from "@/components/ui/toggle";
import { MultiFilterMenu } from "@/features/reviews/MultiFilterMenu";
import { EMPTY_REVIEW_FILTERS, isFiltering, NO_BOARD } from "@/features/reviews/reviews-view";
import { shortName } from "@/lib/repositories";
import type { ReviewCenter, ReviewFilters } from "@/lib/wails";
import { setReviewFilters } from "@/store/actions";
import { useBoards, useRepositories } from "@/store/app-store";

export interface ReviewsFilterBarProps {
  center: ReviewCenter;
}

/**
 * ReviewsFilterBar narrows what the Reviews view lists and counts. The filters
 * live in Go, so what the user chooses here is remembered between runs.
 */
export function ReviewsFilterBar({ center }: ReviewsFilterBarProps) {
  const boards = useBoards();
  const repositories = useRepositories();
  const { filters } = center;

  const change = (next: ReviewFilters) => void setReviewFilters(next);
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
        pressed={filters.pendingOnly}
        onPressedChange={(pendingOnly) => set({ pendingOnly })}
      >
        Pending only
      </Toggle>
      {isFiltering(filters) && (
        <Button variant="ghost" size="sm" onClick={() => change(EMPTY_REVIEW_FILTERS)}>
          Clear filters
        </Button>
      )}
    </div>
  );
}
