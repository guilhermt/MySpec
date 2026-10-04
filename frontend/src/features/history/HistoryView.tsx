import { type KeyboardEvent, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { Button } from "@/components/system/Button";
import { Chip } from "@/components/system/Chip";
import { EmptyState } from "@/components/system/EmptyState";
import { FilterBar } from "@/components/system/FilterBar";
import { isTyping } from "@/components/system/keys";
import { HistoryRow } from "@/components/system/ListRow";
import { DaySectionHeader } from "@/components/system/ListSectionHeader";
import { ScrollArea } from "@/components/system/ScrollArea";
import { SearchInput } from "@/components/system/SearchInput";
import { Shimmer } from "@/components/system/Shimmer";
import { Tooltip } from "@/components/system/Tooltip";
import { useNow } from "@/features/attention/useNow";
import { LIST_COLUMN } from "@/features/board/BoardView";
import { entryId, type ListTreeEntry, useListTree } from "@/features/board/useListTree";
import {
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
import { cn } from "@/lib/utils";
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

/**
 * BELOW_THE_BAR keeps a day or a row the keys move to below the bar of the search, which sticks to
 * the top of the list, and its fade: the room it scrolls to is under them, not behind.
 */
const BELOW_THE_BAR =
  "[&_[data-row-key]]:scroll-mt-[calc(var(--space-4)+var(--size-control-sm)+var(--space-3)*2)] [&_[data-section-id]]:scroll-mt-[calc(var(--space-4)+var(--size-control-sm)+var(--space-3)*2)]";

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
  const treeEntries = useMemo(
    () =>
      days.flatMap((day): ListTreeEntry[] => [
        { kind: "section", id: day.id, foldable: false, collapsed: false },
        ...day.entries.map(
          (entry): ListTreeEntry => ({ kind: "item", key: entry.id, sectionId: day.id }),
        ),
      ]),
    [days],
  );

  const open = (entry: HistoryEntry) => {
    if (entry.kind === "task") {
      openArchived(entry.id);
    } else if (entry.kind === "review") {
      openArchivedReview(entry.id);
    } else {
      openArchivedDiscussion(entry.id);
    }
  };
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
  });

  // The focus starts on the row a deletion left in the place of the item, on the row just archived
  // (rolled to the middle when it is out of view), or on the search.
  const freshId = fresh?.id;
  const opened = useRef(false);
  useLayoutEffect(() => {
    // A later arrival without a row to show leaves the focus where it is.
    if (opened.current && freshId === undefined) {
      return;
    }
    opened.current = true;
    const { historyFocus } = useAppStore.getState();
    clearHistoryFocus();
    const rowOf = (key: string | null) =>
      key === null || key === SEARCH_ID
        ? undefined
        : Array.from(treeRef.current?.querySelectorAll<HTMLElement>("[data-row-key]") ?? []).find(
            (element) => element.getAttribute("data-row-key") === key,
          );
    const row = rowOf(historyFocus) ?? rowOf(freshId ?? null);
    if (row !== undefined && row.getAttribute("data-row-key") === freshId) {
      const view = viewportRef.current?.getBoundingClientRect();
      const box = row.getBoundingClientRect();
      if (view !== undefined && (box.top < view.top || box.bottom > view.bottom)) {
        row.scrollIntoView({ block: "center" });
      }
    }
    (row ?? searchRef.current)?.focus();
  }, [clearHistoryFocus, freshId]);

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
  const lastEntry = treeEntries.at(-1);
  const lastId = lastEntry === undefined ? null : entryId(lastEntry);
  const onEntryFocus = (id: string) => {
    tree.onEntryFocus(id);
    if (id === lastId && hasOlder) {
      requestOlder();
    }
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
          <FilterBar label="Search History">
            <SearchInput
              landmark={false}
              inputRef={searchRef}
              label="Search History"
              placeholder="Search by name, title or #number"
              shortcut="/"
              value={historyQuery}
              onValueChange={setHistoryQuery}
              onArrowDown={() => {
                // The first day comes into view as the keys of the list bring an entry, below the bar.
                const first = treeRef.current?.querySelector<HTMLElement>("[data-section-id]");
                first?.focus();
                first?.scrollIntoView?.({ block: "nearest" });
              }}
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
              className={cn("flex flex-col", BELOW_THE_BAR)}
            >
              {days.map((day) => {
                const sectionId = entryId({
                  kind: "section",
                  id: day.id,
                  foldable: false,
                  collapsed: false,
                });
                return (
                  <div key={day.id} role="none" className="mt-(--space-4) first:mt-0">
                    <DaySectionHeader
                      id={day.id}
                      name={day.name}
                      count={day.count}
                      label={day.label}
                      tabStop={sectionId === tree.tabStop}
                      onFocus={() => onEntryFocus(sectionId)}
                    />
                    {app !== null &&
                      day.entries.map((entry) => {
                        const id = entryId({ kind: "item", key: entry.id, sectionId: day.id });
                        const isFresh = entry.id === freshId;
                        return (
                          <HistoryRow
                            key={id}
                            model={historyRow(entry, app, now, isFresh)}
                            fresh={isFresh}
                            tabStop={id === tree.tabStop}
                            onActivate={() => open(entry)}
                            onFocus={() => onEntryFocus(id)}
                          />
                        );
                      })}
                  </div>
                );
              })}
            </div>
          )}
          <div ref={sentinelRef} data-older-sentinel="" aria-hidden="true" />
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
              <p
                role="status"
                className="px-(--space-4) py-(--space-3) text-(length:--text-meta) leading-(--leading-meta) text-ink-3"
              >
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
