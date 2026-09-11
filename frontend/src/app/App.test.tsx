import { act, createEvent, fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "@/app/App";
import { api } from "@/lib/wails";
import { useAppStore } from "@/store/app-store";
import { renderWithStore, resetAppStore } from "@/test/render";
import {
  makeArchivedTask,
  makeSituation,
  makeState,
  makeTask,
  subscriberCount,
} from "@/test/wails-mock";

beforeEach(() => {
  resetAppStore();
});

// Two tasks wait for the user: add-login at the root for a reply, and
// fix-header, inside the collapsed web node, for an error that started later.
function waitingState() {
  return makeState({
    tasks: [
      makeTask({
        situations: [makeSituation({ id: "s-reply", startedAt: "2026-09-05T10:00:00Z" })],
      }),
      makeTask({
        id: "task-2",
        name: "fix-header",
        repoPath: "/home/dev/projects/web",
        situations: [
          makeSituation({
            id: "s-error",
            taskId: "task-2",
            kind: "session_error",
            group: "error",
            startedAt: "2026-09-05T10:05:00Z",
          }),
        ],
      }),
    ],
  });
}

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

  it("opens the first entry waiting for the user on Ctrl+J, leaving the open task out", async () => {
    vi.mocked(api.getState).mockResolvedValue(waitingState());
    const { user } = renderWithStore(<App />);
    await screen.findByRole("treeitem", { name: "projects Root" });

    // The error comes before the reply, though it started later.
    await user.keyboard("{Control>}j{/Control}");

    expect(await screen.findByRole("treeitem", { name: /fix-header/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("button", { name: "Delete task" })).toBeInTheDocument();

    // The task on screen is not an entry any more: the next one is.
    await user.keyboard("{Control>}j{/Control}");

    expect(screen.getByRole("treeitem", { name: /add-login/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("changes nothing on Ctrl+J when nothing waits for the user", async () => {
    vi.mocked(api.getState).mockResolvedValue(makeState({ tasks: [makeTask()] }));
    const { user } = renderWithStore(<App />);
    await screen.findByRole("treeitem", { name: "projects Root" });

    await user.keyboard("{Control>}j{/Control}");

    expect(screen.getByRole("heading", { name: "projects" })).toBeInTheDocument();
    expect(screen.getByRole("treeitem", { name: /add-login/ })).toHaveAttribute(
      "aria-selected",
      "false",
    );
  });

  it("opens the first entry on Ctrl+J from the message box of a conversation", async () => {
    vi.mocked(api.getState).mockResolvedValue(waitingState());
    const { user } = renderWithStore(<App />);

    await user.click(await screen.findByRole("treeitem", { name: /add-login/ }));
    const box = await screen.findByPlaceholderText("Reply to the agent…");
    // Focused directly: jsdom lays nothing out, so a click lands on the resize handle.
    act(() => box.focus());
    await user.keyboard("half a message");
    expect(box).toHaveFocus();

    await user.keyboard("{Control>}j{/Control}");

    expect(await screen.findByRole("treeitem", { name: /fix-header/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    // What the user was typing stays with the conversation it was typed in.
    expect(useAppStore.getState().drafts["task-1|prd"]).toBe("half a message");
  });

  it("leaves the creation dialog where it is on Ctrl+J", async () => {
    vi.mocked(api.getState).mockResolvedValue(waitingState());
    const { user } = renderWithStore(<App />);
    await screen.findByRole("treeitem", { name: "projects Root" });
    await user.keyboard("{Control>}n{/Control}");
    await screen.findByRole("heading", { name: "New task" });

    const shortcut = createEvent.keyDown(window, { key: "j", ctrlKey: true });
    fireEvent(window, shortcut);

    expect(shortcut.defaultPrevented).toBe(true);
    expect(screen.getByRole("heading", { name: "New task" })).toBeInTheDocument();
    expect(useAppStore.getState().openTaskId).toBeNull();
  });

  it("leaves Ctrl+J alone without a workspace", async () => {
    vi.mocked(api.getState).mockResolvedValue(makeState({ workspace: null }));
    renderWithStore(<App />);
    await screen.findByRole("button", { name: /^Open folder/ });

    const shortcut = createEvent.keyDown(window, { key: "j", ctrlKey: true });
    fireEvent(window, shortcut);

    expect(shortcut.defaultPrevented).toBe(false);
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

  it("opens the history over the node panel and comes back to it", async () => {
    vi.mocked(api.getState).mockResolvedValue(makeState({ history: [makeArchivedTask()] }));
    const { user } = renderWithStore(<App />);
    await screen.findByRole("treeitem", { name: "projects Root" });

    await user.click(screen.getByRole("button", { name: /^History/ }));

    expect(screen.getByRole("heading", { name: "History" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "projects" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("treeitem", { name: "projects Root" }));

    expect(screen.getByRole("heading", { name: "projects" })).toBeInTheDocument();
  });

  it("gives the main area to an archived task, and to a live one over it", async () => {
    vi.mocked(api.getState).mockResolvedValue(
      makeState({
        tasks: [makeTask()],
        history: [makeArchivedTask({ id: "old", name: "fix-header" })],
      }),
    );
    const { user } = renderWithStore(<App />);
    await screen.findByRole("treeitem", { name: /add-login/ });

    await user.click(screen.getByRole("button", { name: /^History/ }));
    await user.click(screen.getByRole("button", { name: /fix-header/ }));

    expect(screen.getByText("Archived")).toBeInTheDocument();

    await user.click(screen.getByRole("treeitem", { name: /add-login/ }));

    expect(screen.queryByText("Archived")).not.toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Artifacts" })).toBeInTheDocument();
  });
});
