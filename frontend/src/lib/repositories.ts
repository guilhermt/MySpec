import type { Repository, State } from "@/lib/wails";

/** ALL_REPOSITORIES is the filter that shows the tasks of every repository. */
export const ALL_REPOSITORIES = "";

const NO_REPOSITORIES: readonly Repository[] = [];

function repositoriesOf(app: State | null): readonly Repository[] {
  return app?.repositories ?? NO_REPOSITORIES;
}

/** shortName is the name part of owner/name, what a crowded row shows. */
export function shortName(fullName: string): string {
  const slash = fullName.lastIndexOf("/");
  return slash === -1 ? fullName : fullName.slice(slash + 1);
}

/** findRepository is the registered repository of an id, null when none is. */
export function findRepository(app: State | null, id: string): Repository | null {
  return repositoriesOf(app).find((repository) => repository.id === id) ?? null;
}

/** cloneMissingText is the warning of a repository whose clone is gone. */
export function cloneMissingText(repository: Repository): string {
  return `The clone at ${repository.path} is missing.`;
}

/** taskCount reads a number of tasks of a kind: "1 active task", "3 archived tasks". */
export function taskCount(count: number, kind: "active" | "archived"): string {
  return `${count} ${kind} task${count === 1 ? "" : "s"}`;
}

/** reviewCount reads a number of reviews of pull requests: "1 review", "2 active reviews". */
export function reviewCount(count: number, kind?: "active" | "archived"): string {
  const noun = `review${count === 1 ? "" : "s"}`;
  return kind === undefined ? `${count} ${noun}` : `${count} ${kind} ${noun}`;
}

/** repositoryCounts is what a repository holds: its tasks, and its reviews when it has any. */
export function repositoryCounts(repository: Repository): string {
  const parts = [
    taskCount(repository.activeTasks, "active"),
    taskCount(repository.archivedTasks, "archived"),
  ];
  const reviews = repository.activeReviews + repository.archivedReviews;
  if (reviews > 0) {
    parts.push(reviewCount(reviews));
  }
  return parts.join(" · ");
}

/**
 * removeBlockedText says what keeps a repository from being removed, null when
 * nothing does: its tasks first, then its reviews of pull requests.
 */
export function removeBlockedText(repository: Repository): string | null {
  const fix = "Delete them before removing the repository.";
  if (repository.activeTasks > 0 || repository.archivedTasks > 0) {
    const active = taskCount(repository.activeTasks, "active");
    const archived = taskCount(repository.archivedTasks, "archived");
    return `${repository.fullName} has ${active} and ${archived}. ${fix}`;
  }
  if (repository.activeReviews > 0 || repository.archivedReviews > 0) {
    const active = reviewCount(repository.activeReviews, "active");
    const archived = reviewCount(repository.archivedReviews, "archived");
    return `${repository.fullName} has ${active} and ${archived}. ${fix}`;
  }
  return null;
}

/** filterLabel names what the filter shows: "All repositories" or owner/name. */
export function filterLabel(app: State | null, filter: string): string {
  return findRepository(app, filter)?.fullName ?? "All repositories";
}

/** tasksInFilter keeps the tasks of the repository the filter shows. */
export function tasksInFilter<T extends { repositoryId: string }>(
  tasks: readonly T[],
  filter: string,
): readonly T[] {
  if (filter === ALL_REPOSITORIES) {
    return tasks;
  }
  return tasks.filter((task) => task.repositoryId === filter);
}

// A repository the dialog can create a task in: registered, cloned, with its
// clone where it is.
function usable(app: State, id: string): boolean {
  const repository = findRepository(app, id);
  return repository?.cloned === true && !repository.missing;
}

/**
 * defaultRepositoryId is the repository the creation dialog opens on: the one of
 * the filter, of the open task, of the last task created, or the first; the
 * first of those that is registered, cloned, and whose clone is there. "" when
 * none is.
 */
export function defaultRepositoryId(
  app: State,
  openTaskId: string | null,
  lastRepositoryId: string | null,
): string {
  const openTask = (app.tasks ?? []).find((task) => task.id === openTaskId);
  const candidates = [
    app.repositoryFilter,
    openTask?.repositoryId ?? "",
    lastRepositoryId ?? "",
    repositoriesOf(app)[0]?.id ?? "",
  ];
  return candidates.find((id) => id !== "" && usable(app, id)) ?? "";
}

/** takenNames are the names a new task cannot have in a repository: its tasks, active and archived. */
export function takenNames(app: State, repositoryId: string): string[] {
  const active = tasksInFilter(app.tasks ?? [], repositoryId);
  const archived = tasksInFilter(app.history ?? [], repositoryId);
  return [...active, ...archived].map((task) => task.name);
}
