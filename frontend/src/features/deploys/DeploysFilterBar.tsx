import { useEffect, useState } from "react";
import { FilterBar, FilterChip, FilterMenu } from "@/components/system/FilterBar";
import { asDeployFilterGone, type Deploys } from "@/lib/wails";
import { setDeployFilter } from "@/store/actions";

export interface DeploysFilterBarProps {
  deploys: Deploys;
}

/** filterBarShows tells whether Deploys draws its filter bar: with more than one board to choose from, or a board already chosen. */
export function filterBarShows(deploys: Deploys): boolean {
  return (deploys.boards ?? []).length > 1 || deploys.filter.boardId !== "";
}

/**
 * DeploysFilterBar narrows Deploys to one board: the chosen board as a chip and the Filter menu.
 * The filter lives in Go, so what the user chooses here is remembered between runs.
 */
export function DeploysFilterBar({ deploys }: DeploysFilterBarProps) {
  // The last choice sent, shown at once until a snapshot carries it.
  const [pending, setPending] = useState<string | null>(null);
  const boards = deploys.boards ?? [];
  const chosen = pending ?? deploys.filter.boardId;

  useEffect(() => {
    if (pending !== null && pending === deploys.filter.boardId) {
      setPending(null);
    }
  }, [pending, deploys.filter.boardId]);

  const change = (boardId: string) => {
    setPending(boardId);
    void setDeployFilter(boardId).then((stored) => {
      // A choice Go refused gives the view back to the snapshot, unless another followed it.
      if (!stored) {
        setPending((current) => (current === boardId ? null : current));
      }
    });
  };

  const title =
    boards.find((board) => board.id === chosen)?.title ??
    (chosen === deploys.filter.boardId ? deploys.filter.title : chosen);
  const gone = asDeployFilterGone(deploys.filterGone);
  let orphan: string | null = null;
  if (chosen === deploys.filter.boardId && gone !== "") {
    orphan = gone === "removed" ? "This board was removed." : "This board no longer has deploys.";
  }
  const label = `Board: ${title}`;

  return (
    <FilterBar label="Filter the deploys">
      {chosen !== "" && (
        <FilterChip
          model={{ label, removeLabel: `Remove the filter ${label}`, orphan }}
          onRemove={() => change("")}
        />
      )}
      <FilterMenu
        tooltip="Board"
        groups={[
          {
            label: "Board",
            items: boards.map((board) => ({
              value: board.id,
              label: board.title,
              checked: board.id === chosen,
            })),
          },
        ]}
        onPick={(_, value) => change(value === chosen ? "" : value)}
      />
    </FilterBar>
  );
}
