import { act, createEvent, fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "@/app/App";
import { api } from "@/lib/wails";
import { useAppStore } from "@/store/app-store";
import { renderWithStore, resetAppStore } from "@/test/render";
import {
  makeArchivedTask,
  makeMigration,
  makeSituation,
  makeState,
  makeTask,
  subscriberCount,
} from "@/test/wails-mock";

beforeEach(() => {
  resetAppStore();
});

// Two tasks wait for the user: add-login for a reply, and fix-header for an
// error that started later.
function waitingState() {
  return makeState({
    tasks: [
      makeTask({
        situations: [makeSituation({ id: "s-reply", startedAt: "2026-09-05T10:00:00Z" })],
      }),
      makeTask({
        id: "task-2",
        name: "fix-header",
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
  it("renders the shell once the first snapshot arrives", async () => {
    renderWithStore(<App />);

    expect(
      await screen.findByRole("button", { name: "Repository filter: All repositories" }),
    ).toBeInTheDocument();
    expect(screen.getByText("No tasks yet")).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Theme" })).toBeInTheDocument();
  });

  it("renders the welcome screen without a registered repository", async () => {
    vi.mocked(api.getState).mockResolvedValue(makeState({ repositories: [] }));

    renderWithStore(<App />);

    expect(await screen.findByRole("button", { name: /^Add repository/ })).toBeInTheDocument();
  });

  it("renders the migration screen when the data could not be updated", async () => {
    vi.mocked(api.getState).mockResolvedValue(makeState({ migration: makeMigration() }));

    renderWithStore(<App />);

    expect(
      await screen.findByRole("heading", { name: "MySpec couldn't be updated" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Repository filter: All repositories" }),
    ).not.toBeInTheDocument();
  });

  it("opens the new task dialog on Ctrl+N", async () => {
    const { user } = renderWithStore(<App />);
    await screen.findByRole("button", { name: "Repository filter: All repositories" });

    await user.keyboard("{Control>}n{/Control}");

    expect(await screen.findByRole("heading", { name: "New task" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Repository: dev/web" })).toBeInTheDocument();
  });

  it("leaves Ctrl+N alone without a registered repository", async () => {
    vi.mocked(api.getState).mockResolvedValue(makeState({ repositories: [] }));
    const { user } = renderWithStore(<App />);
    await screen.findByRole("button", { name: /^Add repository/ });

    await user.keyboard("{Control>}n{/Control}");

    expect(screen.queryByRole("heading", { name: "New task" })).not.toBeInTheDocument();
  });

  it("opens the first entry waiting for the user on Ctrl+J, leaving the open task out", async () => {
    vi.mocked(api.getState).mockResolvedValue(waitingState());
    const { user } = renderWithStore(<App />);
    await screen.findByRole("listbox", { name: "Tasks" });

    // The error comes before the reply, though it started later.
    await user.keyboard("{Control>}j{/Control}");

    expect(await screen.findByRole("option", { name: /^fix-header,/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("button", { name: "Delete task" })).toBeInTheDocument();

    // The task on screen is not an entry any more: the next one is.
    await user.keyboard("{Control>}j{/Control}");

    expect(screen.getByRole("option", { name: /^add-login,/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("changes nothing on Ctrl+J when nothing waits for the user", async () => {
    vi.mocked(api.getState).mockResolvedValue(makeState({ tasks: [makeTask()] }));
    const { user } = renderWithStore(<App />);
    await screen.findByRole("listbox", { name: "Tasks" });

    await user.keyboard("{Control>}j{/Control}");

    expect(screen.getByText("No task open")).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /^add-login,/ })).toHaveAttribute(
      "aria-selected",
      "false",
    );
  });

  it("opens the first entry on Ctrl+J from the message box of a conversation", async () => {
    vi.mocked(api.getState).mockResolvedValue(waitingState());
    const { user } = renderWithStore(<App />);

    await user.click(await screen.findByRole("option", { name: /^add-login,/ }));
    const box = await screen.findByPlaceholderText("Reply to the agent…");
    // Focused directly: jsdom lays nothing out, so a click lands on the resize handle.
    act(() => box.focus());
    await user.keyboard("half a message");
    expect(box).toHaveFocus();

    await user.keyboard("{Control>}j{/Control}");

    expect(await screen.findByRole("option", { name: /^fix-header,/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    // What the user was typing stays with the conversation it was typed in.
    expect(useAppStore.getState().drafts["task-1|prd"]).toBe("half a message");
  });

  it("leaves the creation dialog where it is on Ctrl+J", async () => {
    vi.mocked(api.getState).mockResolvedValue(waitingState());
    const { user } = renderWithStore(<App />);
    await screen.findByRole("listbox", { name: "Tasks" });
    await user.keyboard("{Control>}n{/Control}");
    await screen.findByRole("heading", { name: "New task" });

    const shortcut = createEvent.keyDown(window, { key: "j", ctrlKey: true });
    fireEvent(window, shortcut);

    expect(shortcut.defaultPrevented).toBe(true);
    expect(screen.getByRole("heading", { name: "New task" })).toBeInTheDocument();
    expect(useAppStore.getState().openTaskId).toBeNull();
  });

  it("leaves Ctrl+J alone without a registered repository", async () => {
    vi.mocked(api.getState).mockResolvedValue(makeState({ repositories: [] }));
    renderWithStore(<App />);
    await screen.findByRole("button", { name: /^Add repository/ });

    const shortcut = createEvent.keyDown(window, { key: "j", ctrlKey: true });
    fireEvent(window, shortcut);

    expect(shortcut.defaultPrevented).toBe(false);
  });

  it("toggles the settings on Ctrl+,", async () => {
    const { user } = renderWithStore(<App />);
    await screen.findByRole("button", { name: "Repository filter: All repositories" });

    await user.keyboard("{Control>},{/Control}");

    expect(await screen.findByRole("heading", { name: "Defaults" })).toBeInTheDocument();

    await user.keyboard("{Control>},{/Control}");

    expect(screen.queryByRole("heading", { name: "Defaults" })).not.toBeInTheDocument();
  });

  it("leaves Ctrl+, alone without a registered repository", async () => {
    vi.mocked(api.getState).mockResolvedValue(makeState({ repositories: [] }));
    renderWithStore(<App />);
    await screen.findByRole("button", { name: /^Add repository/ });

    const shortcut = createEvent.keyDown(window, { key: ",", ctrlKey: true });
    fireEvent(window, shortcut);

    expect(shortcut.defaultPrevented).toBe(false);
  });

  it("gives an entry waiting for the user the main area back from the settings", async () => {
    vi.mocked(api.getState).mockResolvedValue(waitingState());
    const { user } = renderWithStore(<App />);
    await screen.findByRole("listbox", { name: "Tasks" });

    await user.click(screen.getByRole("button", { name: "Settings" }));
    expect(await screen.findByRole("heading", { name: "Defaults" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^add-login, Waiting for reply/ }));

    expect(screen.queryByRole("heading", { name: "Defaults" })).not.toBeInTheDocument();
    expect(await screen.findByRole("option", { name: /^add-login,/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("shows a rejected binding and dismisses it", async () => {
    vi.mocked(api.setRepositoryFilter).mockRejectedValueOnce(new Error("filter failed"));
    const { user } = renderWithStore(<App />);
    await screen.findByRole("button", { name: "Repository filter: All repositories" });

    act(() => {
      useAppStore.getState().setError("filter failed");
    });

    expect(await screen.findByRole("status")).toHaveTextContent("filter failed");

    await user.click(screen.getByRole("button", { name: "Dismiss" }));

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("unsubscribes when it unmounts", async () => {
    const { unmount } = renderWithStore(<App />);
    await screen.findByRole("button", { name: "Repository filter: All repositories" });

    unmount();

    await waitFor(() => {
      expect(subscriberCount()).toBe(0);
    });
  });

  it("swaps home for the task screen and back", async () => {
    vi.mocked(api.getState).mockResolvedValue(makeState({ tasks: [makeTask()] }));
    const { user } = renderWithStore(<App />);

    await user.click(await screen.findByRole("option", { name: /^add-login,/ }));

    expect(await screen.findByRole("button", { name: "Delete task" })).toBeInTheDocument();
    expect(screen.queryByText("No task open")).not.toBeInTheDocument();

    act(() => {
      useAppStore.getState().closeTask();
    });

    expect(await screen.findByText("No task open")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Delete task" })).not.toBeInTheDocument();
  });

  it("opens the history over home and comes back to it", async () => {
    vi.mocked(api.getState).mockResolvedValue(makeState({ history: [makeArchivedTask()] }));
    const { user } = renderWithStore(<App />);
    await screen.findByRole("listbox", { name: "Tasks" }).catch(() => null);

    await user.click(await screen.findByRole("button", { name: /^History/ }));

    expect(screen.getByRole("heading", { name: "History" })).toBeInTheDocument();
    expect(screen.queryByText("No tasks yet")).not.toBeInTheDocument();

    act(() => {
      useAppStore.getState().closeHistory();
    });

    expect(screen.getByText("No tasks yet")).toBeInTheDocument();
  });

  it("gives the main area to an archived task, and to a live one over it", async () => {
    vi.mocked(api.getState).mockResolvedValue(
      makeState({
        tasks: [makeTask()],
        history: [makeArchivedTask({ id: "old", name: "fix-header" })],
      }),
    );
    const { user } = renderWithStore(<App />);
    await screen.findByRole("option", { name: /^add-login,/ });

    await user.click(screen.getByRole("button", { name: /^History/ }));
    await user.click(screen.getByRole("button", { name: /fix-header/ }));

    expect(screen.getByText("Archived")).toBeInTheDocument();

    await user.click(screen.getByRole("option", { name: /^add-login,/ }));

    expect(screen.queryByText("Archived")).not.toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Artifacts" })).toBeInTheDocument();
  });
});
