import {
  asRepositoryLinkKind,
  type BoardRepositoryChoice,
  type BoardRepositoryOption,
} from "@/lib/wails";

/** pluralize is a count with its noun: "1 card", "3 cards". */
export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

/** linkText says how a repository of the board ties to the app once the board is saved. */
export function linkText(option: BoardRepositoryOption): string {
  switch (asRepositoryLinkKind(option.link)) {
    case "registered":
      return `Registered · ${option.path === "" ? "Not cloned" : option.path}`;
    case "clone":
      return (option.clones ?? []).length > 1 ? "Clone found" : `Clone found · ${option.path}`;
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
