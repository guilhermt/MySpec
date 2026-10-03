import { displayPath } from "@/lib/paths";
import {
  asReleaseKind,
  asRepositoryLinkKind,
  type BoardPreview,
  type BoardRepositoryChoice,
  type BoardRepositoryOption,
  type Repository,
} from "@/lib/wails";

/** pluralize is a count with its noun: "1 card", "3 cards". */
export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

/** listOf joins names the way a sentence does: "a", "a and b", "a, b and c". */
function listOf(names: readonly string[]): string {
  if (names.length < 2) {
    return names.join("");
  }
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/**
 * linkText says how a repository of the board ties to the app once the board is saved. The
 * repository is the registered one, for the clone that is missing.
 */
export function linkText(option: BoardRepositoryOption, repository: Repository | null): string {
  switch (asRepositoryLinkKind(option.link)) {
    case "registered":
      if (repository?.missing === true) {
        return `Registered · the clone at ${displayPath(option.path || repository.path)} is missing`;
      }
      return `Registered · ${option.path === "" ? "Not cloned" : displayPath(option.path)}`;
    case "clone": {
      const found = (option.clones ?? []).length;
      return found > 1
        ? `Clone found · ${found} clones:`
        : `Clone found · ${displayPath(option.path)}`;
    }
    case "uncloned":
      return "Registered without a clone";
    case "other_board":
      return `${option.fullName} belongs to the board ${option.otherBoard}.`;
  }
}

/** chosenCloneOf is the clone a found repository ties to: the one the user picked, or the one found first. */
export function chosenCloneOf(
  option: BoardRepositoryOption,
  chosenClones: Readonly<Record<string, string>>,
): string {
  return (
    chosenClones[option.fullName] ??
    (option.path === "" ? ((option.clones ?? [])[0] ?? "") : option.path)
  );
}

/**
 * choicesOf is what saving the board sends for the repositories: the checked
 * ones a board can take, each with the clone it ties to when one was found.
 */
export function choicesOf(
  options: readonly BoardRepositoryOption[],
  chosenClones: Readonly<Record<string, string>>,
): BoardRepositoryChoice[] {
  return options
    .filter((option) => option.checked && option.link !== "other_board")
    .map((option) => ({
      owner: option.owner,
      name: option.name,
      path: option.link === "clone" ? chosenCloneOf(option, chosenClones) : "",
    }));
}

/**
 * withOption puts a repository the user typed into the options: it replaces
 * the one of the same full name, ignoring case as GitHub does, or goes last.
 */
export function withOption(
  options: readonly BoardRepositoryOption[],
  option: BoardRepositoryOption,
): BoardRepositoryOption[] {
  const wanted = option.fullName.toLowerCase();
  const index = options.findIndex((current) => current.fullName.toLowerCase() === wanted);
  if (index === -1) {
    return [...options, option];
  }
  return options.map((current, at) => (at === index ? option : current));
}

export type BoardStep = "project" | "statuses" | "repositories";

/**
 * stepsOf are the steps of the dialog: add with or without the Status field, edit likewise. Before
 * the board is read, an add counts the statuses and an edit begins on them.
 */
export function stepsOf(mode: "add" | "edit", hasStatus: boolean | null): BoardStep[] {
  const rest: BoardStep[] = hasStatus === false ? ["repositories"] : ["statuses", "repositories"];
  return mode === "add" ? ["project", ...rest] : rest;
}

const STEP_NAMES: Record<BoardStep, string> = {
  project: "The project",
  statuses: "Statuses",
  repositories: "Repositories",
};

/**
 * subtitle is "Step 1 of 3 · The project", "Data Platform · acme · Step 2 of 3 · Statuses",
 * "Release Train · acme · Repositories". The board is the one read, or the one being edited while it
 * is read.
 */
export function subtitle(
  mode: "add" | "edit",
  board: Pick<BoardPreview, "title" | "owner"> | null,
  step: BoardStep,
  steps: readonly BoardStep[],
): string {
  const place = `Step ${steps.indexOf(step) + 1} of ${steps.length} · ${STEP_NAMES[step]}`;
  if (board === null) {
    return mode === "add" ? place : "";
  }
  const name = `${board.title} · ${board.owner}`;
  if (step === "project") {
    return place;
  }
  return steps.length === 1 && mode === "edit"
    ? `${name} · ${STEP_NAMES[step]}`
    : `${name} · ${place}`;
}

/** premarkHelp is "Done and To do are marked for you, from their names."; "" with none. */
export function premarkHelp(preview: BoardPreview): string {
  const statuses = preview.statuses ?? [];
  const finals = statuses.filter((status) => status.final);
  const starts = statuses.filter((status) => !status.final && status.id === preview.newCardStatus);
  const names = [...finals, ...starts].map((status) => status.name);
  if (names.length === 0) {
    return "";
  }
  return names.length === 1
    ? `${names[0]} is marked for you, from its name.`
    : `${listOf(names)} are marked for you, from their names.`;
}

/** changedNote is the note of a board that changed since its save; "" when nothing changed. */
export function changedNote(preview: BoardPreview): string {
  const gone = preview.goneStatuses ?? [];
  const added = new Set(preview.newStatusIds ?? []);
  const fresh = (preview.statuses ?? [])
    .filter((status) => added.has(status.id))
    .map((status) => status.name);
  const parts = [
    ...(gone.length > 0
      ? [`${listOf(gone)} ${gone.length === 1 ? "is" : "are"} gone from its statuses`]
      : []),
    ...(fresh.length > 0
      ? [`${listOf(fresh)} ${fresh.length === 1 ? "is" : "are"} new, not marked`]
      : []),
  ];
  if (parts.length === 0 && !preview.newCardStatusGone) {
    return "";
  }
  const changed = "The board changed since it was saved.";
  const named = parts.length > 0 ? ` ${parts.join(", and ")}.` : "";
  return `${changed}${named}${preview.newCardStatusGone ? " New cards now start with no status." : ""}`;
}

/**
 * consequence is "Moves to No board: it has a clone and 3 archived tasks. Its tasks keep working."
 * or "Leaves MySpec: it has no clone, tasks or reviews."; "" for a repository that stays or isn't
 * the board's own.
 */
export function consequence(option: BoardRepositoryOption, repository: Repository | null): string {
  const release = asReleaseKind(option.release);
  if (option.checked || release === "") {
    return "";
  }
  if (release === "leave") {
    return "Leaves MySpec: it has no clone, tasks or reviews.";
  }
  const tasks = (repository?.activeTasks ?? 0) + (repository?.archivedTasks ?? 0);
  const reviews = (repository?.activeReviews ?? 0) + (repository?.archivedReviews ?? 0);
  const cloned = repository?.cloned === true;
  const has = [
    ...(cloned ? ["a clone"] : []),
    ...(repository !== null && repository.activeTasks > 0
      ? [pluralize(repository.activeTasks, "active task")]
      : []),
    ...(repository !== null && repository.archivedTasks > 0
      ? [pluralize(repository.archivedTasks, "archived task")]
      : []),
    ...(reviews > 0 ? [pluralize(reviews, "review")] : []),
  ];
  if (has.length === 0) {
    return "Moves to No board.";
  }
  return [
    `Moves to No board: it has ${listOf(has)}.`,
    ...(tasks > 0 ? ["Its tasks keep working."] : []),
    ...(reviews > 0 ? ["Its reviews keep working."] : []),
    ...(cloned ? ["Nothing on disk changes."] : []),
  ].join(" ");
}

/** footerSum is "acme/docs moves to No board, and acme/billing leaves MySpec."; "" with nothing unchecked. */
export function footerSum(
  options: readonly BoardRepositoryOption[],
  initiallyChecked: ReadonlySet<string>,
): string {
  const unchecked = options.filter(
    (option) => !option.checked && initiallyChecked.has(option.fullName),
  );
  const named = (release: "no_board" | "leave") =>
    unchecked
      .filter((option) => asReleaseKind(option.release) === release)
      .map((option) => option.fullName);
  const moving = named("no_board");
  const leaving = named("leave");
  const clauses = [
    ...(moving.length > 0
      ? [`${listOf(moving)} ${moving.length === 1 ? "moves" : "move"} to No board`]
      : []),
    ...(leaving.length > 0
      ? [`${listOf(leaving)} ${leaving.length === 1 ? "leaves" : "leave"} MySpec`]
      : []),
  ];
  return clauses.length === 0 ? "" : `${clauses.join(", and ")}.`;
}
