import { act, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SidebarTree } from "@/features/sidebar/SidebarTree";
import type { State } from "@/lib/wails";
import { useAppStore } from "@/store/app-store";
import { renderWithStore, type StoreOptions } from "@/test/render";
import {
  makeBoard,
  makeDiscussion,
  makeRepository,
  makeState,
  makeTask,
  makeTaskCard,
} from "@/test/wails-mock";

const BOARD = makeBoard({ id: "board-1", title: "Roadmap", repositoryIds: ["repo-1"] });

const WEB = makeRepository({ boardId: "board-1" });
const API = makeRepository({
  id: "repo-2",
  name: "api",
  fullName: "dev/api",
  path: "/home/dev/projects/api",
});

const WEB_TASK = makeTask();
const API_TASK = makeTask({
  id: "task-2",
  name: "fix-header",
  repositoryId: "repo-2",
  repository: "dev/api",
});
const EPIC_TASK = makeTask({
  id: "task-3",
  name: "add-logout",
  card: makeTaskCard({
    number: 42,
    epic: {
      key: "dev/web#7",
      repository: "dev/web",
      number: 7,
      title: "Sessions",
      url: "",
      state: "",
    },
  }),
});

const DISCUSSION = makeDiscussion({ id: "discussion-1", title: "Invoices", boardId: "board-1" });

function tree(overrides: Partial<State> = {}, ui: StoreOptions["ui"] = {}) {
  return renderWithStore(<SidebarTree />, {
    state: makeState({
      repositories: [WEB, API],
      boards: [BOARD],
      tasks: [WEB_TASK, API_TASK],
      ...overrides,
    }),
    ui,
  });
}

// Only the task rows carry a name starting with the task name and a comma.
const rows = () => screen.getAllByRole("treeitem", { name: /, dev\// });

describe("SidebarTree", () => {
  it("lists every task with its name, state and repository, under its board or no board", () => {
    tree();

    expect(screen.getByRole("tree", { name: "Tasks" })).toBeInTheDocument();
    const board = screen.getByRole("treeitem", { name: "Roadmap" });
    expect(board).toHaveAttribute("aria-expanded", "true");
    expect(
      within(board).getByRole("treeitem", { name: "add-login, dev/web, Waiting" }),
    ).toBeInTheDocument();
    const noBoard = screen.getByRole("treeitem", { name: "No board" });
    expect(
      within(noBoard).getByRole("treeitem", { name: "fix-header, dev/api, Waiting" }),
    ).toBeInTheDocument();
    // The row is crowded: the short name shows, with owner/name in the tooltip.
    expect(screen.getByText("web")).toHaveAttribute("title", "dev/web");
    expect(screen.getByText("api")).toHaveAttribute("title", "dev/api");
  });

  it("groups the tasks of an epic and puts the card number before the repository", () => {
    tree({ tasks: [WEB_TASK, EPIC_TASK] });

    const epic = screen.getByRole("treeitem", { name: "Sessions" });
    expect(within(epic).getByRole("treeitem", { name: /^add-logout,/ })).toHaveTextContent(
      "#42 web",
    );
  });

  it("collapses and expands a node from its chevron", async () => {
    const { user } = tree();

    await user.click(screen.getByRole("button", { name: "Collapse Roadmap" }));

    expect(screen.getByRole("treeitem", { name: "Roadmap" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    expect(screen.queryByRole("treeitem", { name: /^add-login,/ })).not.toBeInTheDocument();
    expect(useAppStore.getState().sidebarCollapsed.has("board:board-1")).toBe(true);

    await user.click(screen.getByRole("button", { name: "Expand Roadmap" }));
    expect(screen.getByRole("treeitem", { name: /^add-login,/ })).toBeInTheDocument();
  });

  it("collapses an epic from its title", async () => {
    const { user } = tree({ tasks: [EPIC_TASK] });

    await user.click(screen.getByRole("button", { name: "Sessions" }));

    expect(screen.queryByRole("treeitem", { name: /^add-logout,/ })).not.toBeInTheDocument();
  });

  it("opens the board from its title, marked while it is on screen", async () => {
    const { user } = tree();
    const title = screen.getByRole("button", { name: "Roadmap" });
    expect(title).not.toHaveAttribute("aria-current");

    await user.click(title);

    expect(useAppStore.getState().location).toEqual({ kind: "board", id: "board-1" });
    expect(screen.getByRole("button", { name: "Roadmap" })).toHaveAttribute("aria-current", "page");
  });

  it("warns about a board whose reading failed", () => {
    tree({
      boards: [{ ...BOARD, failure: { reason: "failed", message: "gh broke", failedAt: "" } }],
    });

    expect(screen.getByText("Reading failed")).toBeInTheDocument();
  });

  it("shows an empty board with no children", () => {
    tree({ tasks: [API_TASK] });

    expect(screen.getByRole("treeitem", { name: "Roadmap" })).not.toContainElement(
      screen.getByRole("treeitem", { name: /^fix-header,/ }),
    );
    expect(screen.queryByText("No tasks yet.")).not.toBeInTheDocument();
  });

  it("opens the task that is clicked", async () => {
    const { user } = tree();

    await user.click(screen.getByRole("treeitem", { name: /^fix-header,/ }));

    expect(useAppStore.getState().location).toEqual({ kind: "task", id: "task-2" });
  });

  it("puts a discussion under its board, with what it waits for", () => {
    tree({ discussions: [DISCUSSION] });

    const board = screen.getByRole("treeitem", { name: "Roadmap" });
    const row = within(board).getByRole("treeitem", { name: "Invoices, discussion, Discussing" });
    expect(row).toHaveTextContent("Discussion");
  });

  it("puts a discussion whose board is gone under no board", () => {
    tree({ discussions: [makeDiscussion({ boardId: "board-gone", title: "Billing" })] });

    const noBoard = screen.getByRole("treeitem", { name: "No board" });
    expect(
      within(noBoard).getByRole("treeitem", { name: /^Billing, discussion,/ }),
    ).toBeInTheDocument();
  });

  it("opens the discussion that is clicked", async () => {
    const { user } = tree({ discussions: [DISCUSSION] });

    await user.click(screen.getByRole("treeitem", { name: /^Invoices, discussion,/ }));

    expect(useAppStore.getState().location).toEqual({ kind: "discussion", id: "discussion-1" });
  });

  it("moves from the tasks onto the discussions with the arrows", async () => {
    const { user } = tree({ tasks: [WEB_TASK], discussions: [DISCUSSION] });
    screen.getAllByRole("treeitem", { name: /,/ })[0]?.focus();

    await user.keyboard("{End}");

    expect(useAppStore.getState().location).toEqual({ kind: "discussion", id: "discussion-1" });
    expect(screen.getByRole("treeitem", { name: /^Invoices, discussion,/ })).toHaveFocus();

    await user.keyboard("{ArrowUp}");

    expect(useAppStore.getState().location).toEqual({ kind: "task", id: "task-1" });
  });

  it("expands the board of a discussion that opens", () => {
    tree({ discussions: [DISCUSSION] }, { sidebarCollapsed: new Set(["board:board-1"]) });

    act(() => useAppStore.getState().openDiscussion("discussion-1"));

    expect(screen.getByRole("treeitem", { name: /^Invoices, discussion,/ })).toBeInTheDocument();
  });

  it("moves along the visible rows with the arrows, opening what it lands on", async () => {
    const { user } = tree();
    rows()[0]?.focus();

    await user.keyboard("{ArrowDown}");
    expect(useAppStore.getState().location).toEqual({ kind: "task", id: "task-1" });

    await user.keyboard("{ArrowDown}");
    expect(useAppStore.getState().location).toEqual({ kind: "task", id: "task-2" });
    expect(screen.getByRole("treeitem", { name: /^fix-header,/ })).toHaveFocus();

    // The list does not wrap around.
    await user.keyboard("{ArrowDown}");
    expect(useAppStore.getState().location).toEqual({ kind: "task", id: "task-2" });

    await user.keyboard("{Home}");
    expect(useAppStore.getState().location).toEqual({ kind: "task", id: "task-1" });

    await user.keyboard("{End}");
    expect(useAppStore.getState().location).toEqual({ kind: "task", id: "task-2" });

    await user.keyboard("{ArrowUp}");
    expect(useAppStore.getState().location).toEqual({ kind: "task", id: "task-1" });
  });

  it("skips the rows of a collapsed node", async () => {
    const { user } = tree(
      {
        tasks: [
          WEB_TASK,
          API_TASK,
          makeTask({
            id: "task-4",
            name: "fix-footer",
            repositoryId: "repo-2",
            repository: "dev/api",
          }),
        ],
      },
      { sidebarCollapsed: new Set(["board:board-1"]) },
    );
    rows()[0]?.focus();

    await user.keyboard("{ArrowDown}");
    expect(useAppStore.getState().location).toEqual({ kind: "task", id: "task-2" });

    await user.keyboard("{ArrowDown}");
    expect(useAppStore.getState().location).toEqual({ kind: "task", id: "task-4" });
  });

  it("opens the focused task with Enter or Space when no task is open", async () => {
    const { user } = tree();
    rows()[0]?.focus();

    await user.keyboard("{Enter}");
    expect(useAppStore.getState().location).toEqual({ kind: "task", id: "task-1" });

    useAppStore.setState({ location: { kind: "home" } });
    rows()[0]?.focus();
    await user.keyboard("{ }");
    expect(useAppStore.getState().location).toEqual({ kind: "task", id: "task-1" });
  });

  it("leaves the keys of a header to the header", async () => {
    const { user } = tree();
    screen.getByRole("button", { name: "Collapse Roadmap" }).focus();

    await user.keyboard("{Enter}");

    expect(useAppStore.getState().location).toEqual({ kind: "home" });
    expect(useAppStore.getState().sidebarCollapsed.has("board:board-1")).toBe(true);
  });

  it("expands the nodes of a task that opens", () => {
    tree(
      { tasks: [EPIC_TASK] },
      { sidebarCollapsed: new Set(["board:board-1", "epic:board-1:dev/web#7"]) },
    );

    act(() => useAppStore.getState().openTask("task-3"));

    expect(screen.getByRole("treeitem", { name: /^add-logout,/ })).toBeInTheDocument();
    expect(useAppStore.getState().sidebarCollapsed.size).toBe(0);
  });

  it("expands the nodes of a task that joins the state after it opens", () => {
    tree(
      { tasks: [WEB_TASK] },
      { sidebarCollapsed: new Set(["board:board-1", "epic:board-1:dev/web#7"]) },
    );

    act(() => useAppStore.getState().openTask("task-3"));
    expect(useAppStore.getState().sidebarCollapsed.size).toBe(2);

    act(() =>
      useAppStore
        .getState()
        .applyState(
          makeState({ repositories: [WEB, API], boards: [BOARD], tasks: [WEB_TASK, EPIC_TASK] }),
        ),
    );

    expect(screen.getByRole("treeitem", { name: /^add-logout,/ })).toBeInTheDocument();
    expect(useAppStore.getState().sidebarCollapsed.size).toBe(0);
  });

  it("keeps a node collapsed that the user collapses while its task is open", async () => {
    const { user } = tree({ tasks: [WEB_TASK] }, { location: { kind: "task", id: "task-1" } });

    await user.click(screen.getByRole("button", { name: "Collapse Roadmap" }));

    expect(screen.queryByRole("treeitem", { name: /^add-login,/ })).not.toBeInTheDocument();
  });

  it("keeps only the tasks of the repository of the filter", () => {
    tree({ repositoryFilter: "repo-2" });

    expect(rows()).toHaveLength(1);
    expect(screen.getByRole("treeitem", { name: /^fix-header,/ })).toBeInTheDocument();
    expect(screen.queryByRole("treeitem", { name: "Roadmap" })).not.toBeInTheDocument();
  });

  it("says when the repository of the filter has no task and no board", () => {
    tree({ repositoryFilter: "repo-2", tasks: [WEB_TASK] });

    expect(screen.getByText("No tasks in api.")).toBeInTheDocument();
    expect(screen.queryByRole("tree")).not.toBeInTheDocument();
  });

  it("says when there is no task and no board at all", () => {
    tree({ boards: [], tasks: [] });

    expect(screen.getByText("No tasks yet.")).toBeInTheDocument();
  });
});
