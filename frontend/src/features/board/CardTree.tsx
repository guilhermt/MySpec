import {
  type ReactElement,
  type Ref,
  type RefObject,
  useCallback,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
} from "react";
import { TONE_GLYPHS } from "@/components/system/item-parts";
import {
  CardRow,
  type CardRowTask,
  type CardRowView,
  type RowSelection,
} from "@/components/system/ListRow";
import { ListSectionHeader } from "@/components/system/ListSectionHeader";
import { useWindowedRows } from "@/components/system/useWindowedRows";
import {
  type BoardRow,
  type CardRowModel,
  sectionLabel,
  sectionTooltip,
  selectionSuffix,
} from "@/features/board/board-view";
import { entryId, type ListTreeEntry, useListTree } from "@/features/board/useListTree";
import type { Board, BoardCard } from "@/lib/wails";

/** HEADER_PX is the height of a section header: --size-node. */
const HEADER_PX = 28;
/** ROW_PX is the height of a card row on one line: --size-control. */
const ROW_PX = 32;
/** TWO_LINE_ROW_PX is the height of a card row on two lines, in a list narrower than TWO_LINES_BELOW_PX (components.md, Linha de lista). */
const TWO_LINE_ROW_PX = 52;
/** TWO_LINES_BELOW_PX is the width of the list from which a card row takes one line: the row's container query holds up to 1041 px. */
const TWO_LINES_BELOW_PX = 1042;
/** LIST_GUTTER_PX is what the list column leaves at both sides of the scroll area: 2 × --space-6. */
const LIST_GUTTER_PX = 48;
/** OVERSCAN is how many rows are mounted past each end of what shows. */
const OVERSCAN = 20;

/** CardTreeHandle is what a view asks of the tree: the focus on a row the window may not have mounted. */
export interface CardTreeHandle {
  /** focusKey brings a card into view and focuses its row, false when the card has no row. */
  focusKey: (key: string) => boolean;
}

export interface CardTreeProps {
  board: Board;
  rows: readonly BoardRow[];
  /** modelOf is the model of a card's row, asked only for the rows that are mounted. */
  modelOf: (card: BoardCard) => CardRowModel;
  /** scrollRef is the element that scrolls the list, and stickyRef the bar that sticks over it. */
  scrollRef: RefObject<HTMLElement | null>;
  stickyRef: RefObject<HTMLElement | null>;
  ref?: Ref<CardTreeHandle>;
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

// Where a row sits among its siblings: a header among the headers, a card among the cards of its section.
interface Position {
  level: number;
  setSize: number;
  posInSet: number;
}

function positionsOf(rows: readonly BoardRow[]): Map<number, Position> {
  const headers = rows.filter((row) => row.kind === "section").length;
  const cardsOf = new Map<string, number>();
  for (const row of rows) {
    if (row.kind === "card") {
      cardsOf.set(row.sectionId, (cardsOf.get(row.sectionId) ?? 0) + 1);
    }
  }
  const positions = new Map<number, Position>();
  const seen = new Map<string, number>();
  let header = 0;
  rows.forEach((row, index) => {
    if (row.kind === "section") {
      positions.set(index, { level: 1, setSize: headers, posInSet: ++header });
    } else {
      const posInSet = (seen.get(row.sectionId) ?? 0) + 1;
      seen.set(row.sectionId, posInSet);
      positions.set(index, { level: 2, setSize: cardsOf.get(row.sectionId) ?? 0, posInSet });
    }
  });
  return positions;
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
 * one tab stop and the arrows walking the rows. It is windowed: only the rows that show, the tab stop
 * and the open card are mounted, between spacers. The view handles the letters.
 */
export function CardTree({
  board,
  rows,
  modelOf,
  scrollRef,
  stickyRef,
  ref,
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
  const ids = useMemo(() => entries.map(entryId), [entries]);
  const positions = useMemo(() => positionsOf(rows), [rows]);
  const cards = useMemo(
    () =>
      new Map(
        rows.flatMap((row) => (row.kind === "card" ? [[row.card.key, row.card] as const] : [])),
      ),
    [rows],
  );
  const openIndex = useMemo(
    () => rows.findIndex((row) => row.kind === "card" && row.card.key === openKey),
    [rows, openKey],
  );

  const keyOf = useCallback((index: number) => ids[index] ?? "", [ids]);
  const estimate = useCallback(
    (index: number) => {
      if (rows[index]?.kind === "section") {
        return HEADER_PX;
      }
      const width = scrollRef.current?.clientWidth ?? TWO_LINES_BELOW_PX + LIST_GUTTER_PX;
      return width - LIST_GUTTER_PX >= TWO_LINES_BELOW_PX ? ROW_PX : TWO_LINE_ROW_PX;
    },
    [rows, scrollRef],
  );

  // The tree walks by index and the window mounts by index: each is told of the other by a ref,
  // since the window pins the tab stop the tree names and the tree scrolls through the window.
  const scrollTo = useRef<(index: number) => void>(undefined);
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
    scrollToIndex: (index) => scrollTo.current?.(index),
  });
  const windowed = useWindowedRows({
    count: rows.length,
    keyOf,
    estimate,
    pinned: [tree.tabStopIndex, openIndex],
    scrollRef,
    listRef: treeRef,
    stickyRef,
    overscan: OVERSCAN,
  });
  useLayoutEffect(() => {
    scrollTo.current = windowed.scrollToIndex;
  }, [windowed.scrollToIndex]);

  useImperativeHandle(
    ref,
    () => ({
      focusKey: (key) => {
        const index = ids.indexOf(`item:${key}`);
        if (index < 0) {
          return false;
        }
        tree.focusIndex(index);
        return true;
      },
    }),
    [ids, tree],
  );

  // The rows get the same functions whatever the render, so a row that did not change is not drawn
  // again; they read the latest of what the view gives and of the rows.
  const latest = useRef({ cards, onActivateCard });
  useLayoutEffect(() => {
    latest.current = { cards, onActivateCard };
  });
  const activateRow = useCallback((key: string) => {
    const card = latest.current.cards.get(key);
    if (card !== undefined) {
      latest.current.onActivateCard(card);
    }
  }, []);
  const focusRow = useCallback(
    (key: string) => tree.onEntryFocus(`item:${key}`),
    [tree.onEntryFocus],
  );

  // The models and their views are made for the rows that mount, and kept for a card while the
  // function that makes them stays the same.
  // biome-ignore lint/correctness/useExhaustiveDependencies: a new modelOf makes every model again
  const made = useMemo(
    () =>
      new Map<BoardCard, { model: CardRowModel; views: Map<RowSelection | null, CardRowView> }>(),
    [modelOf],
  );
  const viewOf = (card: BoardCard, selection: RowSelection | null): CardRowView => {
    let entry = made.get(card);
    if (entry === undefined) {
      entry = { model: modelOf(card), views: new Map() };
      made.set(card, entry);
    }
    let view = entry.views.get(selection);
    if (view === undefined) {
      view = rowView(entry.model, selection);
      entry.views.set(selection, view);
    }
    return view;
  };

  return (
    <div
      ref={treeRef}
      role="tree"
      aria-label={`Cards of ${board.title}, by status`}
      aria-multiselectable={selecting || undefined}
      onKeyDown={tree.onKeyDown}
      className="flex flex-col"
    >
      {windowed.parts.map((part) => {
        if (part.kind === "spacer") {
          return (
            <div key={part.key} aria-hidden="true" role="none" style={{ height: part.height }} />
          );
        }
        const row = rows[part.index];
        const position = positions.get(part.index);
        if (row === undefined || position === undefined) {
          return null;
        }
        if (row.kind === "section") {
          const { section } = row;
          return (
            <ListSectionHeader
              key={part.key}
              ref={windowed.measureRef}
              index={part.index}
              id={section.id}
              name={section.name}
              count={section.cards.length}
              collapsed={row.collapsed}
              empty={section.cards.length === 0}
              tooltip={sectionTooltip(section)}
              label={sectionLabel(section)}
              tabStop={part.key === tree.tabStop}
              setSize={position.setSize}
              posInSet={position.posInSet}
              onToggle={() => onToggleSection(section.id)}
              onFocus={() => tree.onEntryFocus(part.key)}
            />
          );
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
            key={part.key}
            ref={windowed.measureRef}
            index={part.index}
            model={viewOf(row.card, selection)}
            open={row.card.key === openKey}
            selection={selection}
            tabStop={part.key === tree.tabStop}
            flash={newKeys.has(row.card.key)}
            level={position.level}
            setSize={position.setSize}
            posInSet={position.posInSet}
            onActivate={activateRow}
            onFocus={focusRow}
          />
        );
      })}
    </div>
  );
}
