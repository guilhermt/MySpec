import { type KeyboardEvent, useLayoutEffect, useMemo, useRef } from "react";
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
  type OlderSource,
} from "@/features/history/history-list";
import { historyRow } from "@/features/history/history-rows";
import { LocationHeader } from "@/features/navigation/LocationHeader";
import { olderKey } from "@/lib/history";
import { filterLabel } from "@/lib/repositories";
import { setRepositoryFilter } from "@/store/actions";
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
  const now = useNow(DAY_CLOCK_MS, true);
  const searchRef = useRef<HTMLInputElement>(null);
  const treeRef = useRef<HTMLDivElement>(null);

  const source = useMemo<OlderSource>(
    () => ({ archived: olderArchived, ids: older?.ids ?? NO_IDS }),
    [olderArchived, older?.ids],
  );
  const entries = useMemo(
    () => historyEntries(app, source, historyQuery, filter, null),
    [app, source, historyQuery, filter],
  );
  const days = useMemo(() => historyDays(entries, now), [entries, now]);
  const byId = useMemo(() => new Map(entries.map((entry) => [entry.id, entry])), [entries]);
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

  // The focus starts on the row a deletion left in the place of the item, or on the search.
  useLayoutEffect(() => {
    const { historyFocus } = useAppStore.getState();
    clearHistoryFocus();
    const row =
      historyFocus === null || historyFocus === SEARCH_ID
        ? undefined
        : Array.from(treeRef.current?.querySelectorAll<HTMLElement>("[data-row-key]") ?? []).find(
            (element) => element.getAttribute("data-row-key") === historyFocus,
          );
    (row ?? searchRef.current)?.focus();
  }, [clearHistoryFocus]);

  const query = historyQuery.trim();
  const total = summary.tasks + summary.reviews + summary.discussions;
  const inRepository =
    repository === null
      ? 0
      : repository.archivedTasks + repository.archivedReviews + repository.archivedDiscussions;
  const count = historyCount(
    summary,
    {
      matched: query === "" ? inRepository : (older?.matched ?? null),
      windowMatches: entries.length,
      filtered: filter !== "",
      searching: query !== "",
    },
    now,
  );

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
      <ScrollArea className="list-area min-h-0 flex-1">
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
              onArrowDown={() =>
                treeRef.current?.querySelector<HTMLElement>("[data-section-id]")?.focus()
              }
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
            empty
          ) : (
            <div
              ref={treeRef}
              role="tree"
              aria-label="History"
              onKeyDown={tree.onKeyDown}
              className="flex flex-col"
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
                      count={day.entries.length}
                      label={day.label}
                      tabStop={sectionId === tree.tabStop}
                      onFocus={() => tree.onEntryFocus(sectionId)}
                    />
                    {app !== null &&
                      day.entries.map((entry) => {
                        const id = entryId({ kind: "item", key: entry.id, sectionId: day.id });
                        return (
                          <HistoryRow
                            key={id}
                            model={historyRow(entry, app, now, false)}
                            fresh={false}
                            tabStop={id === tree.tabStop}
                            onActivate={() => open(entry)}
                            onFocus={() => tree.onEntryFocus(id)}
                          />
                        );
                      })}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </ScrollArea>
    </section>
  );
}
