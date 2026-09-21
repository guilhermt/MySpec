import { describe, expect, it } from "vitest";
import {
  actionHint,
  assigneesOf,
  defaultCollapsed,
  EMPTY_FILTERS,
  filterCards,
  isBoardViewMemory,
  isCheckable,
  NO_STATUS,
  sections,
  unsatisfied,
  visibleCards,
} from "@/features/board/board-view";
import { makeBoard, makeBoardCard, makeRepository, makeState } from "@/test/wails-mock";

const LOGIN = makeBoardCard({
  key: "dev/web#12",
  number: 12,
  title: "Tela de configuração",
  assignees: [{ login: "dev", avatarUrl: "" }],
});
const HEADER = makeBoardCard({
  key: "dev/api#7",
  repository: "dev/api",
  repositoryId: "repo-2",
  number: 7,
  title: "Fix the header",
  statusId: "",
  status: "",
  assignees: [{ login: "ana", avatarUrl: "" }],
});
const SHIPPED = makeBoardCard({
  key: "dev/web#3",
  number: 3,
  title: "Ship it",
  state: "closed",
});
const LATER = makeBoardCard({ key: "dev/web#20", number: 20, title: "Later" });

const BOARD = makeBoard({ cards: [SHIPPED, LOGIN, HEADER, LATER] });

function keys(cards: readonly { key: string }[]) {
  return cards.map((card) => card.key);
}

describe("filterCards", () => {
  it("lets every card through without filters", () => {
    expect(keys(filterCards(BOARD, EMPTY_FILTERS))).toEqual(keys(BOARD.cards ?? []));
  });

  it("matches the title ignoring case and accents", () => {
    const found = filterCards(BOARD, { ...EMPTY_FILTERS, query: "CONFIGURACAO" });

    expect(keys(found)).toEqual(["dev/web#12"]);
  });

  it("matches the number, with or without #", () => {
    expect(keys(filterCards(BOARD, { ...EMPTY_FILTERS, query: "#7" }))).toEqual(["dev/api#7"]);
    expect(keys(filterCards(BOARD, { ...EMPTY_FILTERS, query: "7" }))).toEqual(["dev/api#7"]);
  });

  it("filters by repository, status, no status and assignee", () => {
    expect(keys(filterCards(BOARD, { ...EMPTY_FILTERS, repository: "repo-2" }))).toEqual([
      "dev/api#7",
    ]);
    expect(keys(filterCards(BOARD, { ...EMPTY_FILTERS, status: NO_STATUS }))).toEqual([
      "dev/api#7",
    ]);
    expect(keys(filterCards(BOARD, { ...EMPTY_FILTERS, status: "todo" }))).toEqual([
      "dev/web#3",
      "dev/web#12",
      "dev/web#20",
    ]);
    expect(keys(filterCards(BOARD, { ...EMPTY_FILTERS, assignee: "ana" }))).toEqual(["dev/api#7"]);
  });

  it("keeps the cards of the viewer for Assigned to me, and none without a viewer", () => {
    expect(keys(filterCards(BOARD, { ...EMPTY_FILTERS, mine: true }))).toEqual(["dev/web#12"]);
    expect(filterCards({ ...BOARD, viewer: "" }, { ...EMPTY_FILTERS, mine: true })).toEqual([]);
  });

  it("combines the filters", () => {
    const found = filterCards(BOARD, { ...EMPTY_FILTERS, status: "todo", query: "later" });

    expect(keys(found)).toEqual(["dev/web#20"]);
  });
});

describe("sections", () => {
  it("keeps every status in board order, empty ones included, with the open cards first", () => {
    const result = sections(BOARD, [SHIPPED, LOGIN, LATER]);

    expect(result.map((section) => [section.id, keys(section.cards)])).toEqual([
      ["todo", ["dev/web#12", "dev/web#20", "dev/web#3"]],
      ["in-progress", []],
      ["done", []],
    ]);
    expect(result[2]?.final).toBe(true);
  });

  it("adds No status only when a card has none", () => {
    const result = sections(BOARD, [HEADER]);

    expect(result.at(-1)).toMatchObject({ id: NO_STATUS, name: "No status", final: false });
    expect(keys(result.at(-1)?.cards ?? [])).toEqual(["dev/api#7"]);
  });

  it("gives a board without a Status field one section", () => {
    const result = sections({ ...BOARD, hasStatus: false, statuses: [] }, [SHIPPED, LOGIN]);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ id: "__all__", name: "Cards" });
    expect(keys(result[0]?.cards ?? [])).toEqual(["dev/web#12", "dev/web#3"]);
  });
});

describe("defaultCollapsed and visibleCards", () => {
  it("collapses the final statuses and walks only the expanded sections", () => {
    const done = makeBoardCard({ key: "dev/web#1", statusId: "done", status: "Done" });
    const cardSections = sections(BOARD, [LOGIN, done]);

    expect(defaultCollapsed(BOARD)).toEqual(["done"]);
    expect(keys(visibleCards(cardSections, new Set(defaultCollapsed(BOARD))))).toEqual([
      "dev/web#12",
    ]);
    expect(keys(visibleCards(cardSections, new Set()))).toEqual(["dev/web#12", "dev/web#1"]);
  });
});

describe("isBoardViewMemory", () => {
  it("accepts a stored view, with or without the collapsed sections", () => {
    expect(isBoardViewMemory({ filters: EMPTY_FILTERS, collapsed: ["done"] })).toBe(true);
    expect(isBoardViewMemory({ filters: EMPTY_FILTERS })).toBe(true);
  });

  it("refuses anything of another shape", () => {
    expect(isBoardViewMemory(null)).toBe(false);
    expect(isBoardViewMemory({ filters: EMPTY_FILTERS, collapsed: [1] })).toBe(false);
    expect(isBoardViewMemory({ filters: EMPTY_FILTERS, collapsed: "done" })).toBe(false);
    expect(isBoardViewMemory({ filters: { query: "" }, collapsed: [] })).toBe(false);
  });
});

describe("assigneesOf and unsatisfied", () => {
  it("lists every assignee once, alphabetically", () => {
    expect(assigneesOf(makeBoard({ cards: [LOGIN, HEADER, LOGIN] }))).toEqual(["ana", "dev"]);
  });

  it("keeps the dependencies that are not satisfied", () => {
    const dependency = {
      key: "dev/web#1",
      repository: "dev/web",
      number: 1,
      title: "Schema",
      url: "",
      state: "open",
      status: "Todo",
      onBoard: true,
      pullRequests: [],
    };
    const card = makeBoardCard({
      dependencies: [
        { ...dependency, satisfied: false },
        { ...dependency, key: "dev/web#2", satisfied: true },
      ],
    });

    expect(keys(unsatisfied(card))).toEqual(["dev/web#1"]);
  });
});

describe("actionHint", () => {
  const app = makeState({ repositories: [makeRepository({ path: "/home/dev/web" })] });

  it("says what keeps Start task from opening the dialog", () => {
    expect(actionHint(makeBoardCard({ action: "clone" }), app)).toBe("dev/web isn't cloned yet.");
    expect(actionHint(makeBoardCard({ action: "clone_missing" }), app)).toBe(
      "The clone at /home/dev/web is missing.",
    );
    expect(actionHint(makeBoardCard({ action: "add_to_board" }), app)).toBe(
      "dev/web isn't managed by this board.",
    );
    expect(actionHint(makeBoardCard({ action: "other_board", otherBoard: "Platform" }), app)).toBe(
      "dev/web belongs to the board Platform.",
    );
  });

  it("has nothing to say otherwise", () => {
    for (const action of ["start", "has_task", "closed"]) {
      expect(actionHint(makeBoardCard({ action }), app)).toBeNull();
    }
  });
});

describe("isCheckable", () => {
  const app = makeState({ repositories: [makeRepository({ boardId: "board-1" })] });

  it("takes a card whose repository the board manages", () => {
    expect(isCheckable(makeBoardCard(), app, "board-1")).toBe(true);
  });

  it("leaves out a card of another board, or of no repository at all", () => {
    expect(isCheckable(makeBoardCard(), app, "board-2")).toBe(false);
    expect(isCheckable(makeBoardCard({ repositoryId: "" }), app, "board-1")).toBe(false);
    expect(isCheckable(makeBoardCard({ repositoryId: "repo-9" }), app, "board-1")).toBe(false);
  });
});
