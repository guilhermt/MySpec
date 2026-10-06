import {
  type KeyboardEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
} from "react";
import { Button } from "@/components/system/Button";
import { Chip } from "@/components/system/Chip";
import { EmptyState } from "@/components/system/EmptyState";
import { FilterBar } from "@/components/system/FilterBar";
import { isTyping } from "@/components/system/keys";
import { LIST_COLUMN } from "@/components/system/ListPanel";
import { HistoryRow, type HistoryRowView } from "@/components/system/ListRow";
import { DaySectionHeader } from "@/components/system/ListSectionHeader";
import { LiveRegion } from "@/components/system/LiveRegion";
import { ScrollArea } from "@/components/system/ScrollArea";
import { SearchInput } from "@/components/system/SearchInput";
import { Shimmer } from "@/components/system/Shimmer";
import { Tooltip } from "@/components/system/Tooltip";
import { useWindowedRows } from "@/components/system/useWindowedRows";
import { useNow } from "@/features/attention/useNow";
import { entryId, type ListTreeEntry, useListTree } from "@/features/board/useListTree";
import {
  type HistoryDay,
  type HistoryEntry,
  historyCount,
  historyDays,
  historyEntries,
  inFilter,
  type OlderSource,
} from "@/features/history/history-list";
import { historyRow } from "@/features/history/history-rows";
import { LocationHeader } from "@/features/navigation/LocationHeader";
import { olderKey } from "@/lib/history";
import { filterLabel } from "@/lib/repositories";
import { loadOlderHistory, setRepositoryFilter } from "@/store/actions";
import {
  useAppStore,
  useHistorySummary,
  useHistoryUi,
  useRepository,
  useRepositoryFilter,
} from "@/store/app-store";

/** DAY_CLOCK_MS is how often the names of the days are told again: a minute. */
const DAY_CLOCK_MS = 60_000;

const NO_IDS: readonly string[] = [];

/** SEARCH_OLDER_DELAY_MS is how long the search waits, once the text stops changing, before it asks the Go for the older items that match. */
export const SEARCH_OLDER_DELAY_MS = 300;

/** HEADER_PX is the height of a day header: --size-node. */
const HEADER_PX = 28;
/** SPACED_HEADER_PX is a day header with the room over it, --space-4 more, as every day but the first has. */
const SPACED_HEADER_PX = 44;
/** ROW_PX is the height of a row of the History on one line: --size-control. */
const ROW_PX = 32;
/** TWO_LINE_ROW_PX is the height of a row on two lines, in a list of up to 860 px (components.md, Linha de lista). */
const TWO_LINE_ROW_PX = 52;
/** TWO_LINES_UP_TO_PX is the width of the scroll area (the "list" container of the row's query, @max-[860px]/list) up to which a row takes two lines. */
const TWO_LINES_UP_TO_PX = 860;
/** OVERSCAN is how many rows are mounted past each end of what shows. */
const OVERSCAN = 20;

/** HistoryListRow is a row of the flat list: a day header or an archived item, with its place among its siblings. */
type HistoryListRow =
  | { kind: "day"; day: HistoryDay; posInSet: number; setSize: number }
  | { kind: "entry"; entry: HistoryEntry; dayId: string; posInSet: number; setSize: number };

/** SEARCH_ID names the search in the focus the store asks for. */
const SEARCH_ID = "search";

/** HistoryView is the History: the archived tasks, reviews and discussions by the day they were archived. */
export function HistoryView() {
  const app = useAppStore((state) => state.app);
  const { historyQuery } = useHistoryUi();
  const setHistoryQuery = useAppStore((state) => state.setHistoryQuery);
  const openArchived = useAppStore((state) => state.openArchived);
  const openArchivedReview = useAppStore((state) => state.openArchivedReview);
  const openArchivedDiscussion = useAppStore((state) => state.openArchivedDiscussion);
  const clearHistoryFocus = useAppStore((state) => state.clearHistoryFocus);
  const filter = useRepositoryFilter();
  const repository = useRepository(filter);
  const summary = useHistorySummary();
  const olderArchived = useAppStore((state) => state.olderArchived);
  const older = useAppStore((state) => state.olderLists[olderKey(historyQuery, filter)]);
  const fresh = useAppStore((state) =>
    state.location.kind === "history" ? state.location.fresh : undefined,
  );
  const now = useNow(DAY_CLOCK_MS, true);
  const searchRef = useRef<HTMLInputElement>(null);
  const treeRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);

  const source = useMemo<OlderSource>(
    () => ({ archived: olderArchived, ids: older?.ids ?? NO_IDS }),
    [olderArchived, older?.ids],
  );
  const entries = useMemo(
    () => historyEntries(app, source, historyQuery, filter, fresh?.id ?? null),
    [app, source, historyQuery, filter, fresh?.id],
  );
  const byId = useMemo(() => new Map(entries.map((entry) => [entry.id, entry])), [entries]);
  // The row just archived stays outside the filter, and outside what the filter counts; a search
  // typed after the arrival is the user's, and holds for it too.
  const freshEntry = fresh === undefined ? undefined : byId.get(fresh.id);
  const outside = freshEntry !== undefined && !inFilter(freshEntry, filter);
  const uncounted = outside ? freshEntry.id : null;
  const days = useMemo(() => historyDays(entries, now, uncounted), [entries, now, uncounted]);
  // The list is flat: a header per day and a row per item, as the tree walks them.
  const rows = useMemo(
    () =>
      days.flatMap((day, at): HistoryListRow[] => [
        { kind: "day", day, posInSet: at + 1, setSize: days.length },
        ...day.entries.map(
          (entry, index): HistoryListRow => ({
            kind: "entry",
            entry,
            dayId: day.id,
            posInSet: index + 1,
            setSize: day.entries.length,
          }),
        ),
      ]),
    [days],
  );
  const treeEntries = useMemo(
    () =>
      rows.map(
        (row): ListTreeEntry =>
          row.kind === "day"
            ? { kind: "section", id: row.day.id, foldable: false, collapsed: false }
            : { kind: "item", key: row.entry.id, sectionId: row.dayId },
      ),
    [rows],
  );
  const ids = useMemo(() => treeEntries.map(entryId), [treeEntries]);

  const open = (entry: HistoryEntry) => {
    if (entry.kind === "task") {
      openArchived(entry.id);
    } else if (entry.kind === "review") {
      openArchivedReview(entry.id);
    } else {
      openArchivedDiscussion(entry.id);
    }
  };
  // The tree walks by index and the window mounts by index: each is told of the other by a ref,
  // since the window pins the tab stop the tree names and the tree scrolls through the window.
  const scrollTo = useRef<(index: number, align?: "auto" | "center") => void>(undefined);
  const tree = useListTree({
    entries: treeEntries,
    openKey: null,
    treeRef,
    onToggleSection: () => {},
    onActivateItem: (key) => {
      const entry = byId.get(key);
      if (entry !== undefined) {
        open(entry);
      }
    },
    scrollToIndex: (index, align) => scrollTo.current?.(index, align),
  });
  const freshId = fresh?.id;
  const freshIndex = freshId === undefined ? -1 : ids.indexOf(`item:${freshId}`);
  const keyOf = useCallback((index: number) => ids[index] ?? "", [ids]);
  const estimate = useCallback(
    (index: number) => {
      const row = rows[index];
      if (row?.kind === "day") {
        return index === 0 ? HEADER_PX : SPACED_HEADER_PX;
      }
      // The viewport fills the area the container query measures, not the narrower list column.
      const width = viewportRef.current?.clientWidth ?? 0;
      return width > TWO_LINES_UP_TO_PX || width <= 0 ? ROW_PX : TWO_LINE_ROW_PX;
    },
    [rows],
  );
  const windowed = useWindowedRows({
    count: rows.length,
    keyOf,
    estimate,
    pinned: [tree.tabStopIndex, freshIndex],
    scrollRef: viewportRef,
    listRef: treeRef,
    stickyRef: barRef,
    overscan: OVERSCAN,
  });
  useLayoutEffect(() => {
    scrollTo.current = windowed.scrollToIndex;
  }, [windowed.scrollToIndex]);

  // The focus starts on the row a deletion left in the place of the item, on the row just archived
  // (rolled to the middle when it is out of view), or on the search. It waits for the window to
  // have mounted its rows.
  const opened = useRef(false);
  const arrivedFor = useRef<string | undefined | null>(null);
  const ready = windowed.parts.length > 0 || rows.length === 0;
  useLayoutEffect(() => {
    if (!ready || arrivedFor.current === (freshId ?? undefined)) {
      return;
    }
    arrivedFor.current = freshId;
    // A later arrival without a row to show leaves the focus where it is.
    if (opened.current && freshId === undefined) {
      return;
    }
    opened.current = true;
    const { historyFocus } = useAppStore.getState();
    clearHistoryFocus();
    const indexOf = (key: string | null) =>
      key === null || key === SEARCH_ID ? -1 : ids.indexOf(`item:${key}`);
    const fromFocus = indexOf(historyFocus);
    const index = fromFocus >= 0 ? fromFocus : indexOf(freshId ?? null);
    if (index < 0) {
      searchRef.current?.focus();
      return;
    }
    if (index === indexOf(freshId ?? null)) {
      const view = viewportRef.current?.getBoundingClientRect();
      const box = treeRef.current
        ?.querySelector<HTMLElement>(`[data-index="${index}"]`)
        ?.getBoundingClientRect();
      if (
        view !== undefined &&
        (box === undefined || box.top < view.top || box.bottom > view.bottom)
      ) {
        tree.focusIndex(index, "center");
        return;
      }
    }
    tree.focusIndex(index);
  });

  const query = historyQuery.trim();
  const total = summary.tasks + summary.reviews + summary.discussions;
  const inRepository =
    repository === null
      ? 0
      : repository.archivedTasks + repository.archivedReviews + repository.archivedDiscussions;
  const shown = entries.length - (outside ? 1 : 0);
  const count = historyCount(
    summary,
    {
      matched: query === "" ? inRepository : (older?.matched ?? null),
      windowMatches: shown,
      filtered: filter !== "",
      searching: query !== "",
    },
    now,
  );

  // What is beyond the window: the cursor once a page came; before it, whatever the summary says is
  // not on the list yet, and with a search, anything, until the Go answers.
  const answered = older !== undefined && older.matched !== null;
  const status = older?.status ?? "idle";
  const mayHaveOlder = query === "" ? (filter === "" ? total : inRepository) > shown : total > 0;
  const hasOlder = answered ? older.next !== null : mayHaveOlder;
  const waiting = !answered && status !== "error" && mayHaveOlder;
  const requestOlder = () => {
    // A search asks for its first page when the text stops, not before.
    if (status !== "error" && (query === "" || answered)) {
      void loadOlderHistory(query, filter);
    }
  };

  // The sentinel after the last row asks for the next page when it comes into view. A page that
  // leaves it in view makes a new observer, which asks again.
  const pages = older?.ids.length ?? 0;
  // biome-ignore lint/correctness/useExhaustiveDependencies: pages makes the observer again, which tells the sentinel is still in view.
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (sentinel === null || !hasOlder || status !== "idle" || (query !== "" && !answered)) {
      return;
    }
    const observer = new IntersectionObserver((records) => {
      if (records.some((record) => record.isIntersecting)) {
        void loadOlderHistory(query, filter);
      }
    });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasOlder, status, query, answered, filter, pages]);

  // A search asks for the older items that match once the text stops changing.
  useEffect(() => {
    if (query === "" || total === 0) {
      return;
    }
    const timer = setTimeout(() => {
      const list = useAppStore.getState().olderLists[olderKey(query, filter)];
      if (list === undefined || list.matched === null) {
        void loadOlderHistory(query, filter);
      }
    }, SEARCH_OLDER_DELAY_MS);
    return () => clearTimeout(timer);
  }, [query, filter, total]);

  // ↓ and End that reach the last row ask for the next page too.
  const lastId = ids.at(-1) ?? null;
  // The rows get the same functions whatever the render, so a row that did not change is not drawn
  // again; they read the latest of what the view holds.
  const latest = useRef({
    onEntryFocus: tree.onEntryFocus,
    lastId,
    hasOlder,
    requestOlder,
    open,
    byId,
  });
  useLayoutEffect(() => {
    latest.current = {
      onEntryFocus: tree.onEntryFocus,
      lastId,
      hasOlder,
      requestOlder,
      open,
      byId,
    };
  });
  const focusEntry = useCallback((id: string) => {
    const { onEntryFocus, lastId, hasOlder, requestOlder } = latest.current;
    onEntryFocus(id);
    if (id === lastId && hasOlder) {
      requestOlder();
    }
  }, []);
  const focusDay = useCallback((id: string) => focusEntry(`section:${id}`), [focusEntry]);
  const focusRow = useCallback((key: string) => focusEntry(`item:${key}`), [focusEntry]);
  const openRow = useCallback((key: string) => {
    const { open, byId } = latest.current;
    const entry = byId.get(key);
    if (entry !== undefined) {
      open(entry);
    }
  }, []);

  // The model of a row is made when the row mounts, and kept while what it tells stays the same.
  // biome-ignore lint/correctness/useExhaustiveDependencies: a new list, state, clock or arrival makes every model again
  const models = useMemo(
    () => new Map<HistoryEntry, HistoryRowView>(),
    [entries, app, now, freshId],
  );
  const modelOf = (entry: HistoryEntry, isFresh: boolean): HistoryRowView | null => {
    let model = models.get(entry);
    if (model === undefined && app !== null) {
      model = historyRow(entry, app, now, isFresh);
      models.set(entry, model);
    }
    return model ?? null;
  };

  const focusSearch = () => searchRef.current?.focus();
  const clearSearch = () => {
    setHistoryQuery("");
    focusSearch();
  };
  const showAll = () => void setRepositoryFilter("");

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    const target = event.target;
    // Dialogs and menus render in a portal: their keys are not the view's.
    if (!(target instanceof Element) || !event.currentTarget.contains(target)) {
      return;
    }
    if (event.altKey || event.ctrlKey || event.metaKey || isTyping(target)) {
      return;
    }
    if (event.key === "/") {
      event.preventDefault();
      focusSearch();
    }
  };

  const scope = filter === "" ? "" : ` in ${filterLabel(app, filter)}`;
  const empty =
    total === 0 ? (
      <EmptyState title="Nothing archived yet">
        A task comes here once it's closed, a review once its pull request is merged or closed, a
        discussion once it's archived.
      </EmptyState>
    ) : query === "" ? (
      <EmptyState
        title={`Nothing archived${scope}`}
        action={
          <Button variant="secondary" size="sm" onClick={showAll}>
            Show all repositories
          </Button>
        }
      >
        Choose another repository, or all of them.
      </EmptyState>
    ) : (
      <EmptyState
        title={`Nothing matches “${query}”${scope}`}
        action={
          <Button variant="secondary" size="sm" onClick={clearSearch}>
            Clear the search
          </Button>
        }
      >
        Try another name, title or #number, or clear the search.
      </EmptyState>
    );

  return (
    <section
      aria-label="History"
      onKeyDown={onKeyDown}
      className="flex min-h-0 min-w-0 flex-1 flex-col bg-surface-1"
    >
      <LocationHeader />
      <ScrollArea viewportRef={viewportRef} className="list-area min-h-0 flex-1">
        <div className={LIST_COLUMN}>
          <FilterBar ref={barRef} label="Search History">
            <SearchInput
              landmark={false}
              inputRef={searchRef}
              label="Search History"
              placeholder="Search by name, title or #number"
              shortcut="/"
              value={historyQuery}
              onValueChange={setHistoryQuery}
              onArrowDown={() => tree.focusIndex(0)}
              className="w-[calc(var(--space-16)*4)] @max-[620px]/list:w-[calc(var(--space-16)*3)]"
            />
            {filter !== "" && (
              <Tooltip content="The repository filter of the sidebar applies here too">
                <Chip
                  kind="toggle"
                  pressed
                  onPressedChange={showAll}
                  onRemove={showAll}
                  removeLabel="Show all repositories"
                >
                  {`Only ${filterLabel(app, filter)}`}
                </Chip>
              </Tooltip>
            )}
            <span
              aria-busy={count.busy || undefined}
              className="ml-auto text-(length:--text-micro) leading-(--leading-micro) tabular-nums text-ink-4"
            >
              {count.busy ? <Shimmer>{count.text}</Shimmer> : count.text}
            </span>
          </FilterBar>
          {entries.length === 0 ? (
            !waiting && empty
          ) : (
            <div
              ref={treeRef}
              role="tree"
              aria-label="History"
              onKeyDown={tree.onKeyDown}
              className="flex flex-col"
            >
              {windowed.parts.map((part) => {
                if (part.kind === "spacer") {
                  return (
                    <div
                      key={part.key}
                      aria-hidden="true"
                      role="none"
                      style={{ height: part.height }}
                    />
                  );
                }
                const row = rows[part.index];
                if (row === undefined) {
                  return null;
                }
                if (row.kind === "day") {
                  return (
                    <DaySectionHeader
                      key={part.key}
                      ref={windowed.measureRef}
                      index={part.index}
                      id={row.day.id}
                      name={row.day.name}
                      count={row.day.count}
                      label={row.day.label}
                      tabStop={part.key === tree.tabStop}
                      setSize={row.setSize}
                      posInSet={row.posInSet}
                      spaced={part.index > 0}
                      onFocus={focusDay}
                    />
                  );
                }
                const isFresh = row.entry.id === freshId;
                const model = modelOf(row.entry, isFresh);
                if (model === null) {
                  return null;
                }
                return (
                  <HistoryRow
                    key={part.key}
                    ref={windowed.measureRef}
                    index={part.index}
                    model={model}
                    fresh={isFresh}
                    tabStop={part.key === tree.tabStop}
                    setSize={row.setSize}
                    posInSet={row.posInSet}
                    onActivate={openRow}
                    onFocus={focusRow}
                  />
                );
              })}
            </div>
          )}
          <div ref={sentinelRef} data-older-sentinel="" aria-hidden="true" />
          <LiveRegion kind="status" className="sr-only">
            {status !== "error" &&
              (status === "loading" || (query !== "" && waiting)) &&
              (query === "" ? "Loading older items…" : "Searching older items…")}
          </LiveRegion>
          {status === "error" ? (
            <p
              role="alert"
              className="flex items-baseline gap-(--space-3) px-(--space-4) py-(--space-3) text-(length:--text-meta) leading-(--leading-meta) text-state-error"
            >
              <span className="min-w-0">{`Couldn't load older items: ${older?.error ?? ""}`}</span>
              <Button
                variant="ghost"
                size="xs"
                onClick={() => void loadOlderHistory(query, filter)}
              >
                Try again
              </Button>
            </p>
          ) : (
            (status === "loading" || (query !== "" && waiting)) && (
              <p className="px-(--space-4) py-(--space-3) text-(length:--text-meta) leading-(--leading-meta) text-ink-3">
                <Shimmer>
                  {query === "" ? "Loading older items…" : "Searching older items…"}
                </Shimmer>
              </p>
            )
          )}
        </div>
      </ScrollArea>
    </section>
  );
}
