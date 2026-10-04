import { displayPath } from "@/lib/paths";
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

// SHARED is, for each state, the short names more than one repository answers to.
const SHARED = new WeakMap<State, ReadonlySet<string>>();

/**
 * sharedNames are the short names, in lower case, of the repositories the state knows, registered or
 * named by an archived item of the window, that two or more of them answer to: acme/api and globex/api.
 */
export function sharedNames(app: State): ReadonlySet<string> {
  const known = SHARED.get(app);
  if (known !== undefined) {
    return known;
  }
  const owners = new Map<string, Set<string>>();
  const names = [
    ...(app.repositories ?? []).map((repository) => repository.fullName),
    ...(app.history ?? []).map((task) => task.repository),
    ...(app.reviewHistory ?? []).map((review) => review.repository),
  ];
  for (const fullName of names) {
    const name = shortName(fullName).toLowerCase();
    owners.set(name, (owners.get(name) ?? new Set()).add(fullName.toLowerCase()));
  }
  const shared = new Set([...owners].filter(([, full]) => full.size > 1).map(([name]) => name));
  SHARED.set(app, shared);
  return shared;
}

/** shortRef is an issue as the screen writes it, "billing#479" for "acme/billing#479". */
export function shortRef(reference: string): string {
  const hash = reference.lastIndexOf("#");
  return hash === -1 ? reference : `${shortName(reference.slice(0, hash))}${reference.slice(hash)}`;
}

/** findRepository is the registered repository of an id, null when none is. */
export function findRepository(app: State | null, id: string): Repository | null {
  return repositoriesOf(app).find((repository) => repository.id === id) ?? null;
}

/** cloneMissingText is the warning of a repository whose clone is gone. */
export function cloneMissingText(repository: Repository): string {
  return `The clone at ${displayPath(repository.path)} is missing.`;
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
 * the filter, of the open task, of the last task created, or the first usable of
 * the list; the first of those that is registered, cloned, and whose clone is there. "" when
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
    repositoriesOf(app).find((repository) => usable(app, repository.id))?.id ?? "",
  ];
  return candidates.find((id) => id !== "" && usable(app, id)) ?? "";
}

/** takenNames are the names a new task cannot have in a repository: its tasks, active and archived. */
export function takenNames(app: State, repositoryId: string): string[] {
  const active = tasksInFilter(app.tasks ?? [], repositoryId);
  const archived = tasksInFilter(app.history ?? [], repositoryId);
  return [...active, ...archived].map((task) => task.name);
}
