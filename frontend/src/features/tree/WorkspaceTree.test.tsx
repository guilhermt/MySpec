import { act, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { WorkspaceTree } from "@/features/tree/WorkspaceTree";
import { onStateChanged } from "@/lib/wails";
import { useAppStore } from "@/store/app-store";
import { renderWithStore } from "@/test/render";
import { emitState, makeState } from "@/test/wails-mock";

function labels(): string[] {
  return screen.getAllByRole("treeitem").map((row) => row.textContent ?? "");
}

describe("WorkspaceTree", () => {
  it("opens with the root selected and expanded", () => {
    renderWithStore(<WorkspaceTree />, { state: makeState() });

    const root = screen.getByRole("treeitem", { name: "projects Root" });
    expect(root).toHaveAttribute("aria-selected", "true");
    expect(root).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("No tasks yet")).toBeInTheDocument();
  });

  it("lists the repositories in the order the scan produced", () => {
    renderWithStore(<WorkspaceTree />, { state: makeState() });

    expect(labels()).toEqual(["projects Root", "api", "web"]);
  });

  it("says so when the workspace has no repositories", () => {
    renderWithStore(<WorkspaceTree />, {
      state: makeState({ workspace: { name: "empty", path: "/home/dev/empty", repos: [] } }),
    });

    expect(
      screen.getByText("No repositories found among the direct children of this folder."),
    ).toBeInTheDocument();
    expect(labels()).toEqual(["empty Root"]);
  });

  it("moves the selection down and up with the arrow keys", async () => {
    const { user } = renderWithStore(<WorkspaceTree />, { state: makeState() });

    screen.getByRole("treeitem", { name: "projects Root" }).focus();
    await user.keyboard("{ArrowDown}");

    const api = screen.getByRole("treeitem", { name: "api" });
    expect(api).toHaveAttribute("aria-selected", "true");
    expect(api).toHaveFocus();

    await user.keyboard("{ArrowUp}");

    expect(screen.getByRole("treeitem", { name: "projects Root" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("collapses the root with ArrowLeft and hides the repositories", async () => {
    const { user } = renderWithStore(<WorkspaceTree />, { state: makeState() });

    screen.getByRole("treeitem", { name: "projects Root" }).focus();
    await user.keyboard("{ArrowLeft}");

    expect(screen.getByRole("treeitem", { name: "projects Root" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    expect(labels()).toEqual(["projects Root"]);

    await user.keyboard("{ArrowRight}");

    expect(labels()).toEqual(["projects Root", "api", "web"]);
  });

  it("goes back to the root with ArrowLeft on a collapsed repository", async () => {
    const { user } = renderWithStore(<WorkspaceTree />, { state: makeState() });

    screen.getByRole("treeitem", { name: "web" }).focus();
    await user.keyboard("{End}{ArrowLeft}");

    expect(screen.getByRole("treeitem", { name: "projects Root" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("toggles the focused node with Enter", async () => {
    const { user } = renderWithStore(<WorkspaceTree />, { state: makeState() });

    screen.getByRole("treeitem", { name: "projects Root" }).focus();
    await user.keyboard("{ArrowDown}{Enter}");

    const api = screen.getByRole("treeitem", { name: "api" });
    expect(api).toHaveAttribute("aria-expanded", "true");
    expect(screen.getAllByText("No tasks yet")).toHaveLength(2);

    await user.keyboard("{Enter}");

    expect(screen.getByRole("treeitem", { name: "api" })).toHaveAttribute("aria-expanded", "false");
  });

  it("selects the row that is clicked without expanding it", async () => {
    const { user } = renderWithStore(<WorkspaceTree />, { state: makeState() });

    await user.click(screen.getByRole("treeitem", { name: "web" }));

    const web = screen.getByRole("treeitem", { name: "web" });
    expect(web).toHaveAttribute("aria-selected", "true");
    expect(web).toHaveAttribute("aria-expanded", "false");
  });

  it("expands from the chevron without moving the selection", async () => {
    const { user } = renderWithStore(<WorkspaceTree />, { state: makeState() });

    // The chevron carries no role of its own, which is why it is found by test id.
    const chevron = within(screen.getByRole("treeitem", { name: "api" })).getByTestId("chevron");
    await user.click(chevron);

    expect(screen.getByRole("treeitem", { name: "api" })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("treeitem", { name: "projects Root" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("expands a repository with ArrowRight and returns to the root with Home", async () => {
    const { user } = renderWithStore(<WorkspaceTree />, { state: makeState() });

    screen.getByRole("treeitem", { name: "projects Root" }).focus();
    await user.keyboard("{ArrowDown}{ArrowRight}");

    expect(screen.getByRole("treeitem", { name: "api" })).toHaveAttribute("aria-expanded", "true");

    await user.keyboard("{Home}");

    const root = screen.getByRole("treeitem", { name: "projects Root" });
    expect(root).toHaveAttribute("aria-selected", "true");
    expect(root).toHaveFocus();
  });

  it("goes back to the root when the workspace changes", async () => {
    const { user } = renderWithStore(<WorkspaceTree />, { state: makeState() });
    // The same wiring bootstrap installs, so the reset runs through the event.
    onStateChanged((state) => useAppStore.getState().applyState(state));
    await user.click(screen.getByRole("treeitem", { name: "web" }));

    act(() => {
      emitState(
        makeState({
          workspace: {
            name: "labs",
            path: "/home/dev/labs",
            repos: [{ name: "cli", path: "/home/dev/labs/cli" }],
          },
        }),
      );
    });

    expect(screen.getByRole("treeitem", { name: "labs Root" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(labels()).toEqual(["labs Root", "cli"]);
  });

  it("gives the tree an accessible name", () => {
    renderWithStore(<WorkspaceTree />, { state: makeState() });

    expect(
      within(screen.getByRole("tree", { name: "Workspace" })).getAllByRole("treeitem"),
    ).toHaveLength(3);
  });
});
