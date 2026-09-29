import { type KeyboardEvent, useEffect, useRef, useState } from "react";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { useNow } from "@/features/attention/useNow";
import { BoardFilterBar } from "@/features/board/BoardFilterBar";
import { BoardHeader } from "@/features/board/BoardHeader";
import {
  FailureStrip,
  NeverReadFailed,
  NoCards,
  NoMatch,
  ReadingSkeleton,
} from "@/features/board/BoardReadingStates";
import {
  type BoardFilters,
  EMPTY_FILTERS,
  filterCards,
  isCheckable,
  readingView,
  sections,
  showsFailureStrip,
} from "@/features/board/board-view";
import { CardDetail } from "@/features/board/CardDetail";
import { CardList } from "@/features/board/CardList";
import { SelectionBar } from "@/features/board/SelectionBar";
import { useBoardViewMemory } from "@/features/board/useBoardViewMemory";
import { useStartCard } from "@/features/board/useStartCard";
import type { Board, BoardCard } from "@/lib/wails";
import { refreshBoard } from "@/store/actions";
import { useAppStore, useBoard } from "@/store/app-store";

/** READING_CLOCK_MS is how often the time since the last reading is told again: a minute. */
const READING_CLOCK_MS = 60_000;

/** COLUMN is the reading column of the list: --list-measure on whole pixels, with --space-6 at each side at least. */
const COLUMN = "mx-auto w-[min(round(down,var(--list-measure),1px),100%-2*var(--space-6))]";

/** NO_CARDS stands for a board whose reading brought no cards, always the same array. */
const NO_CARDS: BoardCard[] = [];

const LIST_PANEL = "board-cards";
const DETAIL_PANEL = "board-card-detail";

export interface BoardViewProps {
  boardId: string;
}

/** BoardView is a board on screen: its cards, filtered and grouped by status, and the one open in the detail. */
export function BoardView({ boardId }: BoardViewProps) {
  const board = useBoard(boardId);

  // Opening a board reads it again; the stored reading shows meanwhile.
  useEffect(() => {
    void refreshBoard(boardId);
  }, [boardId]);

  if (board === null) {
    return <section className="min-h-0 flex-1 bg-background" />;
  }
  // Each board remembers its own filters and sections.
  return <BoardScreen key={boardId} board={board} />;
}

function isTyping(target: EventTarget): boolean {
  return (
    target instanceof HTMLElement &&
    (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)
  );
}

function BoardScreen({ board }: { board: Board }) {
  const [memory, setMemory] = useBoardViewMemory(board.id);
  const app = useAppStore((state) => state.app);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const now = useNow(READING_CLOCK_MS, board.readAt !== "" || board.failure !== null);
  // The cards picked for a discussion are local to the view: they go when it does.
  const [checked, setChecked] = useState<ReadonlySet<string>>(new Set());
  const [selectedKey, select] = useState<string | null>(null);
  const cards = board.cards ?? NO_CARDS;
  const selected = cards.find((card) => card.key === selectedKey) ?? null;
  const start = useStartCard(board, selected);
  const openNewDiscussion = useAppStore((state) => state.openNewDiscussion);

  // A card gone from the reading takes the selection with it.
  useEffect(() => {
    if (selectedKey !== null && selected === null) {
      select(null);
    }
  }, [selectedKey, selected]);

  // A card gone from the reading also leaves the selection.
  useEffect(() => {
    setChecked((current) => {
      const kept = [...current].filter((key) => cards.some((card) => card.key === key));
      return kept.length === current.size ? current : new Set(kept);
    });
  }, [cards]);

  const collapsed = new Set(memory.collapsed);
  const filtered = filterCards(board, memory.filters);
  const cardSections = sections(board, filtered);

  const setFilters = (filters: BoardFilters) => setMemory((current) => ({ ...current, filters }));
  const toggleSection = (id: string) =>
    setMemory((current) => ({
      ...current,
      collapsed: current.collapsed.includes(id)
        ? current.collapsed.filter((other) => other !== id)
        : [...current.collapsed, id],
    }));
  const startCard = (card: BoardCard) => {
    select(card.key);
    start.run(card);
  };
  const toggleChecked = (card: BoardCard) =>
    setChecked((current) => {
      const next = new Set(current);
      if (!next.delete(card.key)) {
        next.add(card.key);
      }
      return next;
    });
  const clearChecked = () => setChecked(new Set());
  const checkable = (card: BoardCard) => isCheckable(card, app, board.id);
  const openDiscuss = (cardKeys: string[]) =>
    openNewDiscussion({ boardId: board.id, cardKeys, askBoard: false });

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    // Dialogs render in a portal: their keys are not the view's.
    if (!(event.target instanceof Node) || !event.currentTarget.contains(event.target)) {
      return;
    }
    if (event.key === "/" && !isTyping(event.target)) {
      event.preventDefault();
      searchRef.current?.focus();
    } else if (event.key === "Escape" && selectedKey !== null) {
      event.preventDefault();
      select(null);
    }
  };

  const view = readingView(board, filtered);
  const checkableCards = filtered.filter(checkable);
  const selectDisabledReason =
    board.readAt === ""
      ? "the board hasn't been read yet"
      : checked.size > 0
        ? "already selecting"
        : checkableCards.length === 0
          ? "no card to select"
          : null;
  // The list takes the focus at its tab stop.
  const focusList = () =>
    listRef.current?.querySelector<HTMLElement>('[role="tree"] [tabindex="0"]')?.focus();

  let content: React.ReactNode = null;
  if (view.kind === "skeleton") {
    content = <ReadingSkeleton />;
  } else if (view.kind === "never-read-failed") {
    content = <NeverReadFailed board={board} />;
  } else if (view.kind === "no-cards") {
    content = <NoCards onNewDiscussion={() => openDiscuss([])} />;
  } else if (view.kind === "no-match") {
    content = (
      <NoMatch board={board} filters={memory.filters} onClear={() => setFilters(EMPTY_FILTERS)} />
    );
  }

  return (
    <section
      aria-label={board.title}
      onKeyDown={onKeyDown}
      className="flex min-h-0 min-w-0 flex-1 flex-col bg-surface-1"
    >
      <BoardHeader
        board={board}
        now={now}
        onNewDiscussion={() => openDiscuss([])}
        onEnterSelect={focusList}
        selectDisabledReason={selectDisabledReason}
      />
      <div className="board-list-area shrink-0">
        <div className={COLUMN}>
          {showsFailureStrip(board) && <FailureStrip board={board} now={now} />}
          {board.readAt !== "" && cards.length > 0 && (
            <BoardFilterBar
              board={board}
              filters={memory.filters}
              onChange={setFilters}
              searchRef={searchRef}
              onSearchEscape={(event) => {
                event.preventDefault();
                focusList();
              }}
              onSearchDown={focusList}
            />
          )}
          {content}
        </div>
      </div>
      {checked.size > 0 && (
        <SelectionBar
          count={checked.size}
          onDiscuss={() => openDiscuss([...checked])}
          onClear={clearChecked}
        />
      )}
      <div ref={listRef} className="flex min-h-0 flex-1 flex-col">
        {view.kind === "list" && (
          <ResizablePanelGroup orientation="horizontal" className="min-h-0 flex-1">
            <ResizablePanel id={LIST_PANEL} defaultSize="60%" className="min-w-0">
              <CardList
                sections={cardSections}
                collapsed={collapsed}
                selectedKey={selectedKey}
                onToggleSection={toggleSection}
                onSelect={select}
                onStart={startCard}
                checked={checked}
                isCheckable={checkable}
                onToggleChecked={toggleChecked}
                onDiscuss={(card) => openDiscuss(card === null ? [...checked] : [card.key])}
              />
            </ResizablePanel>
            {selected !== null && (
              <>
                <ResizableHandle />
                <ResizablePanel
                  id={DETAIL_PANEL}
                  defaultSize="40%"
                  minSize="25%"
                  className="min-w-0"
                >
                  <CardDetail
                    board={board}
                    card={selected}
                    start={start}
                    onClose={() => select(null)}
                    onSelect={select}
                    onDiscuss={() => openDiscuss([selected.key])}
                  />
                </ResizablePanel>
              </>
            )}
          </ResizablePanelGroup>
        )}
      </div>
    </section>
  );
}
