import { ChevronsUpDown, Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  cycleFilter,
  type FilterState,
  filterState,
  filterSummary,
  type MultiFilterKind,
} from "@/features/reviews/reviews-view";
import type { ReviewFilters } from "@/lib/wails";

// What a screen reader says a value is doing in the filter.
const STATE_WORD: Record<FilterState, string> = {
  include: "included",
  exclude: "excluded",
  none: "not filtered",
};

export interface MultiFilterMenuProps {
  name: string;
  kind: MultiFilterKind;
  /** values are every value the reading found, in the order the menu lists them. */
  values: readonly string[];
  filters: ReviewFilters;
  onChange: (filters: ReviewFilters) => void;
}

/**
 * MultiFilterMenu includes and excludes values of one filter. Each click walks
 * a value on, and the menu stays open: excluding a handful of bots is one trip.
 */
export function MultiFilterMenu({ name, kind, values, filters, onChange }: MultiFilterMenuProps) {
  const summary = filterSummary(filters, kind);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="outline" size="sm" />}
        aria-label={`${name}: ${summary}`}
        className="max-w-48"
      >
        <span className="text-muted-foreground">{name}</span>
        <span className="min-w-0 truncate">{summary}</span>
        <ChevronsUpDown aria-hidden="true" className="text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-60">
        {values.length === 0 ? (
          <DropdownMenuItem disabled>Nothing to filter by</DropdownMenuItem>
        ) : (
          values.map((value) => {
            const state = filterState(filters, kind, value);
            return (
              <DropdownMenuItem
                key={value}
                closeOnClick={false}
                aria-label={`${value}: ${STATE_WORD[state]}`}
                onClick={() => onChange(cycleFilter(filters, kind, value))}
              >
                {state === "include" && <Plus aria-hidden="true" />}
                {state === "exclude" && <Minus aria-hidden="true" />}
                {/* The values line up whatever the filter does with them. */}
                {state === "none" && <span aria-hidden="true" className="size-4 shrink-0" />}
                <span className="min-w-0 truncate">{value}</span>
              </DropdownMenuItem>
            );
          })
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
