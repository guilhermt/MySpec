import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Tree } from "@/features/sidebar/Tree";
import type { State } from "@/lib/wails";
import { renderWithStore, type StoreOptions } from "@/test/render";
import {
  makeBoard,
  makeRepository,
  makeSituation,
  makeState,
  makeTask,
  makeTaskCard,
} from "@/test/wails-mock";

// A board with an epic of one task, a task without an epic, and a second board with nothing.
function state(overrides: Partial<State> = {}): State {
  const repository = makeRepository({ id: "repo-1", boardId: "board-1" });
  return makeState({
    repositories: [repository],
    boards: [
      makeBoard({ id: "board-1", title: "Product", repositoryIds: ["repo-1"] }),
      makeBoard({ id: "board-2", title: "Ops", repositoryIds: [] }),
    ],
    tasks: [
      makeTask({
        id: "task-1",
        name: "add-login",
        repositoryId: "repo-1",
        card: makeTaskCard({
          number: 1,
          epic: {
            key: "e1",
            repository: "dev/web",
            number: 9,
            title: "Login",
            url: "",
            state: "open",
          },
        }),
      }),
      makeTask({
        id: "task-2",
        name: "fix-header",
        repositoryId: "repo-1",
        situations: [makeSituation({ id: "s2", taskId: "task-2", kind: "question" })],
      }),
    ],
    ...overrides,
  });
}

function renderTree(options: StoreOptions = {}) {
  return renderWithStore(<Tree narrow={false} />, { state: state(), ...options });
}

describe("Tree", () => {
  it("names the tree and puts each board, its epics and its rows in their groups", () => {
    renderTree();

    const tree = screen.getByRole("tree", { name: "Active items" });
    const board = within(tree).getByRole("treeitem", { name: "Product" });
    const group = document.getElementById(board.getAttribute("aria-owns") ?? "");
    expect(group).toHaveAttribute("role", "group");
    const epic = within(group as HTMLElement).getByRole("treeitem", { name: "Login" });
    expect(epic).toHaveAttribute("aria-level", "2");
    expect(
      within(group as HTMLElement).getByRole("treeitem", { name: /^task add-login\./ }),
    ).toHaveAttribute("aria-level", "3");
    expect(
      within(group as HTMLElement).getByRole("treeitem", { name: /^task fix-header\./ }),
    ).toHaveAttribute("aria-level", "2");
  });

  it("tells a board with nothing active", () => {
    renderTree();

    const ops = screen.getByRole("treeitem", { name: "Ops" });
    const group = document.getElementById(ops.getAttribute("aria-owns") ?? "") as HTMLElement;
    expect(group).toHaveTextContent("No active items.");
  });

  it("leaves Reviews to its own node above the tree", () => {
    renderTree();

    expect(screen.queryByRole("treeitem", { name: "Reviews" })).not.toBeInTheDocument();
  });

  it("marks the row Ctrl+J opens next", () => {
    renderTree();

    const next = screen.getByRole("treeitem", {
      name: /^task fix-header\..* Ctrl\+J opens this next\.$/,
    });
    expect(within(next).getByText("Ctrl J")).toBeInTheDocument();
  });

  it("opens the row of the item on screen, the one Tab stop of the tree", () => {
    renderTree({ ui: { location: { kind: "task", id: "task-1" } } });

    const open = screen.getByRole("treeitem", { name: /^task add-login\./ });
    expect(open).toHaveAttribute("aria-current", "page");
    expect(open).toHaveAttribute("tabindex", "0");
    expect(screen.getByRole("treeitem", { name: "Product" })).toHaveAttribute("tabindex", "-1");
  });

  it("takes the Tab stop to the first node with no item on screen", () => {
    renderTree();

    expect(screen.getByRole("treeitem", { name: "Product" })).toHaveAttribute("tabindex", "0");
  });

  it("blinks the row of a situation that just started", () => {
    renderTree({ ui: { flashing: new Set(["s2"]) } });

    expect(screen.getByRole("treeitem", { name: /^task fix-header\./ })).toHaveAttribute(
      "data-flash",
      "wait",
    );
  });

  it("does not blink the row on screen", () => {
    renderTree({
      ui: { flashing: new Set(["s2"]), location: { kind: "task", id: "task-2" } },
    });

    expect(screen.getByRole("treeitem", { name: /^task fix-header\./ })).not.toHaveAttribute(
      "data-flash",
    );
  });

  it("sums up a collapsed board, blinking for its rows", () => {
    renderTree({
      ui: { sidebarCollapsed: new Set(["board:board-1"]), flashing: new Set(["s2"]) },
    });

    expect(screen.queryByRole("treeitem", { name: /^task fix-header\./ })).not.toBeInTheDocument();
    expect(screen.getByRole("img", { name: "1 waiting" })).toHaveAttribute("data-flash", "wait");
  });
});
