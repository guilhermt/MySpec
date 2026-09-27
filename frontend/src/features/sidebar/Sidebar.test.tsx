import { screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Sidebar } from "@/features/sidebar/Sidebar";
import { taskRow } from "@/features/sidebar/sidebar-tree";
import { api } from "@/lib/wails";
import { useAppStore } from "@/store/app-store";
import { renderWithStore } from "@/test/render";
import {
  makeBoard,
  makeDiscussion,
  makeRepository,
  makeSituation,
  makeState,
  makeStep,
  makeTask,
} from "@/test/wails-mock";

function sidebar(ui: { sidebarRail?: boolean } = {}) {
  return renderWithStore(<Sidebar />, { state: makeState({ tasks: [makeTask()] }), ui });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Sidebar", () => {
  it("puts the top, the filter, the tree and the foot together", () => {
    sidebar();

    const work = screen.getByRole("complementary", { name: "Work" });
    expect(within(work).getByText("MySpec")).toBeInTheDocument();
    expect(within(work).getByRole("button", { name: "New" })).toBeInTheDocument();
    expect(
      within(work).getByRole("button", { name: "Repository filter: All repositories" }),
    ).toBeInTheDocument();
    expect(within(work).getByRole("treeitem", { name: /^task add-login\./ })).toBeInTheDocument();
    expect(within(work).getByRole("button", { name: /^History/ })).toBeInTheDocument();
    expect(within(work).getByRole("button", { name: "Theme: System" })).toBeInTheDocument();
    expect(within(work).getByRole("button", { name: "Settings" })).toBeInTheDocument();
  });

  it("holds the tree of active items in the Work sidebar", () => {
    sidebar();

    const work = screen.getByRole("complementary", { name: "Work" });
    expect(within(work).getByRole("tree", { name: "Active items" })).toBeInTheDocument();
  });

  it("collapses into the strip and opens again", async () => {
    const { user } = sidebar();

    await user.click(screen.getByRole("button", { name: "Collapse the sidebar" }));

    expect(useAppStore.getState().sidebarRail).toBe(true);
    expect(screen.queryByRole("button", { name: /^Repository filter/ })).not.toBeInTheDocument();
    expect(screen.getByRole("treeitem", { name: /^task add-login\./ })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Expand the sidebar" }));

    expect(useAppStore.getState().sidebarRail).toBe(false);
    expect(
      screen.getByRole("button", { name: "Repository filter: All repositories" }),
    ).toBeInTheDocument();
  });

  it("opens collapsed when the strip was kept", () => {
    sidebar({ sidebarRail: true });

    expect(screen.getByRole("button", { name: "Expand the sidebar" })).toBeInTheDocument();
    expect(screen.queryByText("MySpec")).not.toBeInTheDocument();
  });

  it("gives the rows their short forms under 330px", () => {
    vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(300);
    const task = makeTask({
      stage: "implementation",
      steps: [1, 2, 3].map((number) => makeStep({ number })),
      currentStep: 3,
      situations: [
        makeSituation({ kind: "question", place: { kind: "step", stage: "", step: 3 } }),
      ],
    });
    const app = makeState({ tasks: [task] });
    const row = taskRow(app, task, Date.now());

    renderWithStore(<Sidebar />, { state: app });

    expect(row.line2.short).not.toBe(row.line2.long);
    // Wide, the long form fits in jsdom, which measures nothing; the short one shows only narrow.
    expect(screen.getByText(row.line2.short)).toBeInTheDocument();
  });

  it("expands the nodes of the item on screen and shows its repository again", () => {
    renderWithStore(<Sidebar />, {
      state: makeState({
        repositories: [makeRepository({ id: "repo-1" }), makeRepository({ id: "repo-2" })],
        tasks: [makeTask({ id: "task-1", repositoryId: "repo-1" })],
        repositoryFilter: "repo-2",
      }),
      ui: { location: { kind: "task", id: "task-1" }, sidebarCollapsed: new Set(["no-board"]) },
    });

    expect(useAppStore.getState().sidebarCollapsed.has("no-board")).toBe(false);
    expect(api.setRepositoryFilter).toHaveBeenCalledWith("");
  });

  it("shows every repository again for a discussion of a board the filter hides", () => {
    renderWithStore(<Sidebar />, {
      state: makeState({
        repositories: [
          makeRepository({ id: "repo-1", boardId: "board-1" }),
          makeRepository({ id: "repo-2", boardId: "board-2" }),
        ],
        boards: [
          makeBoard({ id: "board-1", repositoryIds: ["repo-1"] }),
          makeBoard({ id: "board-2", title: "Ops", repositoryIds: ["repo-2"] }),
        ],
        tasks: [],
        discussions: [makeDiscussion({ id: "discussion-1", boardId: "board-2" })],
        repositoryFilter: "repo-1",
      }),
      ui: { location: { kind: "discussion", id: "discussion-1" } },
    });

    expect(api.setRepositoryFilter).toHaveBeenCalledWith("");
  });

  it("keeps the filter for a discussion of the board it shows", () => {
    renderWithStore(<Sidebar />, {
      state: makeState({
        repositories: [makeRepository({ id: "repo-1", boardId: "board-1" })],
        boards: [makeBoard({ id: "board-1", repositoryIds: ["repo-1"] })],
        tasks: [],
        discussions: [makeDiscussion({ id: "discussion-1", boardId: "board-1" })],
        repositoryFilter: "repo-1",
      }),
      ui: { location: { kind: "discussion", id: "discussion-1" } },
    });

    expect(api.setRepositoryFilter).not.toHaveBeenCalled();
  });
});
