import { tasksInFilter } from "@/lib/repositories";
import type { ArchivedReview, ArchivedTask, State } from "@/lib/wails";

/** HistoryEntry is one line of the history: an archived task or an archived review. */
export type HistoryEntry =
  | { kind: "task"; id: string; archivedAt: string; task: ArchivedTask }
  | { kind: "review"; id: string; archivedAt: string; review: ArchivedReview };

// A task is found by its name.
function taskMatches(task: ArchivedTask, term: string): boolean {
  return task.name.toLowerCase().includes(term);
}

// A review is found by the title of its pull request, or by its #number.
function reviewMatches(review: ArchivedReview, term: string): boolean {
  return review.title.toLowerCase().includes(term) || `#${review.number}`.includes(term);
}

/**
 * historyEntries is what the history lists: the archived tasks and reviews of
 * the repository of the filter that carry what was typed, the last to end first.
 */
export function historyEntries(
  app: State | null,
  query: string,
  filter: string,
): readonly HistoryEntry[] {
  const term = query.trim().toLowerCase();
  const tasks = tasksInFilter(app?.history ?? [], filter)
    .filter((task) => taskMatches(task, term))
    .map(
      (task): HistoryEntry => ({ kind: "task", id: task.id, archivedAt: task.archivedAt, task }),
    );
  const reviews = tasksInFilter(app?.reviewHistory ?? [], filter)
    .filter((review) => reviewMatches(review, term))
    .map(
      (review): HistoryEntry => ({
        kind: "review",
        id: review.id,
        archivedAt: review.archivedAt,
        review,
      }),
    );
  // A date that does not parse ties, instead of making the order undefined.
  return [...tasks, ...reviews].sort(
    (a, b) => Date.parse(b.archivedAt) - Date.parse(a.archivedAt) || 0,
  );
}
