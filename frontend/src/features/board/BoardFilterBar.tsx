import type { KeyboardEvent, Ref } from "react";
import { Button } from "@/components/system/Button";
import { Chip } from "@/components/system/Chip";
import { FilterBar, FilterChip, type FilterGroup, FilterMenu } from "@/components/system/FilterBar";
import { SearchInput } from "@/components/system/SearchInput";
import { Tooltip } from "@/components/system/Tooltip";
import {
  assigneesOf,
  type BoardFilters,
  EMPTY_FILTERS,
  filterChips,
  filtersActive,
  NO_STATUS,
} from "@/features/board/board-view";
import { findRepository } from "@/lib/repositories";
import type { Board } from "@/lib/wails";
import { useAppStore } from "@/store/app-store";

export interface BoardFilterBarProps {
  board: Board;
  filters: BoardFilters;
  onChange: (filters: BoardFilters) => void;
  /** searchRef is the search box, which the / key focuses. */
  searchRef: Ref<HTMLInputElement>;
  /** onSearchEscape and onSearchDown take the focus from the search to the list. */
  onSearchEscape: (event: KeyboardEvent<HTMLInputElement>) => void;
  onSearchDown: () => void;
  /** barRef is the bar, which the windowed list scrolls its rows below. */
  barRef?: Ref<HTMLDivElement>;
}

/** BoardFilterBar narrows the cards of a board view: the search, Assigned to me, the chosen filters and the Filter menu. */
export function BoardFilterBar({
  board,
  filters,
  onChange,
  searchRef,
  onSearchEscape,
  onSearchDown,
  barRef,
}: BoardFilterBarProps) {
  const app = useAppStore((state) => state.app);
  const set = (change: Partial<BoardFilters>) => onChange({ ...filters, ...change });

  const groups: FilterGroup[] = [
    {
      label: "Repository",
      items: (board.repositoryIds ?? []).flatMap((id) => {
        const repository = findRepository(app, id);
        return repository === null
          ? []
          : [{ value: id, label: repository.fullName, checked: filters.repository === id }];
      }),
    },
    {
      label: "Assignee",
      items: assigneesOf(board).map((login) => ({
        value: login,
        label: login === board.viewer ? `${login} · you` : login,
        checked: filters.assignee === login,
      })),
    },
    ...(board.hasStatus
      ? [
          {
            label: "Status",
            items: [
              ...(board.statuses ?? []).map((status) => ({
                value: status.id,
                label: status.name,
                checked: filters.status === status.id,
              })),
              { value: NO_STATUS, label: "No status", checked: filters.status === NO_STATUS },
            ],
          },
        ]
      : []),
  ];

  // Picking fills the id and the name the chip shows; unchecking the chosen one clears both.
  const pick = (group: string, value: string, checked: boolean) => {
    const item = groups
      .find((candidate) => candidate.label === group)
      ?.items.find((candidate) => candidate.value === value);
    const name = checked ? (item?.label ?? "") : "";
    const chosen = checked ? value : "";
    if (group === "Repository") {
      set({ repository: chosen, repositoryName: name });
    } else if (group === "Assignee") {
      set({ assignee: chosen });
    } else {
      set({ status: chosen, statusName: name });
    }
  };

  const clear = {
    repository: () => set({ repository: "", repositoryName: "" }),
    assignee: () => set({ assignee: "" }),
    status: () => set({ status: "", statusName: "" }),
  };

  const mine = (
    <Chip
      kind="toggle"
      pressed={filters.mine}
      onPressedChange={(pressed) => set({ mine: pressed })}
      {...(board.viewer === ""
        ? { disabled: true, disabledReason: "gh didn't say who you are" }
        : {})}
    >
      Assigned to me
    </Chip>
  );

  return (
    <FilterBar label="Filter the cards" ref={barRef}>
      <SearchInput
        landmark={false}
        inputRef={searchRef}
        label="Search cards"
        placeholder="Search cards"
        shortcut="/"
        value={filters.query}
        onValueChange={(query) => set({ query })}
        onEscape={onSearchEscape}
        onArrowDown={onSearchDown}
        className="w-[calc(var(--space-16)*4)] @max-[620px]/list:w-[calc(var(--space-16)*3)]"
      />
      {board.viewer === "" ? (
        mine
      ) : (
        <Tooltip content={`Only the cards assigned to ${board.viewer}`}>{mine}</Tooltip>
      )}
      {filterChips(filters, board, app).map((chip) => (
        <FilterChip key={chip.kind} model={chip} onRemove={clear[chip.kind]} />
      ))}
      <FilterMenu tooltip="Repository, assignee, status" groups={groups} onPick={pick} />
      {filtersActive(filters) && (
        <Button variant="ghost" size="sm" onClick={() => onChange(EMPTY_FILTERS)}>
          Clear filters
        </Button>
      )}
    </FilterBar>
  );
}
