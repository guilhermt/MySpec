import { act, screen, waitFor, within } from "@testing-library/react";
import type { UserEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { BoardView } from "@/features/board/BoardView";
import { EMPTY_FILTERS } from "@/features/board/board-view";
import { Home } from "@/features/home/Home";
import { NewTaskDialog } from "@/features/task-create/NewTaskDialog";
import { boardViewKey } from "@/lib/ui-storage";
import type { BoardCard, Repository, State } from "@/lib/wails";
import {
  type BoardSceneName,
  boardScene,
  fixBoardSceneClock,
  PLATFORM_ID,
} from "@/test/board-scenes";
import { renderWithStore } from "@/test/render";

/** Screen is what a scene draws: the board, the Home or the creation dialog. */
type Screen = "board" | "home" | "dialog";

/** Row is a control of the screens that left, in a state it appeared in, and where it is now. */
interface Row {
  /** control is the name it had, and where. */
  control: string;
  scene: BoardSceneName;
  screen: Screen;
  /** steps is what the user does before the new place shows. */
  steps?: (user: UserEvent) => Promise<void>;
  role: Parameters<typeof screen.getByRole>[0];
  /** name is the whole accessible name of the new place. */
  name: string | RegExp;
  /** checked is the state of a box the new place has. */
  checked?: boolean;
  /** text is what the new place says, for a place that has no name of its own. */
  text?: string;
  /** storage is what the board view remembers when the row is drawn. */
  storage?: Record<string, string>;
}

/** EXPANDED is the memory of a board view with every section expanded. */
const EXPANDED = {
  [boardViewKey(PLATFORM_ID)]: JSON.stringify({ filters: EMPTY_FILTERS, collapsed: [] }),
};

const click =
  (role: Parameters<typeof screen.getByRole>[0], name: string | RegExp) =>
  async (user: UserEvent) => {
    await user.click(await screen.findByRole(role, { name }));
  };

// clickCard opens the card of a number: the list is windowed, so it walks down by the keys, as the
// user does, until the row is drawn.
async function clickCard(user: UserEvent, number: number) {
  const name = new RegExp(`^#${number} `);
  act(() => screen.getAllByRole("treeitem")[0]?.focus());
  for (let steps = 0; screen.queryByRole("treeitem", { name }) === null; steps++) {
    expect(steps).toBeLessThan(500);
    await user.keyboard("{ArrowDown}");
  }
  await user.click(screen.getByRole("treeitem", { name }));
}

const filterMenu = click("button", "Filter");

const ROWS: Row[] = [
  // The header of the board.
  { control: "Refresh (header)", scene: "board", screen: "board", role: "button", name: "Refresh" },
  {
    control: "New discussion (header)",
    scene: "board",
    screen: "board",
    role: "button",
    name: "New discussion",
  },
  {
    control: "Open on GitHub (header)",
    scene: "board",
    screen: "board",
    steps: click("button", "More actions"),
    role: "menuitem",
    name: "Open on GitHub",
  },
  {
    control: "the failure of the reading, with Try again",
    scene: "failed",
    screen: "board",
    role: "button",
    name: "Try again",
  },

  // The filters.
  {
    control: "the search",
    scene: "board",
    screen: "board",
    role: "searchbox",
    name: "Search cards",
  },
  {
    control: "Repository",
    scene: "board",
    screen: "board",
    steps: filterMenu,
    role: "menuitemcheckbox",
    name: "acme/api",
  },
  {
    control: "Status",
    scene: "board",
    screen: "board",
    steps: filterMenu,
    role: "menuitemcheckbox",
    name: "Backlog",
  },
  {
    control: "Assignee",
    scene: "board",
    screen: "board",
    steps: filterMenu,
    role: "menuitemcheckbox",
    name: "gmartins · you",
  },
  {
    control: "Assigned to me",
    scene: "board",
    screen: "board",
    role: "button",
    name: "Assigned to me",
  },
  {
    control: "Clear filters",
    scene: "filtered",
    screen: "board",
    role: "button",
    name: "Clear filters",
  },

  // The selection.
  {
    control: "the box of a card",
    scene: "select",
    screen: "board",
    role: "treeitem",
    name: /^#455 Usage-based pricing tiers\..*\. selected$/,
    checked: true,
  },
  {
    control: "Discuss selected",
    scene: "select",
    screen: "board",
    role: "button",
    name: "Discuss 3 cards",
  },
  {
    control: "Clear selection",
    scene: "select",
    screen: "board",
    role: "button",
    name: "Cancel",
  },

  // The row.
  {
    control: "the repository of the row",
    scene: "board",
    screen: "board",
    role: "treeitem",
    name: /^#474 Usage alerts at 80% of the plan\. acme\/api\. Ready\./,
  },
  {
    control: "the avatars of the row",
    scene: "card",
    screen: "board",
    role: "complementary",
    name: "Card #474",
    text: "gmartins",
  },

  // The detail, now the panel.
  { control: "Close card", scene: "card", screen: "board", role: "button", name: "Close" },
  {
    control: "Open on GitHub (card)",
    scene: "card",
    screen: "board",
    role: "button",
    name: "Open #474 on GitHub",
  },
  {
    control: "Start task",
    scene: "card",
    screen: "board",
    role: "button",
    name: "Start task",
  },
  { control: "Discuss", scene: "card", screen: "board", role: "button", name: "Discuss" },
  {
    control: "Clone and continue",
    scene: "no-clone",
    screen: "board",
    role: "button",
    name: "Clone and continue",
  },
  {
    control: "the button of the active task",
    scene: "board",
    screen: "board",
    steps: (user) => clickCard(user, 412),
    role: "button",
    name: "Open the task",
  },
  {
    control: "Archived: <name>",
    scene: "board",
    screen: "board",
    storage: EXPANDED,
    steps: (user) => clickCard(user, 409),
    role: "link",
    name: "409-hash-api-keys-at-rest",
  },
  {
    control: "the sibling that selects the card",
    scene: "card",
    screen: "board",
    steps: click("link", /^#430 Retry failed billing webhooks/),
    role: "complementary",
    name: "Card #430",
  },

  // The Home.
  { control: "New task", scene: "home", screen: "home", role: "button", name: "New task" },

  // The creation dialog.
  {
    control: "the repository field",
    scene: "create",
    screen: "dialog",
    role: "button",
    name: "Repository: acme/api",
  },
  {
    control: "Clone, on a repository without a clone (selector of the dialog)",
    scene: "create",
    screen: "dialog",
    steps: click("button", "Repository: acme/api"),
    role: "menuitem",
    name: "acme/billing, not cloned. Enter clones it.",
  },
  {
    control: "Context from the card",
    scene: "create-card",
    screen: "dialog",
    // Show waits for the context to arrive.
    steps: async (user) => {
      await waitFor(() =>
        expect(screen.getByRole("button", { name: "Show" })).not.toHaveAttribute(
          "aria-disabled",
          "true",
        ),
      );
      await user.click(screen.getByRole("button", { name: "Show" }));
    },
    role: "region",
    name: "The context from the card",
  },
  {
    control: "Additional context",
    scene: "create-card",
    screen: "dialog",
    steps: click("button", "Add to it"),
    role: "textbox",
    name: /^Additional context/,
  },
  { control: "Mode", scene: "create", screen: "dialog", role: "radiogroup", name: "Mode" },
  {
    control: "Review mode",
    scene: "create",
    screen: "dialog",
    role: "radiogroup",
    name: "Review mode",
  },
  { control: "Models", scene: "create", screen: "dialog", role: "button", name: /^Models/ },
];

fixBoardSceneClock();

// draw draws the screen of a scene and does what the scene has the user do.
async function draw(name: BoardSceneName, kind: Screen, setup = boardScene(name)) {
  for (const [key, value] of Object.entries(setup.storage)) {
    localStorage.setItem(key, value);
  }
  const { state, location, back, after } = setup;
  const ui = { location, back };
  const element =
    kind === "home" ? (
      <Home />
    ) : kind === "dialog" ? (
      <NewTaskDialog />
    ) : (
      <BoardView boardId={location.kind === "board" ? location.id : ""} />
    );
  const { user } = renderWithStore(element, { state, ui });
  await after?.(user);
  return user;
}

afterEach(() => {
  localStorage.clear();
});

describe("where the actions went", () => {
  it.each(ROWS)("$control is now $role $name, in the $scene scene", async (row) => {
    const setup = boardScene(row.scene);
    const user = await draw(row.scene, row.screen, {
      ...setup,
      storage: { ...setup.storage, ...row.storage },
    });
    await row.steps?.(user);

    const found = await screen.findAllByRole(row.role, {
      name: row.name,
      ...(row.checked === undefined ? {} : { checked: row.checked }),
    });
    expect(found.length).toBeGreaterThan(0);
    if (row.text !== undefined) {
      expect(found[0]).toHaveTextContent(row.text);
    }
  });

  it("puts Add to board behind the Start task of a repository the board does not manage", async () => {
    const user = await draw("board", "board");
    await user.click(screen.getByRole("treeitem", { name: /^#12 / }));

    await user.click(
      within(screen.getByRole("complementary")).getByRole("button", { name: "Start task" }),
    );

    const dialog = await screen.findByRole("dialog", { name: "Add acme/status-page to the board" });
    expect(within(dialog).getByRole("button", { name: "Add to board" })).toBeInTheDocument();
  });

  it("puts Change path… at the card whose clone is gone", async () => {
    const setup = boardScene("board");
    const state = withCard(setup.state, 416, { action: "clone_missing" });
    const user = await draw("board", "board", {
      ...setup,
      state: {
        ...state,
        repositories: (state.repositories ?? []).map((repository) =>
          repository.name === "docs" ? { ...repository, missing: true } : repository,
        ),
      },
    });
    await user.click(screen.getByRole("treeitem", { name: /^#416 / }));

    expect(
      within(screen.getByRole("complementary")).getByRole("button", { name: "Change path…" }),
    ).toBeInTheDocument();
  });
});

// withCard is the state with a card of Platform Roadmap changed.
function withCard(app: State, number: number, change: Partial<BoardCard>): State {
  return {
    ...app,
    boards: (app.boards ?? []).map((board) => ({
      ...board,
      cards: (board.cards ?? []).map((card) =>
        card.number === number ? { ...card, ...change } : card,
      ),
    })),
  };
}

// withRepository is the state with a repository changed.
function withRepository(app: State, name: string, change: Partial<Repository>): State {
  return {
    ...app,
    repositories: (app.repositories ?? []).map((repository) =>
      repository.name === name ? { ...repository, ...change } : repository,
    ),
  };
}

/** Case is a case of the panel of a card, by its action table, as a card and a state that bring it. */
interface Case {
  name: string;
  number: number;
  change?: (app: State) => State;
  /** primary is the one primary the case has, null for none. */
  primary: RegExp | null;
}

const CASES: Case[] = [
  { name: "the card is out of the reading", number: 466, primary: /^Start task$/ },
  { name: "start", number: 474, primary: /^Start task$/ },
  { name: "clone, waiting", number: 471, primary: /^Clone and continue$/ },
  {
    name: "clone, running",
    number: 471,
    change: (app) => withRepository(app, "billing", { cloning: true }),
    primary: /^Cloning acme\/billing…$/,
  },
  {
    name: "clone, failed",
    number: 471,
    change: (app) => withRepository(app, "billing", { cloneError: "fatal: repository not found" }),
    primary: /^Try the clone again$/,
  },
  {
    name: "clone_missing",
    number: 416,
    change: (app) =>
      withRepository(withCard(app, 416, { action: "clone_missing" }), "docs", { missing: true }),
    primary: /^Start task$/,
  },
  { name: "add_to_board", number: 12, primary: /^Start task$/ },
  { name: "other_board", number: 104, primary: /^Start task$/ },
  { name: "has_task", number: 412, primary: null },
  { name: "closed", number: 409, primary: null },
];

describe("the panel of a card", () => {
  it.each(CASES)(
    "has at most one primary when $name",
    async ({ number, change, primary, name }) => {
      const setup = boardScene(name === CASES[0]?.name ? "stale-card" : "board");
      const state = change === undefined ? setup.state : change(setup.state);
      const user = await draw("board", "board", { ...setup, state, storage: EXPANDED });
      if (name !== CASES[0]?.name) {
        await clickCard(user, number);
      }

      const panel = screen.getByRole("complementary");
      const primaries = [...panel.querySelectorAll('[data-variant="primary"]')];
      expect(primaries.length).toBe(primary === null ? 0 : 1);
      if (primary !== null) {
        expect(within(panel).getByRole("button", { name: primary })).toBe(primaries[0]);
      }
    },
  );
});

describe("the select mode and the dialogs", () => {
  it("has Discuss N cards as the one primary of the select mode", async () => {
    await draw("select", "board");

    expect(document.querySelectorAll('[data-variant="primary"]')).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Discuss 3 cards" })).toHaveAttribute(
      "data-variant",
      "primary",
    );
  });

  it.each(["create", "create-card"] as const)(
    "has Create as the one primary of the %s dialog",
    async (name) => {
      await draw(name, "dialog");

      const dialog = await screen.findByRole("dialog", { name: "New task" });
      expect(dialog.querySelectorAll('[data-variant="primary"]')).toHaveLength(1);
      expect(within(dialog).getByRole("button", { name: /^Create/ })).toHaveAttribute(
        "data-variant",
        "primary",
      );
    },
  );
});
