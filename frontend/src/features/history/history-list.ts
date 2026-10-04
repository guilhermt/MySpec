import type {
  ArchivedDiscussion,
  ArchivedReview,
  ArchivedTask,
  HistorySummary,
  State,
} from "@/lib/wails";
import { dayOf, daysBefore } from "@/lib/when";
import type { OlderArchived } from "@/store/app-store";

/** HistoryEntry is one line of the history: an archived task, review or discussion. */
export type HistoryEntry =
  | { kind: "task"; id: string; archivedAt: string; task: ArchivedTask }
  | { kind: "review"; id: string; archivedAt: string; review: ArchivedReview }
  | { kind: "discussion"; id: string; archivedAt: string; discussion: ArchivedDiscussion };

/** OlderSource is what the History brought from beyond the window for a query and a filter: the items by id and the ids of that list. */
export interface OlderSource {
  archived: OlderArchived;
  ids: readonly string[];
}

/** NUMBER_QUERY is a search that is only a number: 1279 or #1279. */
const NUMBER_QUERY = /^#?\d+$/;

/**
 * matchesQuery says whether the name or the title of the entry has the query, ignoring case; a query
 * that is a number also matches the numbers of the pull request and the card of a task and of the
 * pull request of a review. The rules of the Go, which searches the whole History.
 */
export function matchesQuery(entry: HistoryEntry, query: string): boolean {
  const term = query.trim().toLowerCase();
  if (term === "") {
    return true;
  }
  const [title, numbers] =
    entry.kind === "task"
      ? [entry.task.name, [entry.task.pr?.number, entry.task.card?.number]]
      : entry.kind === "review"
        ? [entry.review.title, [entry.review.number]]
        : [entry.discussion.title, []];
  if (title.toLowerCase().includes(term)) {
    return true;
  }
  return NUMBER_QUERY.test(term) && numbers.includes(Number(term.replace("#", "")));
}

/** inFilter says whether the entry belongs to the repository of the filter; "" is every repository. A discussion belongs to every repository its cards came from or went to. */
export function inFilter(entry: HistoryEntry, filter: string): boolean {
  if (filter === "") {
    return true;
  }
  switch (entry.kind) {
    case "task":
      return entry.task.repositoryId === filter;
    case "review":
      return entry.review.repositoryId === filter;
    case "discussion":
      return (entry.discussion.repositoryIds ?? []).includes(filter);
  }
}

// What the History brought from beyond the window, by the ids of a list, in the order they came.
function olderOf<T>(items: Readonly<Record<string, T>>, ids: readonly string[]): T[] {
  return ids.flatMap((id) => (items[id] === undefined ? [] : [items[id]]));
}

// The entries of the three kinds, in no order.
function entriesOf(app: State | null, older: OlderSource): HistoryEntry[] {
  return [
    ...[...(app?.history ?? []), ...olderOf(older.archived.tasks, older.ids)].map(
      (task): HistoryEntry => ({ kind: "task", id: task.id, archivedAt: task.archivedAt, task }),
    ),
    ...[...(app?.reviewHistory ?? []), ...olderOf(older.archived.reviews, older.ids)].map(
      (review): HistoryEntry => ({
        kind: "review",
        id: review.id,
        archivedAt: review.archivedAt,
        review,
      }),
    ),
    ...[...(app?.discussionHistory ?? []), ...olderOf(older.archived.discussions, older.ids)].map(
      (discussion): HistoryEntry => ({
        kind: "discussion",
        id: discussion.id,
        archivedAt: discussion.archivedAt,
        discussion,
      }),
    ),
  ];
}

/**
 * historyEntries are the window and the older items loaded for the query and the filter, newest first,
 * the last to be archived first and the id breaking a tie, as the Go orders them; the fresh item
 * stays even outside the filter.
 */
export function historyEntries(
  app: State | null,
  older: OlderSource,
  query: string,
  filter: string,
  fresh: string | null,
): readonly HistoryEntry[] {
  // A date that does not parse ties, instead of making the order undefined.
  return entriesOf(app, older)
    .filter(
      (entry) => entry.id === fresh || (inFilter(entry, filter) && matchesQuery(entry, query)),
    )
    .sort(
      (a, b) =>
        Date.parse(b.archivedAt) - Date.parse(a.archivedAt) ||
        (a.id < b.id ? 1 : a.id > b.id ? -1 : 0),
    );
}

/** HistoryDay is the entries archived on one day, the section the list draws. */
export interface HistoryDay {
  /** id is the local day, 2026-09-22. */
  id: string;
  name: string;
  /** label is the name of the header for a screen reader and its tooltip: "Archived on Monday, Sep 22: 5". */
  label: string;
  entries: readonly HistoryEntry[];
}

const WEEKDAY = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  month: "short",
  day: "numeric",
});
const WEEKDAY_OF_YEAR = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  month: "short",
  day: "numeric",
  year: "numeric",
});

// dayId is the day of a time in local time, 2026-09-22; "" when it does not parse.
function dayId(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** dayName is the day a section is named by: Today, Yesterday, Monday, Sep 22 and Monday, Sep 22, 2025 before this year. */
export function dayName(iso: string, now: number): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "Unknown date";
  }
  switch (daysBefore(date, now)) {
    case 0:
      return "Today";
    case 1:
      return "Yesterday";
    default:
      return (
        date.getFullYear() === new Date(now).getFullYear() ? WEEKDAY : WEEKDAY_OF_YEAR
      ).format(date);
  }
}

/** archivedOn is the day an item was archived as a sentence says it: today, yesterday, on Monday, Sep 22. */
export function archivedOn(iso: string, now: number): string {
  const name = dayName(iso, now);
  return name === "Today" ? "today" : name === "Yesterday" ? "yesterday" : `on ${name}`;
}

/** historyDays groups entries, newest first, by the local day they were archived. */
export function historyDays(entries: readonly HistoryEntry[], now: number): readonly HistoryDay[] {
  const days: { id: string; entries: HistoryEntry[] }[] = [];
  for (const entry of entries) {
    const id = dayId(entry.archivedAt);
    const last = days.at(-1);
    if (last?.id === id) {
      last.entries.push(entry);
    } else {
      days.push({ id, entries: [entry] });
    }
  }
  return days.map(({ id, entries: ofDay }) => ({
    id,
    name: dayName(ofDay[0]?.archivedAt ?? "", now),
    label: `Archived ${archivedOn(ofDay[0]?.archivedAt ?? "", now)}: ${ofDay.length}`,
    entries: ofDay,
  }));
}

/** HistoryShown is how much of the History the list shows, for the count of the bar. */
export interface HistoryShown {
  /** matched is how many items of the whole History match; null while the Go has not answered. */
  matched: number | null;
  /** windowMatches is how many items of the window match, what the count says until the Go answers. */
  windowMatches: number;
  filtered: boolean;
  searching: boolean;
}

// period is when the History began: Sep 12 – today, Sep 12, 2025 – today, today.
function period(oldest: string, now: number): string {
  if (oldest === "") {
    return "";
  }
  const date = new Date(oldest);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return daysBefore(date, now) === 0 ? "today" : `${dayOf(oldest, now)} – today`;
}

/**
 * historyCount is what the bar says of the History: "44 archived · Sep 12 – today", and with a filter
 * or a search "12 of 44 · Sep 12 – today". The total and the period are of the whole History; the
 * count of a search is the window's until the Go answers, which makes it busy.
 */
export function historyCount(
  summary: HistorySummary,
  shown: HistoryShown,
  now: number,
): { text: string; busy: boolean } {
  const total = summary.tasks + summary.reviews + summary.discussions;
  const matched = shown.matched ?? shown.windowMatches;
  const count = shown.filtered || shown.searching ? `${matched} of ${total}` : `${total} archived`;
  const since = period(summary.oldest, now);
  return {
    text: since === "" ? count : `${count} · ${since}`,
    busy: shown.searching && shown.matched === null,
  };
}

/**
 * historyNeighbor is the entry that takes the place of the one with the id once it is deleted: the
 * next, which is older; without one, the previous; null when it was the only one.
 */
export function historyNeighbor(entries: readonly HistoryEntry[], id: string): string | null {
  const at = entries.findIndex((entry) => entry.id === id);
  if (at === -1) {
    return null;
  }
  return (entries[at + 1] ?? entries[at - 1])?.id ?? null;
}
