import type { GoneAction } from "@/components/system/GonePage";
import { GonePage } from "@/components/system/GonePage";
import { ICONS, type IconGlyph } from "@/components/system/icons";
import { LocationHeader } from "@/features/navigation/LocationHeader";
import { findBoard } from "@/lib/boards";
import {
  type GoneLocation,
  type GoneOutcome,
  goneOutcome,
  goneTitle,
  type Location,
  locationTitle,
} from "@/lib/locations";
import { nextWaiting } from "@/lib/situations";
import { useAppStore, useBackTarget } from "@/store/app-store";

export interface GoneViewProps {
  location: GoneLocation;
}

const ICON: Record<GoneOutcome, IconGlyph> = {
  archived: ICONS.archive,
  deleted: ICONS.trash,
  merged: ICONS.merge,
  closed: ICONS.merge,
  removed: ICONS.board,
};

// The archived item the page of an item that left opens in the History.
function archivedOf(item: Exclude<GoneLocation["item"], "board">, id: string): Location {
  switch (item) {
    case "task":
      return { kind: "archived-task", id };
    case "review":
      return { kind: "archived-review", id };
    case "discussion":
      return { kind: "archived-discussion", id };
  }
}

/**
 * GoneView is the place of an item that left while open: what became of it, read from the state,
 * and the ways on from there.
 */
export function GoneView({ location }: GoneViewProps) {
  const app = useAppStore((state) => state.app);
  const go = useAppStore((state) => state.go);
  const goBack = useAppStore((state) => state.goBack);
  const openSituation = useAppStore((state) => state.openSituation);
  const backTarget = useBackTarget();
  const outcome = goneOutcome(app, location);

  const actions: GoneAction[] = [];
  if (location.item === "board") {
    actions.push(
      backTarget === null
        ? { label: "Back to Home", onClick: () => go({ kind: "home" }, { focus: "title" }) }
        : {
            label: `Back to ${locationTitle(app, backTarget)}`,
            onClick: () => goBack({ focus: "title" }),
          },
    );
  } else {
    const next = nextWaiting(app, null);
    actions.push(
      next === null
        ? {
            label: "Next that needs you",
            onClick: () => {},
            disabledReason: "Nothing else needs you now.",
          }
        : {
            label: "Next that needs you",
            onClick: () => openSituation(next.itemId, next.situation.place),
            tooltip: `Next: ${next.name}`,
            shortcut: "Ctrl+J",
          },
    );
    if (outcome !== "deleted") {
      const archived = archivedOf(location.item, location.id);
      actions.push({
        label: "Open in History",
        onClick: () => go(archived, { focus: "title" }),
      });
    }
    actions.push(returnAction(location, findBoard(app, location.boardId)?.title ?? null, go));
  }

  return (
    <section aria-label={location.name} className="flex min-h-0 flex-1 flex-col">
      <LocationHeader />
      <GonePage icon={ICON[outcome]} title={goneTitle(location, outcome)} actions={actions} />
    </section>
  );
}

// The way back from the page: the board the item lived under, Reviews, or Home.
function returnAction(
  location: GoneLocation,
  boardTitle: string | null,
  go: (location: Location, options?: { focus?: "title" }) => void,
): GoneAction {
  const home: GoneAction = {
    label: "Back to Home",
    onClick: () => go({ kind: "home" }, { focus: "title" }),
  };
  if (location.item === "review") {
    return { label: "Back to Reviews", onClick: () => go({ kind: "reviews" }, { focus: "title" }) };
  }
  if (boardTitle === null) {
    return home;
  }
  const board: Location = { kind: "board", id: location.boardId };
  return {
    label: location.item === "task" ? `Back to ${boardTitle}` : `Open ${boardTitle}`,
    onClick: () => go(board, { focus: "title" }),
  };
}
