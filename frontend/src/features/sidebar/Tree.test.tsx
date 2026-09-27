import { screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Tree } from "@/features/sidebar/Tree";
import { api, type State } from "@/lib/wails";
import { useAppStore } from "@/store/app-store";
import { renderWithStore, type StoreOptions } from "@/test/render";
import {
  makeBoard,
  makeRepository,
  makeReviewSummary,
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

// The state with the clone of the board's repository gone.
function missingClone(): State {
  return state({
    repositories: [makeRepository({ id: "repo-1", boardId: "board-1", missing: true })],
  });
}

function renderTree(options: StoreOptions = {}) {
  return renderWithStore(<Tree />, { state: state(), ...options });
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

  it("puts Reviews first, with the active reviews in its group", () => {
    renderTree({
      state: state({ reviews: [makeReviewSummary({ id: "review-1", title: "Add rate limit" })] }),
    });

    const [first] = screen.getAllByRole("treeitem");
    expect(first).toHaveAccessibleName("Reviews");
    const group = document.getElementById(first?.getAttribute("aria-owns") ?? "") as HTMLElement;
    expect(
      within(group).getByRole("treeitem", { name: /^pull request review Add rate limit\./ }),
    ).toHaveAttribute("aria-level", "2");
  });

  it("tells Reviews without a review in progress", () => {
    renderTree();

    const reviews = screen.getByRole("treeitem", { name: "Reviews" });
    const group = document.getElementById(reviews.getAttribute("aria-owns") ?? "") as HTMLElement;
    expect(group).toHaveTextContent("No review in progress.");
  });

  it("shows Reviews open as the place on screen", () => {
    renderTree({ ui: { location: { kind: "reviews" } } });

    expect(screen.getByRole("treeitem", { name: "Reviews" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("puts a missing clone in its board as a notice that changes the path", async () => {
    const { user } = renderTree({ state: missingClone() });

    const notice = screen.getByRole("treeitem", {
      name: "dev/web: the clone at /home/dev/projects/web is missing. Enter to change the path.",
    });
    expect(notice).toHaveTextContent("web · clone missing");
    notice.focus();
    await user.keyboard("{Enter}");

    expect(api.changeRepositoryPath).toHaveBeenCalledWith("repo-1");
  });

  it("shows a path the app refuses under the notice", async () => {
    vi.mocked(api.changeRepositoryPath).mockRejectedValueOnce(
      new Error("/home/dev/other is a clone of dev/other."),
    );
    const { user } = renderTree({ state: missingClone() });

    await user.click(screen.getByRole("treeitem", { name: /^dev\/web: the clone/ }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "/home/dev/other is a clone of dev/other.",
    );
  });

  it("tells a filter with no task, and keeps the notices to its repository", () => {
    const repositories = [
      makeRepository({ id: "repo-1", boardId: "board-1", missing: true }),
      makeRepository({ id: "repo-2", name: "api", fullName: "dev/api", boardId: "board-1" }),
    ];
    renderTree({ state: state({ repositories, repositoryFilter: "repo-2" }) });

    expect(screen.getByText("No tasks in api.")).toBeInTheDocument();
    expect(screen.queryByRole("treeitem", { name: /clone .* is missing/ })).not.toBeInTheDocument();
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

  it("takes the Tab stop to the first line with no item on screen", () => {
    renderTree();

    expect(screen.getByRole("treeitem", { name: "Reviews" })).toHaveAttribute("tabindex", "0");
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

  describe("keyboard", () => {
    it("enters on the open row with Tab and walks with the arrows without opening", async () => {
      const { user } = renderTree({ ui: { location: { kind: "task", id: "task-1" } } });

      await user.tab();
      expect(screen.getByRole("treeitem", { name: /^task add-login\./ })).toHaveFocus();

      await user.keyboard("{ArrowDown}");
      const next = screen.getByRole("treeitem", { name: /^task fix-header\./ });
      expect(next).toHaveFocus();
      expect(next).toHaveAttribute("tabindex", "0");
      await user.keyboard("{ArrowUp}{ArrowUp}");
      expect(screen.getByRole("treeitem", { name: "Login" })).toHaveFocus();
      expect(useAppStore.getState().location).toEqual({ kind: "task", id: "task-1" });
    });

    it("goes to the ends with Home and End", async () => {
      const { user } = renderTree();

      await user.tab();
      await user.keyboard("{End}");
      expect(screen.getByRole("treeitem", { name: "Ops" })).toHaveFocus();
      await user.keyboard("{Home}");
      expect(screen.getByRole("treeitem", { name: "Reviews" })).toHaveFocus();
    });

    it("collapses and expands a node with the arrows, and goes between parent and child", async () => {
      const { user } = renderTree();
      const product = () => screen.getByRole("treeitem", { name: /^Product/ });

      product().focus();
      await user.keyboard("{ArrowRight}");
      const login = screen.getByRole("treeitem", { name: "Login" });
      expect(login).toHaveFocus();
      await user.keyboard("{ArrowLeft}");
      expect(login).toHaveAttribute("aria-expanded", "false");
      await user.keyboard("{ArrowLeft}");
      expect(product()).toHaveFocus();
      await user.keyboard("{ArrowLeft}");
      expect(product()).toHaveAttribute("aria-expanded", "false");
      await user.keyboard("{ArrowRight}");
      expect(product()).toHaveAttribute("aria-expanded", "true");
      expect(product()).toHaveFocus();
    });

    it("goes from a row to its node with the left arrow", async () => {
      const { user } = renderTree();

      screen.getByRole("treeitem", { name: /^task add-login\./ }).focus();
      await user.keyboard("{ArrowLeft}");

      expect(screen.getByRole("treeitem", { name: "Login" })).toHaveFocus();
    });

    it("leaves Alt with the arrows to the history, neither collapsing nor moving", async () => {
      const { user } = renderTree();
      const product = screen.getByRole("treeitem", { name: /^Product/ });
      const row = screen.getByRole("treeitem", { name: /^task fix-header\./ });

      product.focus();
      await user.keyboard("{Alt>}{ArrowLeft}{/Alt}");
      expect(product).toHaveAttribute("aria-expanded", "true");
      expect(product).toHaveFocus();

      row.focus();
      await user.keyboard("{Alt>}{ArrowLeft}{/Alt}");
      expect(row).toHaveFocus();
    });

    it("opens a row with Enter, keeping the focus on it", async () => {
      const { user } = renderTree();
      const row = screen.getByRole("treeitem", { name: /^task fix-header\./ });

      row.focus();
      await user.keyboard("{Enter}");

      expect(useAppStore.getState().location).toEqual({ kind: "task", id: "task-2" });
      expect(row).toHaveFocus();
    });

    it("opens a board and Reviews with Enter, and toggles an epic and No board", async () => {
      const { user } = renderTree({
        state: state({
          tasks: [
            ...(state().tasks ?? []),
            makeTask({ id: "task-3", name: "loose", repositoryId: "other" }),
          ],
        }),
      });

      screen.getByRole("treeitem", { name: /^Product/ }).focus();
      await user.keyboard("{Enter}");
      expect(useAppStore.getState().location).toEqual({ kind: "board", id: "board-1" });

      screen.getByRole("treeitem", { name: /^Reviews/ }).focus();
      await user.keyboard("{Enter}");
      expect(useAppStore.getState().location).toEqual({ kind: "reviews" });

      screen.getByRole("treeitem", { name: "Login" }).focus();
      await user.keyboard("{Enter}");
      expect(screen.getByRole("treeitem", { name: /^Login/ })).toHaveAttribute(
        "aria-expanded",
        "false",
      );

      screen.getByRole("treeitem", { name: "No board" }).focus();
      await user.keyboard("{Enter}");
      expect(screen.getByRole("treeitem", { name: /^No board/ })).toHaveAttribute(
        "aria-expanded",
        "false",
      );
    });
  });
});
