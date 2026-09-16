import { ChevronsUpDown } from "lucide-react";
import type { Ref } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Toggle } from "@/components/ui/toggle";
import {
  assigneesOf,
  type BoardFilters,
  EMPTY_FILTERS,
  NO_STATUS,
} from "@/features/board/board-view";
import { findRepository, shortName } from "@/lib/repositories";
import type { Board } from "@/lib/wails";
import { useAppStore } from "@/store/app-store";

/** ANY is the entry of a filter menu that filters nothing. */
const ANY = "";

export interface BoardFilterBarProps {
  board: Board;
  filters: BoardFilters;
  onChange: (filters: BoardFilters) => void;
  /** searchRef is the search box, which the / key focuses. */
  searchRef: Ref<HTMLInputElement>;
}

interface FilterOption {
  value: string;
  label: string;
  title?: string;
}

interface FilterMenuProps {
  name: string;
  value: string;
  options: readonly FilterOption[];
  onChange: (value: string) => void;
}

/** FilterMenu picks one value of a filter, or Any. */
function FilterMenu({ name, value, options, onChange }: FilterMenuProps) {
  const label = options.find((option) => option.value === value)?.label ?? "Any";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="outline" size="sm" />}
        aria-label={`${name}: ${label}`}
        className="max-w-48"
      >
        <span className="text-muted-foreground">{name}</span>
        <span className="min-w-0 truncate">{label}</span>
        <ChevronsUpDown aria-hidden="true" className="text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-60">
        <DropdownMenuRadioGroup value={value} onValueChange={onChange}>
          <DropdownMenuRadioItem value={ANY}>Any</DropdownMenuRadioItem>
          <DropdownMenuSeparator />
          {options.map((option) => (
            <DropdownMenuRadioItem key={option.value} value={option.value}>
              <span className="min-w-0 truncate" title={option.title}>
                {option.label}
              </span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** BoardFilterBar narrows the cards of a board view: a search, three filters and Assigned to me. */
export function BoardFilterBar({ board, filters, onChange, searchRef }: BoardFilterBarProps) {
  const app = useAppStore((state) => state.app);
  const set = (change: Partial<BoardFilters>) => onChange({ ...filters, ...change });

  const repositories = (board.repositoryIds ?? []).flatMap((id) => {
    const repository = findRepository(app, id);
    return repository === null
      ? []
      : [{ value: id, label: shortName(repository.fullName), title: repository.fullName }];
  });
  const statuses = [
    ...(board.statuses ?? []).map((status) => ({ value: status.id, label: status.name })),
    { value: NO_STATUS, label: "No status" },
  ];
  const assignees = assigneesOf(board).map((login) => ({ value: login, label: login }));
  const filtered =
    filters.query !== "" ||
    filters.repository !== "" ||
    filters.status !== "" ||
    filters.assignee !== "" ||
    filters.mine;

  return (
    <div className="flex flex-wrap items-center gap-2 border-b px-4 py-2">
      <Input
        ref={searchRef}
        aria-label="Search cards"
        placeholder="Search"
        value={filters.query}
        onChange={(event) => set({ query: event.target.value })}
        className="h-7 w-56"
      />
      <FilterMenu
        name="Repository"
        value={filters.repository}
        options={repositories}
        onChange={(repository) => set({ repository })}
      />
      {board.hasStatus && (
        <FilterMenu
          name="Status"
          value={filters.status}
          options={statuses}
          onChange={(status) => set({ status })}
        />
      )}
      <FilterMenu
        name="Assignee"
        value={filters.assignee}
        options={assignees}
        onChange={(assignee) => set({ assignee })}
      />
      <Toggle
        variant="outline"
        size="sm"
        pressed={filters.mine}
        disabled={board.viewer === ""}
        onPressedChange={(mine) => set({ mine })}
      >
        Assigned to me
      </Toggle>
      {filtered && (
        <Button variant="ghost" size="sm" onClick={() => onChange(EMPTY_FILTERS)}>
          Clear filters
        </Button>
      )}
    </div>
  );
}
