import { findRepository } from "@/lib/repositories";
import type { Board, BoardCard, CardDependency, State } from "@/lib/wails";

/** BoardFilters is what narrows the cards of a board view; "" and false filter nothing. */
export interface BoardFilters {
  query: string;
  /** repository is a repository id. */
  repository: string;
  /** status is a status id, or NO_STATUS. */
  status: string;
  /** assignee is a login. */
  assignee: string;
  /** mine keeps the cards assigned to the login gh is authenticated as. */
  mine: boolean;
}

/** EMPTY_FILTERS is a board view that shows every card. */
export const EMPTY_FILTERS: BoardFilters = {
  query: "",
  repository: "",
  status: "",
  assignee: "",
  mine: false,
};

/** NO_STATUS is the section, and the status filter, of the cards without a status. */
export const NO_STATUS = "__none__";

/** ALL_CARDS is the one section of a board without a Status field. */
export const ALL_CARDS = "__all__";

/** BoardViewMemory is what a board view remembers: the filters, the collapsed sections and the selected card. */
export interface BoardViewMemory {
  filters: BoardFilters;
  collapsed: string[];
  /** selectedKey is the card open in the detail; it is never kept between runs. */
  selectedKey: string | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isBoardFilters(value: unknown): value is BoardFilters {
  return (
    isRecord(value) &&
    typeof value.query === "string" &&
    typeof value.repository === "string" &&
    typeof value.status === "string" &&
    typeof value.assignee === "string" &&
    typeof value.mine === "boolean"
  );
}

/**
 * StoredBoardView is a board view as kept between runs. collapsed is absent
 * until the user collapses or expands a section: until then the final statuses
 * of the board, which a board never read does not know yet, stay collapsed.
 */
export interface StoredBoardView {
  filters: BoardFilters;
  collapsed?: string[];
}

/** isStoredBoardView tells a stored board view from anything else. */
export function isStoredBoardView(value: unknown): value is StoredBoardView {
  return (
    isRecord(value) &&
    isBoardFilters(value.filters) &&
    (value.collapsed === undefined ||
      (Array.isArray(value.collapsed) && value.collapsed.every((id) => typeof id === "string")))
  );
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
 * No status section shows only with cards.
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
  const withoutStatus = cards.filter((card) => !known.has(card.statusId));
  if (withoutStatus.length > 0) {
    result.push({
      id: NO_STATUS,
      name: "No status",
      final: false,
      cards: openFirst(withoutStatus),
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
