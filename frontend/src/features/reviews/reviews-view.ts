import type { PullRequestRow, ReviewCenter, ReviewFilters, State } from "@/lib/wails";

/** NO_BOARD is the board filter of the repositories that belong to none. */
export const NO_BOARD = "__none__";

/** EMPTY_REVIEW_FILTERS is a Reviews view that shows every pull request. */
export const EMPTY_REVIEW_FILTERS: ReviewFilters = {
  boardId: "",
  repositoryId: "",
  authorsInclude: [],
  authorsExclude: [],
  labelsInclude: [],
  labelsExclude: [],
  pendingOnly: false,
};

/** MultiFilterKind is a filter that both includes and excludes values: the author, the label. */
export type MultiFilterKind = "author" | "label";

/** FilterState is what a multi filter does with one value. */
export type FilterState = "include" | "exclude" | "none";

/** visibleRows is what the Reviews view lists: the pull requests the filters keep, in reading order. */
export function visibleRows(center: ReviewCenter): PullRequestRow[] {
  return (center.pullRequests ?? []).filter((row) => !row.filtered);
}

/**
 * emptyText says why the Reviews view has nothing to list: no repositories, no
 * open pull requests, or none the filters keep.
 */
export function emptyText(app: State | null): string {
  if ((app?.repositories ?? []).length === 0) {
    return "Register a repository to see its pull requests.";
  }
  if ((app?.reviewCenter.pullRequests ?? []).length === 0) {
    return "No open pull requests.";
  }
  return "No pull requests match the filters.";
}

function listsOf(
  filters: ReviewFilters,
  kind: MultiFilterKind,
): { include: readonly string[]; exclude: readonly string[] } {
  return kind === "author"
    ? { include: filters.authorsInclude ?? [], exclude: filters.authorsExclude ?? [] }
    : { include: filters.labelsInclude ?? [], exclude: filters.labelsExclude ?? [] };
}

function withLists(
  filters: ReviewFilters,
  kind: MultiFilterKind,
  include: readonly string[],
  exclude: readonly string[],
): ReviewFilters {
  return kind === "author"
    ? { ...filters, authorsInclude: [...include], authorsExclude: [...exclude] }
    : { ...filters, labelsInclude: [...include], labelsExclude: [...exclude] };
}

/** filterState is what a multi filter does with one value right now. */
export function filterState(
  filters: ReviewFilters,
  kind: MultiFilterKind,
  value: string,
): FilterState {
  const { include, exclude } = listsOf(filters, kind);
  if (include.includes(value)) {
    return "include";
  }
  return exclude.includes(value) ? "exclude" : "none";
}

/**
 * cycleFilter is the filters after one click on a value: nothing, excluded,
 * included, nothing again. Excluding comes first because it is what the view is
 * mostly used for: taking a bot out of sight.
 */
export function cycleFilter(
  filters: ReviewFilters,
  kind: MultiFilterKind,
  value: string,
): ReviewFilters {
  const { include, exclude } = listsOf(filters, kind);
  const without = {
    include: include.filter((other) => other !== value),
    exclude: exclude.filter((other) => other !== value),
  };
  switch (filterState(filters, kind, value)) {
    case "none":
      return withLists(filters, kind, without.include, [...without.exclude, value]);
    case "exclude":
      return withLists(filters, kind, [...without.include, value], without.exclude);
    case "include":
      return withLists(filters, kind, without.include, without.exclude);
  }
}

/** filterSummary is a multi filter in the words of its trigger: "Any", "−dependabot", "+alice −bot". */
export function filterSummary(filters: ReviewFilters, kind: MultiFilterKind): string {
  const { include, exclude } = listsOf(filters, kind);
  const parts = [...include.map((value) => `+${value}`), ...exclude.map((value) => `−${value}`)];
  return parts.length === 0 ? "Any" : parts.join(" ");
}

/** isFiltering reports whether any filter of the view narrows what it shows. */
export function isFiltering(filters: ReviewFilters): boolean {
  return (
    filters.boardId !== "" ||
    filters.repositoryId !== "" ||
    (filters.authorsInclude ?? []).length > 0 ||
    (filters.authorsExclude ?? []).length > 0 ||
    (filters.labelsInclude ?? []).length > 0 ||
    (filters.labelsExclude ?? []).length > 0 ||
    filters.pendingOnly
  );
}
