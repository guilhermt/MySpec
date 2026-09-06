import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { WorkspaceSwitcher } from "@/features/workspace/WorkspaceSwitcher";
import { api } from "@/lib/wails";
import { renderWithStore } from "@/test/render";
import { makeState } from "@/test/wails-mock";

const TRIGGER = "Switch workspace: projects";

describe("WorkspaceSwitcher", () => {
  it("shows the name of the open workspace", () => {
    renderWithStore(<WorkspaceSwitcher />, { state: makeState() });

    expect(screen.getByRole("button", { name: TRIGGER })).toBeInTheDocument();
  });

  it("lists every recent workspace but the open one", async () => {
    const { user } = renderWithStore(<WorkspaceSwitcher />, { state: makeState() });

    await user.click(screen.getByRole("button", { name: TRIGGER }));

    expect(await screen.findByRole("menuitem", { name: "labs ~/labs" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "scratch ~/scratch" })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "projects ~/projects" })).not.toBeInTheDocument();
  });

  it("says so when there is nowhere else to switch to", async () => {
    const { user } = renderWithStore(<WorkspaceSwitcher />, {
      state: makeState({ recents: [{ name: "projects", path: "/home/dev/projects" }] }),
    });

    await user.click(screen.getByRole("button", { name: TRIGGER }));

    expect(await screen.findByText("No other recent workspaces")).toBeInTheDocument();
  });

  it("opens the folder dialog from the menu", async () => {
    const { user } = renderWithStore(<WorkspaceSwitcher />, { state: makeState() });

    await user.click(screen.getByRole("button", { name: TRIGGER }));
    await user.click(await screen.findByRole("menuitem", { name: /^Open folder…/ }));

    expect(api.openFolderDialog).toHaveBeenCalledOnce();
  });

  it("opens the recent workspace that is picked and closes", async () => {
    const { user } = renderWithStore(<WorkspaceSwitcher />, { state: makeState() });

    await user.click(screen.getByRole("button", { name: TRIGGER }));
    await user.click(await screen.findByRole("menuitem", { name: "labs ~/labs" }));

    expect(api.openPath).toHaveBeenCalledWith("/home/dev/labs");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("removes a recent workspace without leaving the menu", async () => {
    const { user } = renderWithStore(<WorkspaceSwitcher />, { state: makeState() });

    await user.click(screen.getByRole("button", { name: TRIGGER }));
    await user.click(
      await screen.findByRole("button", { name: "Remove labs from recent workspaces" }),
    );

    expect(api.removeRecent).toHaveBeenCalledWith("/home/dev/labs");
    expect(api.openPath).not.toHaveBeenCalled();
    expect(screen.getByRole("menu")).toBeInTheDocument();
  });

  it("moves through the menu with the arrow keys", async () => {
    const { user } = renderWithStore(<WorkspaceSwitcher />, { state: makeState() });

    await user.click(screen.getByRole("button", { name: TRIGGER }));
    await screen.findByRole("menu");

    expect(screen.getByRole("menuitem", { name: "labs ~/labs" })).toHaveFocus();

    await user.keyboard("{ArrowDown}");

    expect(screen.getByRole("menuitem", { name: "scratch ~/scratch" })).toHaveFocus();

    await user.keyboard("{ArrowUp}");

    expect(screen.getByRole("menuitem", { name: "labs ~/labs" })).toHaveFocus();
  });
});
