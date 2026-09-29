import { boardOfRepository, findBoard } from "@/lib/boards";
import type { PromptStage, State } from "@/lib/wails";

/** SettingsSection is what the settings screen shows: the defaults of a new task, the boards, the repositories or one prompt. */
export type SettingsSection = "defaults" | "boards" | "repositories" | PromptStage;

/** GoneItem is what left the state while its place was open. */
export type GoneItem = "task" | "review" | "discussion" | "board";

/** Location is the one place the main area shows. */
export type Location =
  | { kind: "home" }
  | { kind: "board"; id: string }
  | { kind: "reviews" }
  | { kind: "history" }
  | { kind: "settings"; section: SettingsSection }
  | { kind: "task"; id: string }
  | { kind: "review"; id: string }
  | { kind: "discussion"; id: string }
  | { kind: "archived-task"; id: string }
  | { kind: "archived-review"; id: string }
  | { kind: "archived-discussion"; id: string }
  /** gone is the page of an item that left while open: its name and the board it lived under ("" for none) are kept, because the state no longer has them. */
  | { kind: "gone"; item: GoneItem; id: string; name: string; boardId: string };

/** Crumb is one level of the breadcrumb: a place it opens, or plain text. */
export interface Crumb {
  label: string;
  location: Location | null;
}

/** HOME is the place with nothing else open. */
export const HOME: Location = { kind: "home" };

/** NAV_LIMIT is how many places the history keeps behind the current one. */
export const NAV_LIMIT = 50;

const SETTINGS_SECTIONS: readonly string[] = [
  "defaults",
  "boards",
  "repositories",
  "prd",
  "tech_spec",
  "plan",
  "one_shot",
  "step_review",
  "commit",
  "pr",
  "pr_review",
  "discussion",
] satisfies readonly SettingsSection[];

const GONE_ITEMS: readonly string[] = [
  "task",
  "review",
  "discussion",
  "board",
] satisfies readonly GoneItem[];

const REVIEWS: Location = { kind: "reviews" };
const HISTORY: Location = { kind: "history" };

// The id a place is about, "" for the places that are about nothing in particular.
function idOf(location: Location): string {
  switch (location.kind) {
    case "home":
    case "reviews":
    case "history":
    case "settings":
      return "";
    default:
      return location.id;
  }
}

/** sameLocation tells whether two places are the same one: the same kind and id; any two pages of Settings are the same place. */
export function sameLocation(a: Location, b: Location): boolean {
  if (a.kind !== b.kind || idOf(a) !== idOf(b)) {
    return false;
  }
  return a.kind !== "gone" || b.kind !== "gone" || a.item === b.item;
}

function findTask(app: State | null, id: string) {
  return (app?.tasks ?? []).find((task) => task.id === id) ?? null;
}

function findReview(app: State | null, id: string) {
  return (app?.reviews ?? []).find((review) => review.id === id) ?? null;
}

function findDiscussion(app: State | null, id: string) {
  return (app?.discussions ?? []).find((discussion) => discussion.id === id) ?? null;
}

function findArchivedTask(app: State | null, id: string) {
  return (app?.history ?? []).find((task) => task.id === id) ?? null;
}

function findArchivedReview(app: State | null, id: string) {
  return (app?.reviewHistory ?? []).find((review) => review.id === id) ?? null;
}

function findArchivedDiscussion(app: State | null, id: string) {
  return (app?.discussionHistory ?? []).find((discussion) => discussion.id === id) ?? null;
}

/** locationExists tells whether a place can still be opened; the page of an item that left never is again. */
export function locationExists(app: State | null, location: Location): boolean {
  switch (location.kind) {
    case "home":
    case "reviews":
    case "history":
    case "settings":
      return true;
    case "board":
      return findBoard(app, location.id) !== null;
    case "task":
      return findTask(app, location.id) !== null;
    case "review":
      return findReview(app, location.id) !== null;
    case "discussion":
      return findDiscussion(app, location.id) !== null;
    case "archived-task":
      return findArchivedTask(app, location.id) !== null;
    case "archived-review":
      return findArchivedReview(app, location.id) !== null;
    case "archived-discussion":
      return findArchivedDiscussion(app, location.id) !== null;
    case "gone":
      return false;
  }
}

/** locationTitle is the name of a place, "" for one that no longer exists. */
export function locationTitle(app: State | null, location: Location): string {
  switch (location.kind) {
    case "home":
      return "Home";
    case "reviews":
      return "Reviews";
    case "history":
      return "History";
    case "settings":
      return "Settings";
    case "board":
      return findBoard(app, location.id)?.title ?? "";
    case "task":
      return findTask(app, location.id)?.name ?? "";
    case "review":
      return findReview(app, location.id)?.title ?? "";
    case "discussion":
      return findDiscussion(app, location.id)?.title ?? "";
    case "archived-task":
      return findArchivedTask(app, location.id)?.name ?? "";
    case "archived-review":
      return findArchivedReview(app, location.id)?.title ?? "";
    case "archived-discussion":
      return findArchivedDiscussion(app, location.id)?.title ?? "";
    case "gone":
      return location.name;
  }
}

// The board a place lives under, as a link, or No board as plain text.
function boardCrumb(app: State | null, boardId: string): Crumb {
  const board = findBoard(app, boardId);
  return board === null
    ? { label: "No board", location: null }
    : { label: board.title, location: { kind: "board", id: board.id } };
}

/** breadcrumbOf is the levels above a place, the outermost first; empty for a place with none. */
export function breadcrumbOf(app: State | null, location: Location): Crumb[] {
  switch (location.kind) {
    case "task": {
      const task = findTask(app, location.id);
      if (task === null) {
        return [];
      }
      const board = boardOfRepository(app, task.repositoryId);
      if (board === null) {
        return [{ label: "No board", location: null }];
      }
      const epic = task.card?.epic ?? null;
      const crumbs: Crumb[] = [{ label: board.title, location: { kind: "board", id: board.id } }];
      return epic === null ? crumbs : [...crumbs, { label: epic.title, location: null }];
    }
    case "discussion": {
      const discussion = findDiscussion(app, location.id);
      return discussion === null ? [] : [boardCrumb(app, discussion.boardId)];
    }
    case "review":
      return [{ label: "Reviews", location: REVIEWS }];
    case "archived-task":
    case "archived-review":
    case "archived-discussion":
      return [{ label: "History", location: HISTORY }];
    case "home":
    case "board":
    case "reviews":
    case "history":
    case "settings":
    case "gone":
      return [];
  }
}

/** openItemId is the id of the active item a place shows, null for a place that shows none. */
export function openItemId(location: Location): string | null {
  return isActiveItem(location) ? idOf(location) : null;
}

/** isActiveItem tells whether a place is an active item: a task, a review or a discussion. */
export function isActiveItem(location: Location): boolean {
  return location.kind === "task" || location.kind === "review" || location.kind === "discussion";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** isLocation tells whether a value read back from storage is a place. */
export function isLocation(value: unknown): value is Location {
  if (!isRecord(value)) {
    return false;
  }
  switch (value.kind) {
    case "home":
    case "reviews":
    case "history":
      return true;
    case "settings":
      return typeof value.section === "string" && SETTINGS_SECTIONS.includes(value.section);
    case "board":
    case "task":
    case "review":
    case "discussion":
    case "archived-task":
    case "archived-review":
    case "archived-discussion":
      return typeof value.id === "string";
    case "gone":
      return (
        typeof value.item === "string" &&
        GONE_ITEMS.includes(value.item) &&
        typeof value.id === "string" &&
        typeof value.name === "string" &&
        typeof value.boardId === "string"
      );
    default:
      return false;
  }
}

/** isLocationList tells whether a value read back from storage is a list of places. */
export function isLocationList(value: unknown): value is Location[] {
  return Array.isArray(value) && value.every(isLocation);
}

/** GoneLocation is the page of an item that left while open. */
export type GoneLocation = Extract<Location, { kind: "gone" }>;

/** GoneOutcome is what became of an item that left: archived, deleted, its pull request merged or closed, or the board removed. */
export type GoneOutcome = "archived" | "deleted" | "merged" | "closed" | "removed";

/** goneOutcome reads from the state what became of an item that left. */
export function goneOutcome(app: State | null, gone: GoneLocation): GoneOutcome {
  switch (gone.item) {
    case "task":
      return findArchivedTask(app, gone.id) === null ? "deleted" : "archived";
    case "review": {
      const archived = findArchivedReview(app, gone.id);
      if (archived === null) {
        return "deleted";
      }
      return archived.outcome === "merged" ? "merged" : "closed";
    }
    case "discussion":
      return findArchivedDiscussion(app, gone.id) === null ? "deleted" : "archived";
    case "board":
      return "removed";
  }
}

/** goneTitle is what the page of an item that left says of it. */
export function goneTitle(gone: GoneLocation, outcome: GoneOutcome): string {
  switch (outcome) {
    case "archived":
      return gone.item === "task"
        ? `${gone.name} was closed and archived`
        : `${gone.name} was archived`;
    case "deleted":
      return `${gone.name} was deleted`;
    case "merged":
      return `${gone.name} was merged, and its review ended`;
    case "closed":
      return `${gone.name} was closed without a merge`;
    case "removed":
      return "This board was removed.";
  }
}
