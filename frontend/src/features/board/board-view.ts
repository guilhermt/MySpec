import type { KeyNoticeText } from "@/components/system/KeyNotice";
import { type ItemRow, type RowTone, taskRow } from "@/features/sidebar/sidebar-tree";
import { referenceOf } from "@/features/task/card-panel";
import { findRepository } from "@/lib/repositories";
import type { Board, BoardCard, CardDependency, DiscussionSummary, State } from "@/lib/wails";

/** BoardFilters is what narrows the cards of a board view; "" and false filter nothing. */
export interface BoardFilters {
  query: string;
  /** repository is a repository id; repositoryName the owner/name its chip shows, "" while unknown. */
  repository: string;
  repositoryName: string;
  /** status is a status id or NO_STATUS; statusName the name its chip shows, "" while unknown. */
  status: string;
  statusName: string;
  /** assignee is a login. */
  assignee: string;
  /** mine keeps the cards assigned to the login gh is authenticated as. */
  mine: boolean;
}

/** EMPTY_FILTERS is a board view that shows every card. */
export const EMPTY_FILTERS: BoardFilters = {
  query: "",
  repository: "",
  repositoryName: "",
  status: "",
  statusName: "",
  assignee: "",
  mine: false,
};

/** NO_STATUS is the section, and the status filter, of the cards without a status. */
export const NO_STATUS = "__none__";

/** ALL_CARDS is the one section of a board without a Status field. */
export const ALL_CARDS = "__all__";

/** BoardViewMemory is what a board view remembers: the filters and the collapsed sections. */
export interface BoardViewMemory {
  filters: BoardFilters;
  collapsed: string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** KeptFilters are the filters as they are kept: the names are absent in what was kept before they existed. */
type KeptFilters = Omit<BoardFilters, "repositoryName" | "statusName"> &
  Partial<Pick<BoardFilters, "repositoryName" | "statusName">>;

function isKeptFilters(value: unknown): value is KeptFilters {
  return (
    isRecord(value) &&
    typeof value.query === "string" &&
    typeof value.repository === "string" &&
    (value.repositoryName === undefined || typeof value.repositoryName === "string") &&
    typeof value.status === "string" &&
    (value.statusName === undefined || typeof value.statusName === "string") &&
    typeof value.assignee === "string" &&
    typeof value.mine === "boolean"
  );
}

/**
 * KeptMemory is BoardViewMemory as it is kept between runs. Collapsed is absent
 * until the user collapses or expands a section: until then the final statuses
 * of the board, which a board never read does not know yet, stay collapsed.
 */
interface KeptMemory {
  filters: KeptFilters;
  collapsed?: string[];
}

/** isBoardViewMemory tells what a board view kept between runs from anything else. */
export function isBoardViewMemory(value: unknown): value is KeptMemory {
  return (
    isRecord(value) &&
    isKeptFilters(value.filters) &&
    (value.collapsed === undefined ||
      (Array.isArray(value.collapsed) && value.collapsed.every((id) => typeof id === "string")))
  );
}

/** keptFilters is the filters as they were kept, with the names a former run did not keep empty. */
export function keptFilters(value: KeptMemory["filters"]): BoardFilters {
  return {
    ...value,
    repositoryName: value.repositoryName ?? "",
    statusName: value.statusName ?? "",
  };
}

/**
 * namedFilters fills the names the chips show from the reading: the repository
 * while the board still has it, and the status while the board still has it. A
 * name the reading cannot tell stays as it was kept.
 */
export function namedFilters(filters: BoardFilters, board: Board, app: State | null): BoardFilters {
  const repository =
    filters.repository !== "" && (board.repositoryIds ?? []).includes(filters.repository)
      ? findRepository(app, filters.repository)?.fullName
      : undefined;
  const status = (board.statuses ?? []).find((candidate) => candidate.id === filters.status);
  return {
    ...filters,
    repositoryName: filters.repository === "" ? "" : (repository ?? filters.repositoryName),
    statusName:
      filters.status === ""
        ? ""
        : filters.status === NO_STATUS
          ? "No status"
          : (status?.name ?? filters.statusName),
  };
}

/** filtersActive tells whether anything narrows the cards. */
export function filtersActive(filters: BoardFilters): boolean {
  return (
    filters.query.trim() !== "" ||
    filters.mine ||
    filters.repository !== "" ||
    filters.status !== "" ||
    filters.assignee !== ""
  );
}

/** FilterChipModel is a chosen filter as its chip shows it. */
export interface FilterChipModel {
  kind: "repository" | "assignee" | "status";
  /** label is "acme/api", "Assignee: tchen", "Status: Ready" or "Status: No status". */
  label: string;
  /** removeLabel is "Remove the filter <label>". */
  removeLabel: string;
  /** orphan is why the filter no longer matches the board, null when it does. */
  orphan: string | null;
}

/** filterChips are the chips of the chosen filters, in the order repository, assignee, status. */
export function filterChips(
  filters: BoardFilters,
  board: Board,
  _app: State | null,
): FilterChipModel[] {
  const chips: FilterChipModel[] = [];
  const chip = (kind: FilterChipModel["kind"], label: string, orphan: string | null) =>
    chips.push({ kind, label, removeLabel: `Remove the filter ${label}`, orphan });
  if (filters.repository !== "") {
    const name = filters.repositoryName === "" ? filters.repository : filters.repositoryName;
    const kept = (board.repositoryIds ?? []).includes(filters.repository);
    chip("repository", name, kept ? null : `${name} isn't a repository of this board anymore.`);
  }
  if (filters.assignee !== "") {
    chip("assignee", `Assignee: ${filters.assignee}`, null);
  }
  if (filters.status !== "") {
    const name = filters.statusName === "" ? filters.status : filters.statusName;
    const known =
      filters.status === NO_STATUS ||
      !board.hasStatus ||
      (board.statuses ?? []).some((status) => status.id === filters.status);
    chip(
      "status",
      `Status: ${name}`,
      known ? null : `${name} isn't a status of this board anymore.`,
    );
  }
  return chips;
}

// filterParts are the parts of what the filters ask, in the order search,
// repository, status, assignee; the first one carries the verb.
function filterParts(filters: BoardFilters, viewer: string): string[] {
  const parts: { first: string; next: string }[] = [];
  const query = filters.query.trim();
  if (query !== "") {
    const search = `has "${query}" in the title or the number`;
    parts.push({ first: search, next: search });
  }
  if (filters.repository !== "") {
    const name = filters.repositoryName === "" ? filters.repository : filters.repositoryName;
    parts.push({ first: `is in ${name}`, next: `in ${name}` });
  }
  if (filters.status !== "") {
    const name = filters.statusName === "" ? filters.status : filters.statusName;
    parts.push(
      filters.status === NO_STATUS
        ? { first: "has no status", next: "with no status" }
        : { first: `is in ${name}`, next: `in ${name}` },
    );
  }
  const who = assignedTo(filters, viewer);
  if (who !== "") {
    parts.push({ first: `is assigned to ${who}`, next: `assigned to ${who}` });
  }
  return parts.map((part, index) => (index === 0 ? part.first : part.next));
}

// assignedTo is who the cards are assigned to: the login, you, or both once.
function assignedTo(filters: BoardFilters, viewer: string): string {
  if (!filters.mine) {
    return filters.assignee;
  }
  if (filters.assignee === "" || filters.assignee === viewer) {
    return "you";
  }
  return `${filters.assignee} and to you`;
}

/** noMatchSentence says what the filters ask when no card passes them. */
export function noMatchSentence(filters: BoardFilters, viewer: string): string {
  const parts = filterParts(filters, viewer);
  return parts.length === 0 ? "Nothing on the board." : `Nothing on the board ${parts.join(", ")}.`;
}

/** filteredTooltip is the parts of the sentence of the filters, one per line, for the "filtered" of the selection bar. */
export function filteredTooltip(filters: BoardFilters, viewer: string): string[] {
  return filterParts(filters, viewer);
}

function fold(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Mn}/gu, "")
    .toLowerCase();
}

function matchesQuery(card: BoardCard, query: string): boolean {
  const wanted = fold(query.trim());
  if (wanted === "") {
    return true;
  }
  if (/^#?\d+$/.test(wanted) && wanted.replace("#", "") === String(card.number)) {
    return true;
  }
  return fold(card.title).includes(wanted);
}

/** filterCards is the cards of a board every filter lets through, in reading order. */
export function filterCards(board: Board, filters: BoardFilters): BoardCard[] {
  return (board.cards ?? []).filter((card) => {
    const logins = (card.assignees ?? []).map((assignee) => assignee.login);
    const status = card.statusId === "" ? NO_STATUS : card.statusId;
    return (
      matchesQuery(card, filters.query) &&
      (filters.repository === "" || card.repositoryId === filters.repository) &&
      (filters.status === "" || status === filters.status) &&
      (filters.assignee === "" || logins.includes(filters.assignee)) &&
      (!filters.mine || (board.viewer !== "" && logins.includes(board.viewer)))
    );
  });
}

/** CardSection is one collapsible group of the card list. */
export interface CardSection {
  id: string;
  name: string;
  final: boolean;
  cards: BoardCard[];
}

// The reading already orders the cards by board; only the closed ones go last.
function openFirst(cards: readonly BoardCard[]): BoardCard[] {
  return [
    ...cards.filter((card) => card.state !== "closed"),
    ...cards.filter((card) => card.state === "closed"),
  ];
}

/**
 * sections groups cards by status, in board order. Every status keeps its
 * section even when empty, so the list does not jump as filters change; the
 * No status section shows while the whole reading has a card without a known
 * status, with the count of the filtered ones, even 0.
 */
export function sections(board: Board, cards: readonly BoardCard[]): CardSection[] {
  if (!board.hasStatus) {
    return [{ id: ALL_CARDS, name: "Cards", final: false, cards: openFirst(cards) }];
  }
  const statuses = board.statuses ?? [];
  const known = new Set(statuses.map((status) => status.id));
  const result: CardSection[] = statuses.map((status) => ({
    id: status.id,
    name: status.name,
    final: status.final,
    cards: openFirst(cards.filter((card) => card.statusId === status.id)),
  }));
  if ((board.cards ?? []).some((card) => !known.has(card.statusId))) {
    result.push({
      id: NO_STATUS,
      name: "No status",
      final: false,
      cards: openFirst(cards.filter((card) => !known.has(card.statusId))),
    });
  }
  return result;
}

/** defaultCollapsed is the sections a board view starts with collapsed: the final statuses. */
export function defaultCollapsed(board: Board): string[] {
  return (board.statuses ?? []).filter((status) => status.final).map((status) => status.id);
}

/** visibleCards is the cards the keyboard walks through: those of the expanded sections, in order. */
export function visibleCards(
  cardSections: readonly CardSection[],
  collapsed: ReadonlySet<string>,
): BoardCard[] {
  return cardSections.filter((section) => !collapsed.has(section.id)).flatMap((s) => s.cards);
}

/** BoardRow is one entry of the list as the keyboard and the screen walk it. */
export type BoardRow =
  | { kind: "section"; section: CardSection; collapsed: boolean }
  | { kind: "card"; card: BoardCard; sectionId: string };

/** boardRows is the list as the keyboard and the screen walk it: each header, then the cards of an expanded section. */
export function boardRows(
  cardSections: readonly CardSection[],
  collapsed: ReadonlySet<string>,
): BoardRow[] {
  return cardSections.flatMap((section): BoardRow[] => {
    const folded = section.cards.length > 0 && collapsed.has(section.id);
    const header: BoardRow = { kind: "section", section, collapsed: folded };
    return folded
      ? [header]
      : [
          header,
          ...section.cards.map((card): BoardRow => ({ kind: "card", card, sectionId: section.id })),
        ];
  });
}

/** sectionLabel is the accessible name of a section header: "Done, 70 cards, final status". */
export function sectionLabel(section: CardSection): string {
  const count = section.cards.length;
  const label = `${section.name}, ${count} card${count === 1 ? "" : "s"}`;
  return section.final ? `${label}, final status` : label;
}

/** sectionTooltip is what a header explains of its section, null when it needs no explaining. */
export function sectionTooltip(section: CardSection): string | null {
  if (section.final) {
    return "A final status: folded when the board opens";
  }
  return section.id === NO_STATUS ? "Cards without a status on the board" : null;
}

/** assigneesOf is every login assigned to a card of the board, alphabetically. */
export function assigneesOf(board: Board): string[] {
  const logins = new Set(
    (board.cards ?? []).flatMap((card) => (card.assignees ?? []).map((assignee) => assignee.login)),
  );
  return [...logins].sort((a, b) => a.localeCompare(b));
}

/** unsatisfied is the dependencies of a card still open with no merged pull request. */
export function unsatisfied(card: BoardCard): CardDependency[] {
  return (card.dependencies ?? []).filter((dependency) => !dependency.satisfied);
}

/**
 * actionHint is what keeps Start task from opening the creation dialog at once
 * for a card, shown next to or instead of the button; null when
 * nothing does.
 */
export function actionHint(card: BoardCard, app: State | null): string | null {
  switch (card.action) {
    case "clone":
      return `${card.repository} isn't cloned yet.`;
    case "clone_missing": {
      const path = findRepository(app, card.repositoryId)?.path ?? "";
      return `The clone at ${path} is missing.`;
    }
    case "add_to_board":
      return `${card.repository} isn't managed by this board.`;
    case "other_board":
      return `${card.repository} belongs to the board ${card.otherBoard}.`;
    default:
      return null;
  }
}

/**
 * isCheckable tells whether a card can go into a discussion: it has a
 * repository, and that repository is one the board manages.
 */
export function isCheckable(card: BoardCard, app: State | null, boardId: string): boolean {
  return card.repositoryId !== "" && findRepository(app, card.repositoryId)?.boardId === boardId;
}

/** startable tells whether S acts on a card: Start task, Clone and continue or Add to board. */
export function startable(card: BoardCard): boolean {
  return card.action === "start" || card.action === "clone" || card.action === "add_to_board";
}

/** EpicChild is a card of an epic, and whether it is finished. */
export interface EpicChild {
  key: string;
  finished: boolean;
}

/**
 * epicChildren are the children of each epic of the reading, by the key of the
 * epic: the cards of the reading that name it, and the siblings off the board
 * they list, none twice. A card is finished when it is in a final status; an
 * issue off the board, when it is closed.
 */
export function epicChildren(cards: readonly BoardCard[]): Map<string, EpicChild[]> {
  const children = new Map<string, EpicChild[]>();
  for (const card of cards) {
    if (card.epic === null) {
      continue;
    }
    const list = children.get(card.epic.key) ?? [];
    children.set(card.epic.key, list);
    if (!list.some((child) => child.key === card.key)) {
      list.push({ key: card.key, finished: card.final });
    }
    for (const sibling of card.siblings ?? []) {
      if (!sibling.onBoard && !list.some((child) => child.key === sibling.key)) {
        list.push({ key: sibling.key, finished: sibling.state === "closed" });
      }
    }
  }
  return children;
}

/** epicProgress is how many of the children of an epic are finished, "2 of 8 finished". */
export function epicProgress(children: readonly EpicChild[]): string {
  return `${children.filter((child) => child.finished).length} of ${children.length} finished`;
}

/**
 * inDiscussion are the active discussions a card is in: those with it as an
 * entry, and the one that wrote it while it is not archived. In the order of
 * the state.
 */
export function inDiscussion(card: BoardCard, app: State): DiscussionSummary[] {
  return (app.discussions ?? []).filter(
    (discussion) =>
      (discussion.cards ?? []).some((entry) => entry.key === card.key) ||
      (card.writtenBy !== null && !card.writtenBy.archived && card.writtenBy.id === discussion.id),
  );
}

// discussionsText is "the discussion A", "the discussions A and B", "the discussions A, B and C".
function discussionsText(discussions: readonly DiscussionSummary[]): string {
  const titles = discussions.map((discussion) => discussion.title);
  const last = titles.at(-1);
  if (titles.length < 2 || last === undefined) {
    return `the discussion ${titles.join("")}`;
  }
  return `the discussions ${titles.slice(0, -1).join(", ")} and ${last}`;
}

/** RowContext is what a row reads beyond its card. */
export interface RowContext {
  app: State;
  board: Board;
  now: number;
  /** children is epicChildren(board.cards) computed once for the reading. */
  children: ReadonlyMap<string, EpicChild[]>;
  /** cloneFor is the card whose Clone and continue runs or failed, and how: null when none. */
  cloneFor: { key: string; state: "cloning" | "failed" } | null;
}

/** TaskCell is what the task column of a row says. */
export type TaskCell =
  | {
      kind: "task";
      tone: RowTone;
      text: string;
      strong: boolean;
      more: number | null;
      tooltip: string;
    }
  | { kind: "discussion"; tooltip: string }
  | { kind: "cloning"; text: string }
  | { kind: "clone-failed" };

/** CardRowModel is everything a row of the list draws and says. */
export interface CardRowModel {
  key: string;
  /** number is the reference of the card: #474. */
  number: string;
  title: string;
  isEpic: boolean;
  /** dimmed is an issue closed in a non-final section: the title in --ink-4 (--ink-3 when open). */
  dimmed: boolean;
  epic: { text: string; tooltip: string } | null;
  /** dependency is the first dependency that is not satisfied, "#461 +1"; the tooltip has a line for each. */
  dependency: { text: string; tooltip: string[] } | null;
  task: TaskCell | null;
  /** canStart and canDiscuss are what the keys column says the keys do: S start, D discuss. */
  canStart: boolean;
  canDiscuss: boolean;
  /** label is the accessible name without the selection part. */
  label: string;
}

// waitSuffix is ", waiting for you for 18 minutes" for a row that has a chip, "" for one that has none.
function waitSuffix(row: ItemRow): string {
  if (row.clock?.kind !== "chip") {
    return "";
  }
  const wait = row.clock.longTime === "just now" ? "less than a minute" : row.clock.longTime;
  return `, waiting for you for ${wait}`;
}

function taskCell(card: BoardCard, ctx: RowContext, discussions: readonly DiscussionSummary[]) {
  if (ctx.cloneFor?.key === card.key) {
    return ctx.cloneFor.state === "cloning"
      ? ({ kind: "cloning", text: `Cloning ${card.repository}…` } as const)
      : ({ kind: "clone-failed" } as const);
  }
  const task = (ctx.app.tasks ?? []).find((candidate) => candidate.id === card.activeTaskId);
  if (card.activeTaskId !== "" && task !== undefined) {
    const row = taskRow(ctx.app, task, ctx.now);
    return {
      kind: "task",
      tone: row.tone,
      text: row.line2.short,
      strong: row.waiting || row.tone === "error",
      more: row.more?.count ?? null,
      tooltip: `${task.name}: ${row.line2.long}${waitSuffix(row)}`,
    } as const;
  }
  return discussions.length > 0
    ? ({ kind: "discussion", tooltip: `In ${discussionsText(discussions)}` } as const)
    : null;
}

function epicCell(card: BoardCard, children: readonly EpicChild[] | undefined) {
  if (children !== undefined) {
    const text = `Epic · ${epicProgress(children)}`;
    return { text, tooltip: text };
  }
  return card.epic === null ? null : { text: card.epic.title, tooltip: card.epic.title };
}

function dependencyCell(card: BoardCard) {
  const missing = unsatisfied(card);
  const [first] = missing;
  if (first === undefined) {
    return null;
  }
  const more = missing.length > 1 ? ` +${missing.length - 1}` : "";
  return {
    text: `${referenceOf(first, card.repository)}${more}`,
    tooltip: missing.map((dependency) => dependencyLine(dependency, card.repository)),
  };
}

function dependencyLine(dependency: CardDependency, repository: string): string {
  const status = dependency.status === "" ? "" : `, ${dependency.status}`;
  const reference = referenceOf(dependency, repository);
  return `Depends on ${reference} ${dependency.title} · ${dependency.state}${status}. A warning: it never blocks.`;
}

/** cardRowModel is the row of a card: what its columns draw and its accessible name. */
export function cardRowModel(card: BoardCard, ctx: RowContext): CardRowModel {
  const children = ctx.children.get(card.key);
  const discussions = inDiscussion(card, ctx.app);
  const task = taskCell(card, ctx, discussions);
  const dependency = dependencyCell(card);
  const label = [
    `#${card.number} ${card.title}`,
    card.repository,
    card.status === "" ? "No status" : card.status,
    ...(card.state === "closed" ? ["Closed"] : []),
    ...(children !== undefined
      ? [
          `epic, ${children.filter((child) => child.finished).length} of ${children.length} cards finished`,
        ]
      : card.epic === null
        ? []
        : [`epic ${card.epic.title}`]),
    ...unsatisfied(card).map(
      (missing) => `depends on ${referenceOf(missing, card.repository)}, not satisfied`,
    ),
    ...(task?.kind === "task"
      ? [`task ${task.tooltip}`]
      : task?.kind === "discussion"
        ? [`in ${discussionsText(discussions)}`]
        : []),
  ].join(". ");
  return {
    key: card.key,
    number: `#${card.number}`,
    title: card.title,
    isEpic: children !== undefined,
    dimmed: card.state === "closed" && !card.final,
    epic: epicCell(card, children),
    dependency,
    task,
    canStart: startable(card),
    canDiscuss: isCheckable(card, ctx.app, ctx.board.id),
    label,
  };
}

/** selectionSuffix is what the label of a row adds in the select mode: ". selected". */
export function selectionSuffix(state: "selected" | "not selected" | "can't be selected"): string {
  return `. ${state}`;
}

const NOT_IN_READING = "The card isn't in the last reading of the board.";

/** startNotice is why S does nothing for a card, null when it acts. */
export function startNotice(
  card: BoardCard,
  app: State,
  outOfReading: boolean,
): KeyNoticeText | null {
  const title = `No task from #${card.number}`;
  if (outOfReading) {
    return { title, reason: NOT_IN_READING };
  }
  switch (card.action) {
    case "has_task": {
      const task = (app.tasks ?? []).find((candidate) => candidate.id === card.activeTaskId);
      return {
        title,
        reason: `#${card.number} already has a task: ${task?.name ?? card.activeTaskId}.`,
      };
    }
    case "closed":
      return { title, reason: "The issue is closed." };
    case "other_board":
      return { title, reason: `${card.repository} belongs to the board ${card.otherBoard}.` };
    case "clone_missing": {
      const path = findRepository(app, card.repositoryId)?.path ?? "";
      return { title, reason: `The clone at ${path} is missing.` };
    }
    default:
      return null;
  }
}

// outOfBoardNotice is why a card cannot go into a discussion: its repository is not the board's.
function outOfBoardNotice(card: BoardCard): KeyNoticeText {
  return {
    title: `#${card.number} can't go into a discussion`,
    reason: `${card.repository} isn't a repository of this board.`,
  };
}

/** discussNotice is why D does nothing, null when it acts: on the selection, or on the card. */
export function discussNotice(
  card: BoardCard | null,
  app: State,
  boardId: string,
  opts: { outOfReading: boolean; selecting: boolean; selected: number },
): KeyNoticeText | null {
  if (opts.selecting) {
    return opts.selected === 0
      ? { title: "No card is selected", reason: "Select a card with Space." }
      : null;
  }
  if (card === null) {
    return null;
  }
  if (opts.outOfReading) {
    return { title: `#${card.number} can't go into a discussion`, reason: NOT_IN_READING };
  }
  return isCheckable(card, app, boardId) ? null : outOfBoardNotice(card);
}

/** selectNotice is why Space does not select a card, null when it does. */
export function selectNotice(card: BoardCard, app: State, boardId: string): KeyNoticeText | null {
  return isCheckable(card, app, boardId) ? null : outOfBoardNotice(card);
}

/** newDiscussionNotice is why N does nothing, null when it acts. */
export function newDiscussionNotice(board: Board): KeyNoticeText | null {
  return board.readAt === ""
    ? { title: "No discussion yet", reason: "The board hasn't been read yet." }
    : null;
}

/** ReadingView is what the area of the list shows of the state of the reading. */
export type ReadingView =
  | { kind: "skeleton" } // never read, reading
  | { kind: "never-read-failed" } // never read, failed, not reading
  | { kind: "no-cards" } // read, board.cards empty
  | { kind: "no-match" } // read, cards, none passes the filters
  | { kind: "list" };

/**
 * readingView is the state of the area of the list: reading wins over a
 * failure, and a board never read is a skeleton until it fails.
 */
export function readingView(board: Board, filtered: readonly BoardCard[]): ReadingView {
  if (board.readAt === "") {
    return board.failure !== null && !board.reading
      ? { kind: "never-read-failed" }
      : { kind: "skeleton" };
  }
  if ((board.cards ?? []).length === 0) {
    return { kind: "no-cards" };
  }
  return filtered.length === 0 ? { kind: "no-match" } : { kind: "list" };
}

/** showsFailureStrip tells whether the strip of the failure shows above the list: a stored reading and a failure. */
export function showsFailureStrip(board: Board): boolean {
  return board.readAt !== "" && board.failure !== null;
}
