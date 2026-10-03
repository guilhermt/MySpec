import { displayPath, displayPaths } from "@/lib/paths";
import { reviewCount, taskCount } from "@/lib/repositories";
import type { Board, Repository } from "@/lib/wails";

/** NEEDS_A_CLONE_ID is the id of the group of the repositories that can't start a task. */
export const NEEDS_A_CLONE_ID = "needs-a-clone";

/** NO_BOARD is how a repository that no board manages is called. */
const NO_BOARD = "No board";

export interface RepositoryGroup {
  id: string;
  title: string;
  note: string;
  repositories: Repository[];
}

function byName(a: Repository, b: Repository): number {
  return a.fullName.localeCompare(b.fullName);
}

/** needsAClone tells whether a repository has no clone, or one that is gone. */
export function needsAClone(repository: Repository): boolean {
  return !repository.cloned || repository.missing;
}

/** repositoryGroups are Needs a clone, one per board by title, and No board; empty ones left out. */
export function repositoryGroups(
  repositories: readonly Repository[],
  boards: readonly Board[],
): RepositoryGroup[] {
  const sorted = [...repositories].sort(byName);
  const withoutClone = sorted.filter((repository) => !repository.cloned);
  const missing = sorted.filter((repository) => repository.cloned && repository.missing);
  const rest = sorted.filter((repository) => !needsAClone(repository));
  const groups: RepositoryGroup[] = [
    {
      id: NEEDS_A_CLONE_ID,
      title: "Needs a clone",
      note: "Their cards can't start a task until they have one",
      repositories: [...withoutClone, ...missing],
    },
  ];
  const known = new Set<string>();
  const byTitle = [...boards].sort((a, b) => a.title.localeCompare(b.title));
  for (const board of byTitle) {
    known.add(board.id);
    groups.push({
      id: board.id,
      title: board.title,
      note: "",
      repositories: rest.filter((repository) => repository.boardId === board.id),
    });
  }
  groups.push({
    id: "no-board",
    title: NO_BOARD,
    note: "",
    repositories: rest.filter((repository) => !known.has(repository.boardId)),
  });
  return groups.filter((group) => group.repositories.length > 0);
}

/** hasInstructions tells whether the reviews of a repository are told something of their own. */
export function hasInstructions(repository: Repository): boolean {
  return repository.reviewInstructions.trim() !== "";
}

/** pathLine is "~/code/web", "Not cloned", "Platform Roadmap · Not cloned", plus " · Review instructions set". */
export function pathLine(
  repository: Repository,
  boardTitle: string | null,
  inNeedsAClone: boolean,
): string {
  const where = repository.cloned ? displayPath(repository.path) : "Not cloned";
  const parts = inNeedsAClone ? [boardTitle ?? NO_BOARD, where] : [where];
  if (hasInstructions(repository)) {
    parts.push("Review instructions set");
  }
  return parts.join(" · ");
}

/** holdings are the parts a repository holds, each only when it is not zero: its tasks and its reviews. */
function holdings(repository: Repository, short: boolean): string[] {
  const reviews = repository.activeReviews + repository.archivedReviews;
  const { activeTasks, archivedTasks } = repository;
  return [
    activeTasks > 0 ? (short ? `${activeTasks} active` : taskCount(activeTasks, "active")) : "",
    archivedTasks > 0
      ? short
        ? `${archivedTasks} archived`
        : taskCount(archivedTasks, "archived")
      : "",
    reviews > 0 ? reviewCount(reviews) : "",
  ].filter((part) => part !== "");
}

/** countsLine is "4 active · 7 archived · 1 review" or "No tasks or reviews". */
export function countsLine(repository: Repository): string {
  const parts = holdings(repository, true);
  return parts.length === 0 ? "No tasks or reviews" : parts.join(" · ");
}

/** rowName is "acme/web, ~/code/web, 4 active tasks, 7 archived tasks, 1 review". */
export function rowName(repository: Repository): string {
  const counts = holdings(repository, false);
  return [
    repository.fullName,
    repository.cloned ? displayPath(repository.path) : "not cloned",
    ...(counts.length === 0 ? ["no tasks or reviews"] : counts),
  ].join(", ");
}

/** removeReason is "8 archived tasks and 4 reviews: delete them first."; null when it can be removed. */
export function removeReason(repository: Repository): string | null {
  const parts = holdings(repository, false);
  const last = parts.pop();
  if (last === undefined) {
    return null;
  }
  const list = parts.length === 0 ? last : `${parts.join(", ")} and ${last}`;
  return `${list}: delete them first.`;
}

/** BlockLineView is what a row says under it, and the action that answers it. */
export type BlockLineView =
  | { kind: "no-clone"; text: string; action: "clone" }
  | { kind: "cloning"; text: string }
  | { kind: "failed"; text: string; action: "try-again" }
  | { kind: "missing"; text: string; action: "change-path" };

/** blockLine is what the row says under it: none, no clone, cloning, clone failed, missing. */
export function blockLine(repository: Repository, cloneFolder: string): BlockLineView | null {
  if (repository.cloning) {
    const into =
      cloneFolder === "" ? "" : ` into ${displayPath(`${cloneFolder}/${repository.name}`)}`;
    return { kind: "cloning", text: `Cloning${into}…` };
  }
  if (!repository.cloned) {
    if (repository.cloneError !== "") {
      return { kind: "failed", text: displayPaths(repository.cloneError), action: "try-again" };
    }
    return {
      kind: "no-clone",
      text: "Its cards can't start a task until it's cloned.",
      action: "clone",
    };
  }
  if (repository.missing) {
    return {
      kind: "missing",
      text: "The clone is missing. Its tasks can't start a step or close until it has one.",
      action: "change-path",
    };
  }
  return null;
}

/** removeSentence is the body of Remove repository, with and without board and clone. */
export function removeSentence(repository: Repository, boardTitle: string | null): string {
  const leaves = `The repository leaves MySpec${boardTitle === null ? "" : ` and the board ${boardTitle}`}.`;
  const clone =
    repository.cloned && !repository.missing
      ? `the clone stays at ${displayPath(repository.path)}.`
      : "";
  return clone === ""
    ? `${leaves} Nothing is deleted on disk.`
    : `${leaves} Nothing is deleted on disk: ${clone}`;
}
