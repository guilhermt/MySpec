import {
  type KeyboardEvent,
  type ReactElement,
  type RefObject,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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

// An entry of the tree is a section header or a card row, named by what its element carries.
function entryId(row: BoardRow): string {
  return row.kind === "section" ? `section:${row.section.id}` : `card:${row.card.key}`;
}

function entryOf(element: Element): string | null {
  const key = element.getAttribute("data-row-key");
  if (key !== null) {
    return `card:${key}`;
  }
  const section = element.getAttribute("data-section-id");
  return section === null ? null : `section:${section}`;
}

function entryElement(tree: HTMLElement, id: string): HTMLElement | null {
  const [kind, ...rest] = id.split(":");
  const name = rest.join(":");
  const attribute = kind === "card" ? "data-row-key" : "data-section-id";
  return (
    Array.from(tree.querySelectorAll<HTMLElement>(`[${attribute}]`)).find(
      (element) => element.getAttribute(attribute) === name,
    ) ?? null
  );
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
  const [focused, setFocused] = useState<string | null>(null);
  const previous = useRef<readonly BoardRow[]>(rows);
  const entries = useMemo(() => rows.map(entryId), [rows]);

  // The tab stop: the entry the focus was last on, the open card, the first card, the first header.
  const tabStop = useMemo(() => {
    const visible = new Set(entries);
    return (
      [focused, openKey === null ? null : `card:${openKey}`].find(
        (id) => id !== null && visible.has(id),
      ) ??
      entries.find((id) => id.startsWith("card:")) ??
      entries[0] ??
      null
    );
  }, [entries, focused, openKey]);

  // A row that leaves takes the focus with it: it goes to the next row, the one before, or the header.
  useLayoutEffect(() => {
    const before = previous.current;
    previous.current = rows;
    if (focused === null || entries.includes(focused)) {
      return;
    }
    const active = document.activeElement;
    if (active !== null && active !== document.body && document.contains(active)) {
      return;
    }
    const index = before.findIndex((row) => entryId(row) === focused);
    const lost = before[index];
    if (lost === undefined || lost.kind !== "card") {
      return;
    }
    const alive = new Set(entries);
    const isKept = (row: BoardRow) => row.kind === "card" && alive.has(entryId(row));
    const target =
      before.slice(index + 1).find(isKept) ?? before.slice(0, index).reverse().find(isKept);
    const id = target !== undefined ? entryId(target) : `section:${lost.sectionId}`;
    const element = treeRef.current === null ? null : entryElement(treeRef.current, id);
    element?.focus();
  }, [rows, entries, focused, treeRef]);

  const focusEntry = (id: string | undefined) => {
    const element =
      id === undefined || treeRef.current === null ? null : entryElement(treeRef.current, id);
    element?.focus();
    element?.scrollIntoView?.({ block: "nearest" });
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!(event.target instanceof Element) || event.altKey || event.ctrlKey || event.metaKey) {
      return;
    }
    const element = event.target.closest("[data-row-key],[data-section-id]");
    const id = element === null ? null : entryOf(element);
    if (id === null || !event.currentTarget.contains(element)) {
      return;
    }
    const index = entries.indexOf(id);
    const row = rows[index];
    if (row === undefined) {
      return;
    }
    const header = row.kind === "section" ? row : null;

    switch (event.key) {
      case "ArrowDown":
        focusEntry(entries[Math.min(index + 1, entries.length - 1)]);
        break;
      case "ArrowUp":
        focusEntry(entries[Math.max(index - 1, 0)]);
        break;
      case "Home":
        focusEntry(entries[0]);
        break;
      case "End":
        focusEntry(entries.at(-1));
        break;
      case "ArrowLeft":
        if (header !== null) {
          if (header.section.cards.length === 0 || header.collapsed) {
            return;
          }
          onToggleSection(header.section.id);
        } else if (row.kind === "card") {
          focusEntry(`section:${row.sectionId}`);
          onToggleSection(row.sectionId);
        }
        break;
      case "ArrowRight":
        if (header === null || !header.collapsed) {
          return;
        }
        onToggleSection(header.section.id);
        break;
      case "Enter":
        if (header !== null) {
          if (header.section.cards.length === 0) {
            return;
          }
          onToggleSection(header.section.id);
        } else if (row.kind === "card") {
          onActivateCard(row.card);
        }
        break;
      default:
        return;
    }
    event.preventDefault();
  };

  return (
    <div
      ref={treeRef}
      role="tree"
      aria-label={`Cards of ${board.title}, by status`}
      aria-multiselectable={selecting || undefined}
      onKeyDown={onKeyDown}
      className="flex flex-col"
    >
      {rows.map((row) => {
        const id = entryId(row);
        const focusThis = () => setFocused(id);
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
              final={section.final}
              tooltip={sectionTooltip(section)}
              label={sectionLabel(section)}
              tabStop={id === tabStop}
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
            tabStop={id === tabStop}
            flash={newKeys.has(row.card.key)}
            onActivate={() => onActivateCard(row.card)}
            onFocus={focusThis}
          />
        );
      })}
    </div>
  );
}
