import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Sidebar } from "@/features/sidebar/Sidebar";
import { api } from "@/lib/wails";
import { useAppStore } from "@/store/app-store";
import { renderWithStore } from "@/test/render";
import { makeRepository, makeState, makeTask } from "@/test/wails-mock";

function sidebar() {
  return renderWithStore(<Sidebar />, { state: makeState({ tasks: [makeTask()] }) });
}

describe("Sidebar", () => {
  it("puts the filter, the tasks and the footer together", () => {
    sidebar();

    expect(
      screen.getByRole("button", { name: "Repository filter: All repositories" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("treeitem", { name: /^task add-login\./ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^History/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Settings" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Theme" })).toBeInTheDocument();
  });

  it("holds the tree of active items in the Work sidebar", () => {
    sidebar();

    const work = screen.getByRole("complementary", { name: "Work" });
    expect(within(work).getByRole("tree", { name: "Active items" })).toBeInTheDocument();
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

  it("opens the creation dialog from New task", async () => {
    const { user } = sidebar();

    await user.click(screen.getByRole("button", { name: "New task" }));

    expect(useAppStore.getState().newTaskOpen).toBe(true);
  });
});
