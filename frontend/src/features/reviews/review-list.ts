import type { FilterGroup } from "@/components/system/FilterBar";
import { TONE_GLYPHS } from "@/components/system/item-parts";
import type { KeyNoticeText } from "@/components/system/KeyNotice";
import type { PullRequestRowState, PullRequestRowView } from "@/components/system/ListRow";
import type { FilterCycle } from "@/components/system/Menu";
import { reviewRow, waitSuffix } from "@/features/sidebar/sidebar-tree";
import { cloneMissingText, findRepository, shortName } from "@/lib/repositories";
import { lowerFirst } from "@/lib/situations";
import type { PullRequestRow, PullReview, ReviewCenter, ReviewFilters, State } from "@/lib/wails";
import { asPullRequestAction, asYourReviewState } from "@/lib/wails";
import { age, reviewMoment } from "@/lib/when";

/** ReviewSectionId is a section of the list of Reviews. */
export type ReviewSectionId = "pending" | "in_review" | "reviewed" | "yours";

/** ReviewSection is one collapsible group of the list, with the rows the filters keep. */
export interface ReviewSection {
  id: ReviewSectionId;
  name: string;
  tooltip: string;
  rows: PullRequestRow[];
}

/** DEFAULT_COLLAPSED are the sections that never wait for the user: collapsed until the user opens them. */
export const DEFAULT_COLLAPSED: readonly ReviewSectionId[] = ["reviewed", "yours"];

// SECTIONS are the sections in the order of the list, with what each gathers.
const SECTIONS: readonly { id: ReviewSectionId; name: string; tooltip: string }[] = [
  {
    id: "pending",
    name: "Pending",
    tooltip: "Never reviewed by you, or with commits after your last review",
  },
  { id: "in_review", name: "In review", tooltip: "Pull requests with a review in MySpec" },
  { id: "reviewed", name: "Reviewed", tooltip: "Reviewed by you, with nothing new since" },
  {
    id: "yours",
    name: "Yours and your tasks",
    tooltip: "Yours and the pull requests of your tasks: never pending",
  },
];

/** sectionOf is the section of a pull request: the first that holds, in review, yours, pending, reviewed. */
export function sectionOf(row: PullRequestRow): ReviewSectionId {
  if (row.reviewId !== "") {
    return "in_review";
  }
  if (row.own || row.taskId !== "") {
    return "yours";
  }
  return row.pending ? "pending" : "reviewed";
}

/**
 * reviewSections is the four sections of the list, in their order, each with
 * the rows the filters keep, the most recently updated first. An empty section
 * stays, so the list does not jump.
 */
export function reviewSections(center: ReviewCenter): ReviewSection[] {
  const kept = (center.pullRequests ?? [])
    .filter((row) => !row.filtered)
    .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
  return SECTIONS.map((section) => ({
    ...section,
    rows: kept.filter((row) => sectionOf(row) === section.id),
  }));
}

/** sectionLabel is the accessible name of a section header: "Pending, 4 pull requests". */
export function sectionLabel(section: ReviewSection): string {
  const count = section.rows.length;
  return `${section.name}, ${count} pull request${count === 1 ? "" : "s"}`;
}

/** ReviewsSectionsMemory is what Reviews keeps of its sections between runs. */
export interface ReviewsSectionsMemory {
  collapsed: ReviewSectionId[];
}

const SECTION_IDS: readonly string[] = SECTIONS.map((section) => section.id);

/** isReviewsSectionsMemory tells what Reviews kept of its sections from anything else. */
export function isReviewsSectionsMemory(value: unknown): value is ReviewsSectionsMemory {
  if (typeof value !== "object" || value === null || !("collapsed" in value)) {
    return false;
  }
  const { collapsed } = value;
  return (
    Array.isArray(collapsed) &&
    collapsed.every((id) => typeof id === "string" && SECTION_IDS.includes(id))
  );
}

/** ReviewListRow is one entry of the list as the keyboard and the screen walk it. */
export type ReviewListRow =
  | { kind: "section"; section: ReviewSection; collapsed: boolean }
  | { kind: "pr"; row: PullRequestRow; sectionId: ReviewSectionId };

/**
 * reviewRows is the list as the keyboard and the screen walk it: each header,
 * then the rows of an expanded section. An empty section is never collapsed.
 */
export function reviewRows(
  sections: readonly ReviewSection[],
  collapsed: ReadonlySet<string>,
): ReviewListRow[] {
  return sections.flatMap((section): ReviewListRow[] => {
    const folded = section.rows.length > 0 && collapsed.has(section.id);
    const header: ReviewListRow = { kind: "section", section, collapsed: folded };
    return folded
      ? [header]
      : [
          header,
          ...section.rows.map((row): ReviewListRow => ({ kind: "pr", row, sectionId: section.id })),
        ];
  });
}

/** rowReference is the reference of a pull request as the list shows it: web#2291. */
export function rowReference(row: PullRequestRow): string {
  return `${shortName(row.repository)}#${row.number}`;
}

/** yourReviewText is the last review you submitted: "You approved it today at 10:02". */
export function yourReviewText(review: PullReview, now: number): string {
  const moment = reviewMoment(review.at, now);
  const when = moment === "" ? "" : ` ${moment}`;
  switch (asYourReviewState(review.state)) {
    case "approved":
      return `You approved it${when}`;
    case "changes_requested":
      return `You requested changes${when}`;
    case "commented":
      return `You commented${when}`;
    case "dismissed":
      return `Your review was dismissed${when}`;
  }
}

/** PullRequestRowContext is what a row reads beyond its pull request. */
export interface PullRequestRowContext {
  app: State;
  now: number;
}

// RowState is the state column of a row and its part of the accessible name.
interface RowState {
  state: PullRequestRowState;
  spoken: string;
}

// rowState is the state of a row by the first case that holds: review, task,
// yours, fork, clone, pending, reviewed.
function rowState(row: PullRequestRow, ctx: PullRequestRowContext): RowState {
  const review = (ctx.app.reviews ?? []).find((candidate) => candidate.id === row.reviewId);
  if (row.reviewId !== "" && review !== undefined) {
    const item = reviewRow(review, ctx.now);
    const tooltip = `${item.line2.long}${waitSuffix(item)}`;
    return {
      state: {
        kind: "review",
        glyph: TONE_GLYPHS[item.tone],
        long: item.line2.long,
        short: item.line2.short,
        strong: item.waiting || item.tone === "error",
        tooltip: `Review: ${tooltip}`,
      },
      spoken: `review: ${tooltip}`,
    };
  }
  if (row.taskId !== "") {
    const task = (ctx.app.tasks ?? []).find((candidate) => candidate.id === row.taskId);
    const name = task?.name ?? row.taskId;
    return {
      state: { kind: "task", text: `Task · ${name}`, tooltip: "Its review happens in the task" },
      spoken: `the pull request of the task ${name}`,
    };
  }
  if (row.own) {
    return { state: text("Yours", "ink-3", null), spoken: "your pull request" };
  }
  const action = asPullRequestAction(row.action);
  if (action === "fork") {
    return {
      state: text("From a fork · can't be reviewed yet", "ink-3", null),
      spoken: "from a fork, can't be reviewed yet",
    };
  }
  const repository = findRepository(ctx.app, row.repositoryId);
  if (repository?.cloning === true) {
    const cloning = `Cloning ${row.repository}…`;
    return { state: { kind: "cloning", text: cloning }, spoken: lowerFirst(cloning) };
  }
  if (action === "clone" && (repository?.cloneError ?? "") !== "") {
    return { state: { kind: "clone-failed" }, spoken: "clone failed" };
  }
  if (row.pending) {
    return pendingState(row);
  }
  const yours = row.yourReview === null ? null : yourReviewText(row.yourReview, ctx.now);
  return {
    state: text("Reviewed", "ink-3", yours),
    spoken: yours === null ? "reviewed" : `reviewed: ${lowerFirst(yours)}`,
  };
}

function text(words: string, tone: "ink-2" | "ink-3", tooltip: string | null): PullRequestRowState {
  return { kind: "text", text: words, tone, tooltip };
}

// pendingState is a pending pull request: never reviewed by you, or with commits after your review.
function pendingState(row: PullRequestRow): RowState {
  if (!row.reviewed) {
    return { state: text("Never reviewed", "ink-2", null), spoken: "pending: never reviewed" };
  }
  const count = row.newCommitCount;
  if (count <= 0) {
    return {
      state: text("New commits", "ink-2", "Commits after your last review"),
      spoken: "pending: new commits after your review",
    };
  }
  const commits = `${count} new commit${count === 1 ? "" : "s"}`;
  return {
    state: text(
      commits,
      "ink-2",
      `${count} commit${count === 1 ? "" : "s"} after your last review`,
    ),
    spoken: `pending: ${commits} after your review`,
  };
}

// tags are the tags after the title: Draft, and the first label that doesn't
// repeat the author, with +N for the others.
function tagsOf(row: PullRequestRow): PullRequestRowView["tags"] {
  const tags: PullRequestRowView["tags"] = row.draft ? [{ text: "Draft", tooltip: null }] : [];
  const labels = (row.labels ?? []).map((label) => label.name);
  const shown = labels.find((name) => name.toLowerCase() !== row.author.toLowerCase());
  if (shown !== undefined) {
    tags.push({ text: shown, tooltip: null });
    if (labels.length > 1) {
      tags.push({ text: `+${labels.length - 1}`, tooltip: labels.join("\n") });
    }
  }
  return tags;
}

// foldedOf is the one tag the tags fold into when the title would go under a third of its row: +N,
// N for Draft and every label, all of them in the tooltip; null without a tag.
function foldedOf(
  row: PullRequestRow,
  tags: PullRequestRowView["tags"],
): PullRequestRowView["folded"] {
  if (tags.length === 0) return null;
  const all = [...(row.draft ? ["Draft"] : []), ...(row.labels ?? []).map((label) => label.name)];
  return { text: `+${all.length}`, tooltip: all.join("\n") };
}

function keysOf(row: PullRequestRow): PullRequestRowView["keys"] {
  switch (asPullRequestAction(row.action)) {
    case "review":
    case "clone":
      return "review";
    case "open_review":
      return "open";
    case "open_task":
      return "open task";
    default:
      return null;
  }
}

/** pullRequestRowModel is the row of a pull request: what its columns draw and its accessible name. */
export function pullRequestRowModel(
  row: PullRequestRow,
  ctx: PullRequestRowContext,
): PullRequestRowView {
  const reference = rowReference(row);
  const author = row.own ? "you" : row.author;
  const { state, spoken } = rowState(row, ctx);
  const label = [
    `${reference} ${row.title}`,
    `by ${author}`,
    ...(row.draft ? ["draft"] : []),
    ...(row.labels ?? []).map((one) => `label ${one.name}`),
    spoken,
  ].join(". ");
  const tags = tagsOf(row);
  return {
    key: row.key,
    reference,
    referenceTooltip: `${row.repository}#${row.number}`,
    title: row.title,
    tags,
    folded: foldedOf(row, tags),
    author,
    state,
    keys: keysOf(row),
    dashed: asPullRequestAction(row.action) === "fork",
    label,
  };
}

/** FORK_REASON is why a pull request from a fork has no review, in the panel and in the notice of R. */
export const FORK_REASON = "Pull requests from forks can't be reviewed yet.";

/** cloneMissingReason is why a pull request of a repository whose clone is missing has no review. */
export function cloneMissingReason(row: PullRequestRow, app: State): string {
  const repository = findRepository(app, row.repositoryId);
  return repository === null
    ? `The clone of ${row.repository} is missing.`
    : cloneMissingText(repository);
}

/** reviewKeyNotice is why R does nothing on a row, null when it acts. */
export function reviewKeyNotice(row: PullRequestRow, app: State): KeyNoticeText | null {
  const title = `No review of ${rowReference(row)}`;
  switch (asPullRequestAction(row.action)) {
    case "fork":
      return { title, reason: FORK_REASON };
    case "clone_missing":
      return { title, reason: cloneMissingReason(row, app) };
    default:
      return null;
  }
}

/** NO_BOARD is the board filter of the repositories that belong to none. */
export const NO_BOARD = "__none__";

/** EMPTY_REVIEW_FILTERS is a list of Reviews that shows every pull request. */
export const EMPTY_REVIEW_FILTERS: ReviewFilters = {
  boardId: "",
  repositoryId: "",
  authorsInclude: [],
  authorsExclude: [],
  labelsInclude: [],
  labelsExclude: [],
  boardName: "",
  repositoryName: "",
};

/** FilterChipKind is the filter a chip stands for. */
export type FilterChipKind = "board" | "repository" | "author" | "label";

/** ReviewFilterChip is a chosen filter as its chip shows it. */
export interface ReviewFilterChip {
  kind: FilterChipKind;
  /** value is the board id, the repository id, the login or the label the chip filters by. */
  value: string;
  /** label is "Board: Mobile App", "acme/web", "Author −dependabot" or "Label +bug". */
  label: string;
  /** removeLabel is "Remove the filter <label>". */
  removeLabel: string;
  /** orphan is why the filter no longer matches anything registered, null when it does. */
  orphan: string | null;
}

type CycleKind = "author" | "label";

function listsOf(
  filters: ReviewFilters,
  kind: CycleKind,
): { include: readonly string[]; exclude: readonly string[] } {
  return kind === "author"
    ? { include: filters.authorsInclude ?? [], exclude: filters.authorsExclude ?? [] }
    : { include: filters.labelsInclude ?? [], exclude: filters.labelsExclude ?? [] };
}

function withLists(
  filters: ReviewFilters,
  kind: CycleKind,
  include: readonly string[],
  exclude: readonly string[],
): ReviewFilters {
  return kind === "author"
    ? { ...filters, authorsInclude: [...include], authorsExclude: [...exclude] }
    : { ...filters, labelsInclude: [...include], labelsExclude: [...exclude] };
}

// boardName is the name the chip of the board filter shows: the name kept with
// the filter, the title the board has now, or else the id.
function boardName(filters: ReviewFilters, app: State): string {
  if (filters.boardId === NO_BOARD) {
    return "No board";
  }
  const board = (app.boards ?? []).find((candidate) => candidate.id === filters.boardId);
  return filters.boardName !== "" ? filters.boardName : (board?.title ?? filters.boardId);
}

function repositoryName(filters: ReviewFilters, app: State): string {
  const repository = findRepository(app, filters.repositoryId);
  return filters.repositoryName !== ""
    ? filters.repositoryName
    : (repository?.fullName ?? filters.repositoryId);
}

/** filterChips are the chips of the chosen filters, in the order board, repository, author, label. */
export function filterChips(filters: ReviewFilters, app: State): ReviewFilterChip[] {
  const chips: ReviewFilterChip[] = [];
  const chip = (kind: FilterChipKind, value: string, label: string, orphan: string | null) =>
    chips.push({ kind, value, label, removeLabel: `Remove the filter ${label}`, orphan });
  if (filters.boardId !== "") {
    const name = boardName(filters, app);
    const known =
      filters.boardId === NO_BOARD ||
      (app.boards ?? []).some((board) => board.id === filters.boardId);
    chip(
      "board",
      filters.boardId,
      `Board: ${name}`,
      known ? null : `${name} isn't a board anymore.`,
    );
  }
  if (filters.repositoryId !== "") {
    const name = repositoryName(filters, app);
    const known = findRepository(app, filters.repositoryId) !== null;
    chip(
      "repository",
      filters.repositoryId,
      name,
      known ? null : `${name} isn't registered anymore.`,
    );
  }
  for (const kind of ["author", "label"] as const) {
    const { include, exclude } = listsOf(filters, kind);
    const word = kind === "author" ? "Author" : "Label";
    for (const value of exclude) {
      chip(kind, value, `${word} −${value}`, null);
    }
    for (const value of include) {
      chip(kind, value, `${word} +${value}`, null);
    }
  }
  return chips;
}

/** CycleItem is a value of a three-way filter of the menu: an author or a label, and what the filter does with it. */
export interface CycleItem {
  value: string;
  label: string;
  state: FilterCycle;
}

function sameValue(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase();
}

function cycleState(filters: ReviewFilters, kind: CycleKind, value: string): FilterCycle {
  const { include, exclude } = listsOf(filters, kind);
  if (include.some((other) => sameValue(other, value))) {
    return "only";
  }
  return exclude.some((other) => sameValue(other, value)) ? "hidden" : "any";
}

/**
 * filterGroups is what the Filter menu offers: the boards in the order of the
 * app and No board last, the repositories by owner/name, the authors of the
 * reading with the account of gh as "· you", and the labels of the reading.
 */
export function filterGroups(
  filters: ReviewFilters,
  center: ReviewCenter,
  app: State,
): { board: FilterGroup; repository: FilterGroup; authors: CycleItem[]; labels: CycleItem[] } {
  const board: FilterGroup = {
    label: "Board",
    items: [
      ...(app.boards ?? []).map((one) => ({
        value: one.id,
        label: one.title,
        checked: filters.boardId === one.id,
      })),
      { value: NO_BOARD, label: "No board", checked: filters.boardId === NO_BOARD },
    ],
  };
  const repository: FilterGroup = {
    label: "Repository",
    items: [...(app.repositories ?? [])]
      .sort((a, b) => a.fullName.localeCompare(b.fullName))
      .map((one) => ({
        value: one.id,
        label: one.fullName,
        checked: filters.repositoryId === one.id,
      })),
  };
  const viewer = (center.pullRequests ?? []).find((row) => row.own)?.author ?? "";
  const authors = [...(center.authors ?? [])]
    .sort((a, b) => a.localeCompare(b))
    .map((login) => ({
      value: login,
      label: viewer !== "" && sameValue(login, viewer) ? `${login} · you` : login,
      state: cycleState(filters, "author", login),
    }));
  const labels = (center.labels ?? []).map((name) => ({
    value: name,
    label: name,
    state: cycleState(filters, "label", name),
  }));
  return { board, repository, authors, labels };
}

/**
 * withBoard is the filters after picking a board in the menu: picking the
 * chosen one clears it; another keeps its id and its name, the title of the
 * board or No board.
 */
export function withBoard(filters: ReviewFilters, id: string, name: string): ReviewFilters {
  if (filters.boardId === id) {
    return { ...filters, boardId: "", boardName: "" };
  }
  return { ...filters, boardId: id, boardName: id === NO_BOARD ? "No board" : name };
}

/** withRepository is the filters after picking a repository in the menu, as withBoard does with a board. */
export function withRepository(filters: ReviewFilters, id: string, name: string): ReviewFilters {
  if (filters.repositoryId === id) {
    return { ...filters, repositoryId: "", repositoryName: "" };
  }
  return { ...filters, repositoryId: id, repositoryName: name };
}

/** cycled is the filters with an author or a label in a new state: hidden excludes it, only keeps only it. */
export function cycled(
  filters: ReviewFilters,
  kind: CycleKind,
  value: string,
  next: FilterCycle,
): ReviewFilters {
  const { include, exclude } = listsOf(filters, kind);
  const without = {
    include: include.filter((other) => !sameValue(other, value)),
    exclude: exclude.filter((other) => !sameValue(other, value)),
  };
  switch (next) {
    case "any":
      return withLists(filters, kind, without.include, without.exclude);
    case "hidden":
      return withLists(filters, kind, without.include, [...without.exclude, value]);
    case "only":
      return withLists(filters, kind, [...without.include, value], without.exclude);
  }
}

/** withoutChip is the filters without the one a chip stands for. */
export function withoutChip(filters: ReviewFilters, chip: ReviewFilterChip): ReviewFilters {
  switch (chip.kind) {
    case "board":
      return { ...filters, boardId: "", boardName: "" };
    case "repository":
      return { ...filters, repositoryId: "", repositoryName: "" };
    default:
      return cycled(filters, chip.kind, chip.value, "any");
  }
}

/** filtersActive tells whether any filter narrows the list. */
export function filtersActive(filters: ReviewFilters): boolean {
  return (
    filters.boardId !== "" ||
    filters.repositoryId !== "" ||
    (filters.authorsInclude ?? []).length > 0 ||
    (filters.authorsExclude ?? []).length > 0 ||
    (filters.labelsInclude ?? []).length > 0 ||
    (filters.labelsExclude ?? []).length > 0
  );
}

// storedList is a list as Go stores it, compared without case: trimmed,
// without blanks, without repeats and sorted.
function storedList(values: readonly string[] | null): string[] {
  const list = (values ?? []).map((value) => value.trim().toLowerCase()).filter((v) => v !== "");
  return [...new Set(list)].sort();
}

function sameList(a: readonly string[] | null, b: readonly string[] | null): boolean {
  const left = storedList(a);
  const right = storedList(b);
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

/**
 * sameFilters reports whether two sets of filters narrow the list the same way.
 * The lists are compared as Go stores them: sorted, trimmed, without blanks and
 * without repeats that only differ in case.
 */
export function sameFilters(a: ReviewFilters, b: ReviewFilters): boolean {
  return (
    a.boardId === b.boardId &&
    a.repositoryId === b.repositoryId &&
    sameList(a.authorsInclude, b.authorsInclude) &&
    sameList(a.authorsExclude, b.authorsExclude) &&
    sameList(a.labelsInclude, b.labelsInclude) &&
    sameList(a.labelsExclude, b.labelsExclude)
  );
}

/** ReviewsReadingView is what the area of the list shows of the state of the reading. */
export type ReviewsReadingView =
  | "skeleton"
  | "no-repositories"
  | "no-pull-requests"
  | "no-match"
  | "list";

/**
 * reviewsReadingView is the state of the area of the list: a list never read is
 * a skeleton while it reads, and a reading over a stored list shows the list.
 */
export function reviewsReadingView(app: State): ReviewsReadingView {
  const center = app.reviewCenter;
  if ((app.repositories ?? []).length === 0) {
    return "no-repositories";
  }
  if (center.readAt === "") {
    return center.reading ? "skeleton" : "no-pull-requests";
  }
  const rows = center.pullRequests ?? [];
  if (rows.length === 0) {
    return "no-pull-requests";
  }
  return rows.every((row) => row.filtered) ? "no-match" : "list";
}

/** emptyListBody is what the list says when no pull request is open. */
export function emptyListBody(app: State): string {
  const count = (app.repositories ?? []).length;
  const repositories = `${count} ${count === 1 ? "repository" : "repositories"}`;
  return `The list shows the open pull requests of your ${repositories}, from any author. MySpec reads them every 5 minutes and when you open Reviews.`;
}

/** noMatchBody is how many pull requests are open when the filters hide all of them. */
export function noMatchBody(center: ReviewCenter): string {
  const count = (center.pullRequests ?? []).length;
  return count === 1
    ? "1 is open; the filters hide it."
    : `${count} are open; the filters hide all of them.`;
}

/** FailureStrip is the strip of a repository the last reading could not read. */
export interface FailureStrip {
  repository: string;
  /** title is "Couldn't read acme/ios · 4m ago", the age of the first failure of the run. */
  title: string;
  message: string;
}

/** failureStrips are the strips of the repositories the last reading could not read, alphabetically. */
export function failureStrips(center: ReviewCenter, now: number): FailureStrip[] {
  return [...(center.failures ?? [])]
    .sort((a, b) => a.repository.localeCompare(b.repository))
    .map((failure) => {
      const since = age(failure.failedAt, now);
      const title = `Couldn't read ${failure.repository}`;
      return {
        repository: failure.repository,
        title: since === "" ? title : `${title} · ${since}`,
        message: failure.message,
      };
    });
}
