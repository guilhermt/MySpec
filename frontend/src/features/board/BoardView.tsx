import { type KeyboardEvent, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { PanelLayout } from "@/components/system/AuxPanel";
import { STICKY_FADE } from "@/components/system/FilterBar";
import { KeyNotice, useKeyNotice } from "@/components/system/KeyNotice";
import { isTyping } from "@/components/system/keys";
import { LIST_COLUMN } from "@/components/system/ListPanel";
import { ScrollArea } from "@/components/system/ScrollArea";
import { SelectionBar } from "@/components/system/SelectionBar";
import { useNow } from "@/features/attention/useNow";
import { BoardCardPanel } from "@/features/board/BoardCardPanel";
import { BoardFilterBar } from "@/features/board/BoardFilterBar";
import { BoardHeader, NEW_DISCUSSION_ID } from "@/features/board/BoardHeader";
import {
  FailureStrip,
  NeverReadFailed,
  NoCards,
  NoMatch,
  ReadingSkeleton,
} from "@/features/board/BoardReadingStates";
import {
  type BoardFilters,
  boardRows,
  cardRowModel,
  discussNotice,
  EMPTY_FILTERS,
  epicChildren,
  filterCards,
  filteredTooltip,
  filtersActive,
  isCheckable,
  newDiscussionNotice,
  readingView,
  sections,
  selectNotice,
  startNotice,
} from "@/features/board/board-view";
import { CardTree, type CardTreeHandle } from "@/features/board/CardTree";
import { useBoardViewMemory } from "@/features/board/useBoardViewMemory";
import { useStartCard } from "@/features/board/useStartCard";
import { FLASH_MS } from "@/lib/situations";
import { cn } from "@/lib/utils";
import type { Board, BoardCard } from "@/lib/wails";
import { refreshBoard } from "@/store/actions";
import { useAppStore, useBoard, useRepository } from "@/store/app-store";

/** READING_CLOCK_MS is how often the time since the last reading is told again: a minute. */
const READING_CLOCK_MS = 60_000;

/** NO_CARDS stands for a board whose reading brought no cards, always the same array. */
const NO_CARDS: BoardCard[] = [];

const NO_KEYS: ReadonlySet<string> = new Set();

export interface BoardViewProps {
  boardId: string;
}

/** BoardView is a board on screen: its cards, filtered and grouped by status, and the one open in the panel. */
export function BoardView({ boardId }: BoardViewProps) {
  const board = useBoard(boardId);

  // Opening a board reads it again; the stored reading shows meanwhile.
  useEffect(() => {
    void refreshBoard(boardId);
  }, [boardId]);

  if (board === null) {
    return <section className="min-h-0 flex-1" />;
  }
  // Each board remembers its own filters and sections.
  return <BoardScreen key={boardId} board={board} />;
}

function BoardScreen({ board }: { board: Board }) {
  const [memory, setMemory] = useBoardViewMemory(board.id);
  const app = useAppStore((state) => state.app);
  const openNewDiscussion = useAppStore((state) => state.openNewDiscussion);
  const boardCardRequest = useAppStore((state) => state.boardCardRequest);
  const clearBoardCardRequest = useAppStore((state) => state.clearBoardCardRequest);
  const searchRef = useRef<HTMLInputElement>(null);
  const treeRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const treeHandle = useRef<CardTreeHandle>(null);
  // The list is windowed: the window reads the element that scrolls and the bar that sticks over it.
  const scrollRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const now = useNow(READING_CLOCK_MS, board.readAt !== "" || board.failure !== null);
  const notice = useKeyNotice();
  const cards = board.cards ?? NO_CARDS;

  const [openKey, setOpenKey] = useState<string | null>(null);
  // The last card opened: a reading without it leaves it here, out of the reading.
  const [openCard, setOpenCard] = useState<BoardCard | null>(null);
  const [selecting, setSelecting] = useState(false);
  const [checked, setChecked] = useState<string[]>([]);
  const [cloneFor, setCloneFor] = useState<{ key: string } | null>(null);
  const [newKeys, setNewKeys] = useState<ReadonlySet<string>>(NO_KEYS);
  const start = useStartCard(board, openCard, (key) => setCloneFor({ key }));

  const cardKeys = useMemo(() => new Set(cards.map((card) => card.key)), [cards]);

  // A new reading refreshes the open card, and takes from the selection the cards it lost.
  useEffect(() => {
    setOpenCard((current) => cards.find((card) => card.key === current?.key) ?? current);
    setChecked((current) => {
      const kept = current.filter((key) => cardKeys.has(key));
      return kept.length === current.length ? current : kept;
    });
  }, [cards, cardKeys]);

  // The cards a reading brings that the one before did not have flash, when it had any.
  const readKeys = useRef(cardKeys);
  useEffect(() => {
    const before = readKeys.current;
    readKeys.current = cardKeys;
    const brought = [...cardKeys].filter((key) => !before.has(key));
    if (before.size === 0 || brought.length === 0) {
      return;
    }
    setNewKeys(new Set(brought));
  }, [cardKeys]);

  // The flash ends on its own timer, which a later reading does not cancel.
  useEffect(() => {
    if (newKeys.size === 0) {
      return;
    }
    const timer = setTimeout(() => setNewKeys(NO_KEYS), FLASH_MS);
    return () => clearTimeout(timer);
  }, [newKeys]);

  const collapsed = useMemo(() => new Set(memory.collapsed), [memory.collapsed]);
  const filtered = useMemo(() => filterCards(board, memory.filters), [board, memory.filters]);
  const rows = useMemo(
    () => boardRows(sections(board, filtered), collapsed),
    [board, filtered, collapsed],
  );
  const children = useMemo(() => epicChildren(cards), [cards]);

  const cloneCard =
    cloneFor === null ? null : (cards.find((card) => card.key === cloneFor.key) ?? null);
  const cloneRepository = useRepository(cloneCard?.repositoryId ?? "");
  const cloneState: "cloning" | "failed" | null =
    cloneFor === null
      ? null
      : cloneRepository?.cloning
        ? "cloning"
        : (cloneRepository?.cloneError ?? "") !== "" ||
            (start.error !== null && openKey === cloneFor.key)
          ? "failed"
          : null;
  const cloneKey = cloneFor?.key ?? null;
  // modelOf makes the model of a row, for the rows the window mounts.
  const modelOf = useMemo(() => {
    if (app === null) {
      return null;
    }
    const ctx = {
      app,
      board,
      now,
      children,
      cloneFor:
        cloneKey === null || cloneState === null ? null : { key: cloneKey, state: cloneState },
    };
    return (card: BoardCard) => cardRowModel(card, ctx);
  }, [app, board, now, children, cloneKey, cloneState]);

  const checkable = (card: BoardCard) => isCheckable(card, app, board.id);
  const setFilters = (filters: BoardFilters) => setMemory((current) => ({ ...current, filters }));
  const toggleSection = (id: string) =>
    setMemory((current) => ({
      ...current,
      collapsed: current.collapsed.includes(id)
        ? current.collapsed.filter((other) => other !== id)
        : [...current.collapsed, id],
    }));
  const discuss = (cardKeys: string[]) =>
    openNewDiscussion({ boardId: board.id, cardKeys, askBoard: false });

  // focusRow focuses the row of a card, mounting it when the window has not; without a card, or
  // without its row, the focus goes to the tab stop.
  const focusRow = (key: string | null) => {
    if (key !== null && treeHandle.current?.focusKey(key) === true) {
      return;
    }
    treeRef.current?.querySelector<HTMLElement>('[tabindex="0"]')?.focus();
  };
  const openInPanel = (card: BoardCard) => {
    setOpenKey(card.key);
    setOpenCard(card);
  };
  // closePanel closes the card; the focus goes back to its row only when it was in the panel, and a
  // focus on the list stays where it is.
  const closePanel = () => {
    const inPanel = panelRef.current?.contains(document.activeElement) === true;
    setOpenKey(null);
    setOpenCard(null);
    if (inPanel) {
      focusRow(openKey);
    }
  };
  // revealCard opens a card of the reading in the panel with its section expanded; the focus goes to
  // its row once it is drawn, or, with fromRequest, to the panel when a filter hides the row.
  const reveal = useRef<{ key: string; fromRequest: boolean } | null>(null);
  const [revealed, setRevealed] = useState(0);
  const revealCard = (key: string, fromRequest: boolean) => {
    const card = cards.find((candidate) => candidate.key === key);
    if (card === undefined) {
      return;
    }
    const section = sections(board, cards).find((candidate) =>
      candidate.cards.some((member) => member.key === key),
    );
    if (section !== undefined && collapsed.has(section.id)) {
      toggleSection(section.id);
    }
    openInPanel(card);
    reveal.current = { key, fromRequest };
    setRevealed((count) => count + 1);
  };
  // biome-ignore lint/correctness/useExhaustiveDependencies: it runs when a reveal is asked for, once the rows are drawn
  useLayoutEffect(() => {
    const target = reveal.current;
    if (target === null) {
      return;
    }
    reveal.current = null;
    if (treeHandle.current?.focusKey(target.key) !== true && target.fromRequest) {
      requestAnimationFrame(() => {
        const panel = document.querySelector(".list-panel");
        (
          panel?.querySelector<HTMLElement>(
            '[data-panel-actions] button:not([aria-disabled="true"]):not([aria-busy="true"])',
          ) ?? panel?.querySelector<HTMLElement>('button[aria-label="Close"]')
        )?.focus();
      });
    }
  }, [revealed]);
  // The board a task's card panel or a discussion asked for opens the card here.
  // biome-ignore lint/correctness/useExhaustiveDependencies: the request is taken once, when it arrives
  useEffect(() => {
    if (boardCardRequest?.boardId !== board.id) {
      return;
    }
    revealCard(boardCardRequest.key, true);
    clearBoardCardRequest();
  }, [boardCardRequest]);

  // The panel mounts after the key that opened it: the focus waits a frame.
  const focusPrimary = () =>
    requestAnimationFrame(() =>
      document.querySelector<HTMLElement>(".list-panel [data-primary]")?.focus(),
    );
  const enterSelecting = () => {
    setSelecting(true);
    setChecked([]);
    setOpenKey(null);
    setOpenCard(null);
    requestAnimationFrame(() => focusRow(null));
  };
  const toggleChecked = (card: BoardCard, anchor: Element | null) => {
    const text = app === null ? null : selectNotice(card, app, board.id);
    if (text !== null) {
      notice.show(anchor ?? treeRef.current ?? document.body, text);
      return;
    }
    setChecked((current) =>
      current.includes(card.key)
        ? current.filter((key) => key !== card.key)
        : [...current, card.key],
    );
  };
  const activateCard = (card: BoardCard) => {
    if (selecting) {
      toggleChecked(card, treeRef.current?.querySelector(`[data-row-key="${card.key}"]`) ?? null);
    } else if (openKey === card.key) {
      setOpenKey(null);
      setOpenCard(null);
    } else {
      openInPanel(card);
    }
  };
  const startCard = (card: BoardCard) => {
    if (card.action === "clone" || card.action === "add_to_board") {
      openInPanel(card);
    }
    if (start.run(card) === "focus-primary") {
      focusPrimary();
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    const target = event.target;
    // Dialogs and menus render in a portal: their keys are not the view's.
    if (!(target instanceof Element) || !event.currentTarget.contains(target)) {
      return;
    }
    if (event.altKey || event.ctrlKey || event.metaKey || isTyping(target) || app === null) {
      return;
    }
    if (event.key === "Escape") {
      if (notice.notice !== null) {
        notice.hide();
      } else if (openKey !== null) {
        closePanel();
      } else if (selecting) {
        setSelecting(false);
        setChecked([]);
      } else {
        return;
      }
      event.preventDefault();
      return;
    }

    const rowElement = target.closest<HTMLElement>("[data-row-key]");
    const panel = target.closest(".list-panel");
    const rowCard =
      rowElement === null
        ? undefined
        : cards.find((card) => card.key === rowElement.getAttribute("data-row-key"));
    const panelCard = panel !== null ? openCard : null;
    const card = rowCard ?? panelCard;
    const inList = target.closest('[role="tree"]') !== null;
    const anchor =
      rowElement ??
      panel?.querySelector("[data-panel-actions]") ??
      treeRef.current?.querySelector('[tabindex="0"]') ??
      target;
    const key = event.key.toLowerCase();

    if (key === "n") {
      event.preventDefault();
      const text = newDiscussionNotice(board);
      const button = document.getElementById(NEW_DISCUSSION_ID);
      if (text !== null) {
        notice.show(button ?? target, text);
      } else {
        discuss([]);
      }
    } else if (key === "/") {
      if (!selecting && searchRef.current !== null) {
        event.preventDefault();
        searchRef.current.focus();
      }
    } else if (key === "d" && (selecting ? inList : card !== null && (inList || panel !== null))) {
      event.preventDefault();
      const outOfReadingCard =
        rowCard === undefined && panelCard !== null && !cardKeys.has(panelCard.key);
      const text = discussNotice(card, app, board.id, {
        outOfReading: outOfReadingCard,
        selecting,
        selected: checked.length,
      });
      if (text !== null) {
        notice.show(anchor, text);
      } else {
        discuss(selecting ? checked : card === null ? [] : [card.key]);
      }
    } else if (
      key === "s" &&
      !selecting &&
      card !== null &&
      (rowCard !== undefined || panel !== null)
    ) {
      event.preventDefault();
      const outOfReadingCard =
        rowCard === undefined && panelCard !== null && !cardKeys.has(panelCard.key);
      const text = startNotice(card, app, outOfReadingCard);
      if (text !== null) {
        notice.show(anchor, text);
      } else {
        startCard(card);
      }
    } else if (event.key === " " && rowCard !== undefined) {
      event.preventDefault();
      if (selecting) {
        toggleChecked(rowCard, rowElement);
      } else {
        const text = selectNotice(rowCard, app, board.id);
        if (text !== null) {
          notice.show(anchor, text);
        } else {
          setSelecting(true);
          setChecked([rowCard.key]);
          setOpenKey(null);
          setOpenCard(null);
        }
      }
    }
  };

  const view = readingView(board, filtered);
  const selectDisabledReason =
    board.readAt === ""
      ? "the board hasn't been read yet"
      : selecting
        ? "already selecting"
        : !filtered.some(checkable)
          ? "no card to select"
          : null;

  let content: React.ReactNode = null;
  if (view.kind === "skeleton") {
    content = <ReadingSkeleton />;
  } else if (view.kind === "never-read-failed") {
    content = <NeverReadFailed board={board} />;
  } else if (view.kind === "no-cards") {
    content = <NoCards onNewDiscussion={() => discuss([])} />;
  } else if (view.kind === "no-match") {
    content = (
      <NoMatch board={board} filters={memory.filters} onClear={() => setFilters(EMPTY_FILTERS)} />
    );
  } else {
    content = modelOf !== null && (
      <CardTree
        ref={treeHandle}
        board={board}
        rows={rows}
        modelOf={modelOf}
        scrollRef={scrollRef}
        stickyRef={barRef}
        openKey={openKey}
        selecting={selecting}
        checked={checked}
        checkable={checkable}
        newKeys={newKeys}
        treeRef={treeRef}
        onToggleSection={toggleSection}
        onActivateCard={activateCard}
      />
    );
  }

  const numbers = checked
    .map((key) => cards.find((card) => card.key === key))
    .flatMap((card) => (card === undefined ? [] : [`#${card.number}`]))
    .join(" ");
  const bar =
    board.readAt !== "" && cards.length > 0 ? (
      selecting ? (
        <div
          ref={barRef}
          className={cn(
            "sticky top-0 z-(--z-sticky) bg-surface-1 pt-(--space-4) pb-(--space-3)",
            STICKY_FADE,
          )}
        >
          <SelectionBar
            count={checked.length}
            numbers={numbers}
            filtered={filtersActive(memory.filters)}
            filteredTooltip={filteredTooltip(memory.filters, board.viewer)}
            onDiscuss={() => discuss(checked)}
            onCancel={() => {
              setSelecting(false);
              setChecked([]);
            }}
          />
        </div>
      ) : (
        <BoardFilterBar
          board={board}
          filters={memory.filters}
          onChange={setFilters}
          searchRef={searchRef}
          barRef={barRef}
          onSearchEscape={(event) => {
            event.preventDefault();
            focusRow(null);
          }}
          onSearchDown={() => focusRow(null)}
        />
      )
    ) : null;

  return (
    <section
      aria-label={board.title}
      onKeyDown={onKeyDown}
      className="flex min-h-0 min-w-0 flex-1 flex-col bg-surface-1"
    >
      <BoardHeader
        board={board}
        now={now}
        onNewDiscussion={() => discuss([])}
        onEnterSelect={enterSelecting}
        selectDisabledReason={selectDisabledReason}
      />
      <PanelLayout
        panel={
          openCard !== null && (
            <BoardCardPanel
              key={openCard.key}
              board={board}
              card={openCard}
              outOfReading={!cardKeys.has(openCard.key)}
              start={start}
              now={now}
              onClose={closePanel}
              onOpenCard={(key) => revealCard(key, false)}
              onDiscuss={() => discuss([openCard.key])}
              panelRef={panelRef}
            />
          )
        }
      >
        <ScrollArea className="list-area min-h-0 flex-1" viewportRef={scrollRef}>
          <div className={LIST_COLUMN}>
            <FailureStrip board={board} now={now} />
            {bar}
            {content}
          </div>
        </ScrollArea>
      </PanelLayout>
      <KeyNotice notice={notice.notice} onHide={notice.hide} />
    </section>
  );
}
