import { ALL_REPOSITORIES, tasksInFilter } from "@/lib/repositories";
import type { ArchivedDiscussion, ArchivedReview, ArchivedTask, State } from "@/lib/wails";

/** HistoryEntry is one line of the history: an archived task, review or discussion. */
export type HistoryEntry =
  | { kind: "task"; id: string; archivedAt: string; task: ArchivedTask }
  | { kind: "review"; id: string; archivedAt: string; review: ArchivedReview }
  | { kind: "discussion"; id: string; archivedAt: string; discussion: ArchivedDiscussion };

// A task is found by its name.
function taskMatches(task: ArchivedTask, term: string): boolean {
  return task.name.toLowerCase().includes(term);
}

// A review is found by the title of its pull request, or by its #number.
function reviewMatches(review: ArchivedReview, term: string): boolean {
  return review.title.toLowerCase().includes(term) || `#${review.number}`.includes(term);
}

// A discussion is found by its title.
function discussionMatches(discussion: ArchivedDiscussion, term: string): boolean {
  return discussion.title.toLowerCase().includes(term);
}

// A discussion belongs to every repository its cards came from or went to.
function discussionsInFilter(
  discussions: readonly ArchivedDiscussion[],
  filter: string,
): readonly ArchivedDiscussion[] {
  if (filter === ALL_REPOSITORIES) {
    return discussions;
  }
  return discussions.filter((discussion) => (discussion.repositoryIds ?? []).includes(filter));
}

/**
 * historyEntries is what the history lists: the archived tasks, reviews and
 * discussions of the repository of the filter that carry what was typed, the
 * last to end first.
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
  const discussions = discussionsInFilter(app?.discussionHistory ?? [], filter)
    .filter((discussion) => discussionMatches(discussion, term))
    .map(
      (discussion): HistoryEntry => ({
        kind: "discussion",
        id: discussion.id,
        archivedAt: discussion.archivedAt,
        discussion,
      }),
    );
  // A date that does not parse ties, instead of making the order undefined.
  return [...tasks, ...reviews, ...discussions].sort(
    (a, b) => Date.parse(b.archivedAt) - Date.parse(a.archivedAt) || 0,
  );
}
