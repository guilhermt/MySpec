import { ChevronRight } from "lucide-react";
import { type KeyboardEvent, useRef, useState } from "react";
import { type CardSection, visibleCards } from "@/features/board/board-view";
import { CardRow } from "@/features/board/CardRow";
import { cn } from "@/lib/utils";
import type { BoardCard } from "@/lib/wails";

/** STARTABLE are the actions the S key runs: those that open the dialog or ask something first. */
const STARTABLE: ReadonlySet<string> = new Set(["start", "clone", "add_to_board"]);

export interface CardListProps {
  sections: readonly CardSection[];
  collapsed: ReadonlySet<string>;
  selectedKey: string | null;
  onToggleSection: (id: string) => void;
  onSelect: (key: string) => void;
  /** onStart runs Start task for a card, as the S key asks. */
  onStart: (card: BoardCard) => void;
  /** checked is the keys of the cards picked for a discussion. */
  checked: ReadonlySet<string>;
  /** isCheckable tells whether a card can be picked for a discussion. */
  isCheckable: (card: BoardCard) => boolean;
  onToggleChecked: (card: BoardCard) => void;
  /**
   * onDiscuss opens a discussion, as the D key asks: of the whole selection,
   * which only the view knows, or of the given card when nothing is selected.
   */
  onDiscuss: (card: BoardCard | null) => void;
}

/** CardList is the cards of a board view, grouped in collapsible sections by status. */
export function CardList({
  sections,
  collapsed,
  selectedKey,
  onToggleSection,
  onSelect,
  onStart,
  checked,
  isCheckable,
  onToggleChecked,
  onDiscuss,
}: CardListProps) {
  const treeRef = useRef<HTMLDivElement>(null);
  const [focusedKey, setFocusedKey] = useState<string | null>(null);
  const visible = visibleCards(sections, collapsed);
  // The tab stop is the card the focus was last on, then the selected one, then the first.
  const tabStop =
    [focusedKey, selectedKey].find((key) => visible.some((card) => card.key === key)) ??
    visible[0]?.key ??
    null;

  const focusCard = (card: BoardCard | undefined) => {
    if (card === undefined) {
      return;
    }
    setFocusedKey(card.key);
    treeRef.current?.querySelector<HTMLElement>(`[data-card-key="${card.key}"]`)?.focus();
  };

  const focusHeader = (sectionId: string) => {
    treeRef.current?.querySelector<HTMLElement>(`[data-section-header="${sectionId}"]`)?.focus();
  };

  // A section header stands between the cards of the sections before and after it.
  const neighbour = (sectionId: string, direction: 1 | -1): BoardCard | undefined => {
    const at = sections.findIndex((section) => section.id === sectionId);
    const offset = visibleCards(sections.slice(0, at), collapsed).length;
    return direction === 1 ? visible[offset] : visible[offset - 1];
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    // A key with a modifier is a shortcut of the app, as Alt+arrows for the history.
    if (!(event.target instanceof HTMLElement) || event.altKey || event.ctrlKey || event.metaKey) {
      return;
    }
    const cardKey = event.target.closest("[data-card-key]")?.getAttribute("data-card-key") ?? null;
    const sectionId =
      event.target.closest("[data-section-id]")?.getAttribute("data-section-id") ?? null;
    const index = visible.findIndex((card) => card.key === cardKey);
    const card = visible[index];

    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        focusCard(
          card !== undefined
            ? visible[Math.min(index + 1, visible.length - 1)]
            : sectionId !== null
              ? neighbour(sectionId, 1)
              : visible[0],
        );
        break;
      case "ArrowUp":
        event.preventDefault();
        focusCard(
          card !== undefined
            ? visible[Math.max(index - 1, 0)]
            : sectionId !== null
              ? neighbour(sectionId, -1)
              : visible[0],
        );
        break;
      case "ArrowLeft":
        if (sectionId === null) {
          return;
        }
        event.preventDefault();
        if (!collapsed.has(sectionId)) {
          onToggleSection(sectionId);
        }
        focusHeader(sectionId);
        break;
      case "ArrowRight":
        if (sectionId === null) {
          return;
        }
        event.preventDefault();
        if (collapsed.has(sectionId)) {
          onToggleSection(sectionId);
        }
        break;
      case "Enter":
        if (card === undefined) {
          return;
        }
        event.preventDefault();
        onSelect(card.key);
        break;
      case " ": {
        // With the focus on the checkbox itself the key is already its own.
        if (card === undefined || !event.target.hasAttribute("data-card-key")) {
          return;
        }
        if (!isCheckable(card)) {
          return;
        }
        event.preventDefault();
        onToggleChecked(card);
        break;
      }
      case "d":
      case "D": {
        // The selection comes first; with none, the card under the focus discusses alone.
        if (checked.size === 0 && (card === undefined || !isCheckable(card))) {
          return;
        }
        event.preventDefault();
        onDiscuss(checked.size > 0 ? null : (card ?? null));
        break;
      }
      case "s":
      case "S":
        if (card === undefined || !STARTABLE.has(card.action)) {
          return;
        }
        event.preventDefault();
        onStart(card);
        break;
      default:
        break;
    }
  };

  return (
    <div
      ref={treeRef}
      role="tree"
      aria-label="Cards"
      onKeyDown={onKeyDown}
      className="flex h-full flex-col gap-1 overflow-y-auto p-2"
    >
      {sections.map((section) => {
        const expanded = !collapsed.has(section.id);
        return (
          // biome-ignore lint/a11y/useFocusableInteractive: the header button of the section takes the focus
          <div
            key={section.id}
            role="treeitem"
            aria-label={section.name}
            aria-expanded={expanded}
            aria-selected={false}
            data-section-id={section.id}
            className="flex flex-col"
          >
            <button
              type="button"
              data-section-header={section.id}
              onClick={() => onToggleSection(section.id)}
              className="flex h-8 items-center gap-1.5 rounded-md px-1 text-sm font-medium outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ChevronRight
                aria-hidden="true"
                className={cn(
                  "size-4 text-muted-foreground transition-transform duration-[var(--duration-fast)]",
                  expanded && "rotate-90",
                )}
              />
              <span>{section.name}</span>
              <span className="text-xs text-muted-foreground tabular-nums">
                {section.cards.length}
              </span>
            </button>
            {expanded && (
              // biome-ignore lint/a11y/useSemanticElements: a fieldset groups form controls, not the rows of a tree
              <div role="group" className="flex flex-col">
                {section.cards.map((card) => (
                  <CardRow
                    key={card.key}
                    card={card}
                    finalSection={section.final}
                    selected={card.key === selectedKey}
                    focusable={card.key === tabStop}
                    checked={checked.has(card.key)}
                    checkable={isCheckable(card)}
                    onCheckedChange={() => onToggleChecked(card)}
                    onSelect={() => {
                      setFocusedKey(card.key);
                      onSelect(card.key);
                    }}
                    onFocus={() => setFocusedKey(card.key)}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
