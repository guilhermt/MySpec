import { TriangleAlert } from "lucide-react";
import { type KeyboardEvent, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { Skeleton } from "@/components/ui/skeleton";
import { BoardFilterBar } from "@/features/board/BoardFilterBar";
import { BoardHeader } from "@/features/board/BoardHeader";
import {
  type BoardFilters,
  EMPTY_FILTERS,
  filterCards,
  isCheckable,
  sections,
} from "@/features/board/board-view";
import { CardDetail } from "@/features/board/CardDetail";
import { CardList } from "@/features/board/CardList";
import { SelectionBar } from "@/features/board/SelectionBar";
import { useBoardViewMemory } from "@/features/board/useBoardViewMemory";
import { useStartCard } from "@/features/board/useStartCard";
import type { Board, BoardCard } from "@/lib/wails";
import { refreshBoard } from "@/store/actions";
import { useAppStore, useBoard } from "@/store/app-store";

/** SKELETON_ROWS is how many placeholder rows stand for the cards of a board never read. */
const SKELETON_ROWS = 8;

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
    return <main className="h-dvh bg-background" />;
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
  // The cards picked for a discussion are local to the view: they go when it does.
  const [checked, setChecked] = useState<ReadonlySet<string>>(new Set());
  const cards = board.cards ?? NO_CARDS;
  const selected = cards.find((card) => card.key === memory.selectedKey) ?? null;
  const start = useStartCard(board, selected);
  const openNewDiscussion = useAppStore((state) => state.openNewDiscussion);

  // A card gone from the reading takes the selection with it.
  useEffect(() => {
    if (memory.selectedKey !== null && selected === null) {
      setMemory((current) => ({ ...current, selectedKey: null }));
    }
  }, [memory.selectedKey, selected, setMemory]);

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

  const select = (key: string | null) => setMemory((current) => ({ ...current, selectedKey: key }));
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
  const openDiscuss = (cardKeys: string[]) => openNewDiscussion({ boardId: board.id, cardKeys });

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    // Dialogs render in a portal: their keys are not the view's.
    if (!(event.target instanceof Node) || !event.currentTarget.contains(event.target)) {
      return;
    }
    if (event.key === "/" && !isTyping(event.target)) {
      event.preventDefault();
      searchRef.current?.focus();
    } else if (event.key === "Escape" && memory.selectedKey !== null) {
      event.preventDefault();
      select(null);
    }
  };

  let content: React.ReactNode;
  if (board.readAt === "" && !board.reading && board.failure !== null) {
    content = (
      <div className="flex flex-col items-start gap-2 p-4">
        <p role="alert" className="flex items-start gap-1.5 text-sm text-destructive">
          <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <span className="break-all">{board.failure.message}</span>
        </p>
        <Button variant="outline" size="sm" onClick={() => void refreshBoard(board.id)}>
          Try again
        </Button>
      </div>
    );
  } else if (board.readAt === "") {
    content = (
      <div className="flex flex-col gap-2 p-4" aria-hidden="true">
        {Array.from({ length: SKELETON_ROWS }, (_, row) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: the placeholder rows never move
          <Skeleton key={row} className="h-7" />
        ))}
      </div>
    );
  } else if (cards.length === 0) {
    content = <p className="p-4 text-sm text-muted-foreground">This board has no issues.</p>;
  } else if (filtered.length === 0) {
    content = (
      <div className="flex flex-col items-start gap-2 p-4">
        <p className="text-sm text-muted-foreground">No cards match the filters.</p>
        <Button variant="outline" size="sm" onClick={() => setFilters(EMPTY_FILTERS)}>
          Clear filters
        </Button>
      </div>
    );
  } else {
    content = (
      <ResizablePanelGroup orientation="horizontal" className="min-h-0 flex-1">
        <ResizablePanel id={LIST_PANEL} defaultSize="60%" className="min-w-0">
          <CardList
            sections={cardSections}
            collapsed={collapsed}
            selectedKey={memory.selectedKey}
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
            <ResizablePanel id={DETAIL_PANEL} defaultSize="40%" minSize="25%" className="min-w-0">
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
    );
  }

  return (
    <main
      aria-label={board.title}
      onKeyDown={onKeyDown}
      className="flex h-dvh min-w-0 flex-col bg-background"
    >
      <BoardHeader board={board} onNewDiscussion={() => openDiscuss([])} />
      <BoardFilterBar
        board={board}
        filters={memory.filters}
        onChange={setFilters}
        searchRef={searchRef}
      />
      {checked.size > 0 && (
        <SelectionBar
          count={checked.size}
          onDiscuss={() => openDiscuss([...checked])}
          onClear={clearChecked}
        />
      )}
      <div className="flex min-h-0 flex-1 flex-col">{content}</div>
    </main>
  );
}
