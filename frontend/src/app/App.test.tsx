import { screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "@/app/App";
import { api } from "@/lib/wails";
import { renderWithStore, resetAppStore } from "@/test/render";
import { makeState, makeTask, subscriberCount } from "@/test/wails-mock";

beforeEach(() => {
  resetAppStore();
});

describe("App", () => {
  it("renders the shell of the open workspace once the first snapshot arrives", async () => {
    renderWithStore(<App />);

    expect(await screen.findByRole("treeitem", { name: "projects Root" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "projects" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Switch workspace: projects" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Theme" })).toBeInTheDocument();
  });

  it("renders the welcome screen without a workspace", async () => {
    vi.mocked(api.getState).mockResolvedValue(makeState({ workspace: null }));

    renderWithStore(<App />);

    expect(await screen.findByRole("button", { name: /^Open folder/ })).toBeInTheDocument();
  });

  it("opens the folder dialog on Ctrl+O", async () => {
    const { user } = renderWithStore(<App />);
    await screen.findByRole("treeitem", { name: "projects Root" });

    await user.keyboard("{Control>}o{/Control}");

    expect(api.openFolderDialog).toHaveBeenCalledOnce();
  });

  it("opens the new task dialog on Ctrl+N", async () => {
    const { user } = renderWithStore(<App />);
    await screen.findByRole("treeitem", { name: "projects Root" });

    await user.keyboard("{Control>}n{/Control}");

    expect(await screen.findByRole("heading", { name: "New task" })).toBeInTheDocument();
    expect(screen.getByText("At the workspace root")).toBeInTheDocument();
  });

  it("leaves Ctrl+N alone without a workspace", async () => {
    vi.mocked(api.getState).mockResolvedValue(makeState({ workspace: null }));
    const { user } = renderWithStore(<App />);
    await screen.findByRole("button", { name: /^Open folder/ });

    await user.keyboard("{Control>}n{/Control}");

    expect(screen.queryByRole("heading", { name: "New task" })).not.toBeInTheDocument();
  });

  it("shows a rejected binding and dismisses it", async () => {
    vi.mocked(api.openFolderDialog).mockRejectedValueOnce(new Error("dialog failed"));
    const { user } = renderWithStore(<App />);
    await screen.findByRole("treeitem", { name: "projects Root" });

    await user.keyboard("{Control>}o{/Control}");

    expect(await screen.findByRole("status")).toHaveTextContent("dialog failed");

    await user.click(screen.getByRole("button", { name: "Dismiss" }));

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("unsubscribes when it unmounts", async () => {
    const { unmount } = renderWithStore(<App />);
    await screen.findByRole("treeitem", { name: "projects Root" });

    unmount();

    await waitFor(() => {
      expect(subscriberCount()).toBe(0);
    });
  });

  it("swaps the node panel for the task screen and back", async () => {
    vi.mocked(api.getState).mockResolvedValue(makeState({ tasks: [makeTask()] }));
    const { user } = renderWithStore(<App />);

    await user.click(await screen.findByRole("treeitem", { name: /add-login/ }));

    expect(await screen.findByRole("button", { name: "Delete task" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "projects" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("treeitem", { name: "projects Root" }));

    expect(await screen.findByRole("heading", { name: "projects" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Delete task" })).not.toBeInTheDocument();
  });
});
