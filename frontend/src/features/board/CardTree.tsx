import { type ReactElement, type RefObject, useMemo } from "react";
import { TONE_GLYPHS } from "@/components/system/item-parts";
import {
  CardRow,
  type CardRowTask,
  type CardRowView,
  type RowSelection,
} from "@/components/system/ListRow";
import { ListSectionHeader } from "@/components/system/ListSectionHeader";
import {
  type BoardRow,
  type CardRowModel,
  sectionLabel,
  sectionTooltip,
  selectionSuffix,
} from "@/features/board/board-view";
import { entryId, type ListTreeEntry, useListTree } from "@/features/board/useListTree";
import type { Board, BoardCard } from "@/lib/wails";

export interface CardTreeProps {
  board: Board;
  rows: readonly BoardRow[];
  models: ReadonlyMap<string, CardRowModel>;
  openKey: string | null;
  selecting: boolean;
  /** checked is the keys of the selected cards, in the order they were marked. */
  checked: readonly string[];
  checkable: (card: BoardCard) => boolean;
  /** newKeys are the cards a new reading brought, which flash. */
  newKeys: ReadonlySet<string>;
  treeRef: RefObject<HTMLDivElement | null>;
  onToggleSection: (id: string) => void;
  /** onActivateCard opens or closes a card, or toggles it in the select mode. */
  onActivateCard: (card: BoardCard) => void;
}

// entryOf is a row of the board as the tree walks it.
function entryOf(row: BoardRow): ListTreeEntry {
  return row.kind === "section"
    ? {
        kind: "section",
        id: row.section.id,
        foldable: row.section.cards.length > 0,
        collapsed: row.collapsed,
      }
    : { kind: "item", key: row.card.key, sectionId: row.sectionId };
}

function rowView(model: CardRowModel, selection: RowSelection | null): CardRowView {
  const task: CardRowTask | null =
    model.task?.kind === "task"
      ? { ...model.task, kind: "task", glyph: TONE_GLYPHS[model.task.tone] }
      : model.task;
  return {
    ...model,
    task,
    label: selection === null ? model.label : `${model.label}${selectionSuffix(selection)}`,
  };
}

/**
 * CardTree is the list of a board as a tree: the section headers and the card rows side by side, with
 * one tab stop and the arrows walking the rows. The view handles the letters.
 */
export function CardTree({
  board,
  rows,
  models,
  openKey,
  selecting,
  checked,
  checkable,
  newKeys,
  treeRef,
  onToggleSection,
  onActivateCard,
}: CardTreeProps): ReactElement {
  const entries = useMemo(() => rows.map(entryOf), [rows]);
  const cards = useMemo(
    () =>
      new Map(
        rows.flatMap((row) => (row.kind === "card" ? [[row.card.key, row.card] as const] : [])),
      ),
    [rows],
  );
  const tree = useListTree({
    entries,
    openKey,
    treeRef,
    onToggleSection,
    onActivateItem: (key) => {
      const card = cards.get(key);
      if (card !== undefined) {
        onActivateCard(card);
      }
    },
  });

  return (
    <div
      ref={treeRef}
      role="tree"
      aria-label={`Cards of ${board.title}, by status`}
      aria-multiselectable={selecting || undefined}
      onKeyDown={tree.onKeyDown}
      className="flex flex-col"
    >
      {rows.map((row) => {
        const id = entryId(entryOf(row));
        const focusThis = () => tree.onEntryFocus(id);
        if (row.kind === "section") {
          const { section } = row;
          return (
            <ListSectionHeader
              key={id}
              id={section.id}
              name={section.name}
              count={section.cards.length}
              collapsed={row.collapsed}
              empty={section.cards.length === 0}
              tooltip={sectionTooltip(section)}
              label={sectionLabel(section)}
              tabStop={id === tree.tabStop}
              onToggle={() => onToggleSection(section.id)}
              onFocus={focusThis}
            />
          );
        }
        const model = models.get(row.card.key);
        if (model === undefined) {
          return null;
        }
        const selection: RowSelection | null = !selecting
          ? null
          : !checkable(row.card)
            ? "can't be selected"
            : checked.includes(row.card.key)
              ? "selected"
              : "not selected";
        return (
          <CardRow
            key={id}
            model={rowView(model, selection)}
            open={row.card.key === openKey}
            selection={selection}
            tabStop={id === tree.tabStop}
            flash={newKeys.has(row.card.key)}
            onActivate={() => onActivateCard(row.card)}
            onFocus={focusThis}
          />
        );
      })}
    </div>
  );
}
