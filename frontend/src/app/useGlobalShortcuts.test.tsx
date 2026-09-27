import { act, createEvent, fireEvent, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "@/app/App";
import type { Location } from "@/lib/locations";
import { api } from "@/lib/wails";
import { useAppStore } from "@/store/app-store";
import { renderWithStore, resetAppStore } from "@/test/render";
import {
  makeBoard,
  makeDiscussion,
  makePullRequestRow,
  makeReviewCenter,
  makeReviewSummary,
  makeSituation,
  makeState,
  makeTask,
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

const TASK: Location = { kind: "task", id: "task-1" };
const HISTORY: Location = { kind: "history" };

// press fires a key on the window, as a global shortcut listens for it.
function press(init: KeyboardEventInit, target: Element | Window = window): KeyboardEvent {
  const event = createEvent.keyDown(target, init) as KeyboardEvent;
  fireEvent(target, event);
  return event;
}

describe("useGlobalShortcuts", () => {
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
    await screen.findByRole("tree", { name: "Active items" });

    // The error comes before the reply, though it started later.
    await user.keyboard("{Control>}j{/Control}");

    expect(await screen.findByRole("treeitem", { name: /^task fix-header\./ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("button", { name: "Delete task" })).toBeInTheDocument();

    // The task on screen is not an entry any more: the next one is.
    await user.keyboard("{Control>}j{/Control}");

    expect(screen.getByRole("treeitem", { name: /^task add-login\./ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("opens the review a situation is in on Ctrl+J", async () => {
    vi.mocked(api.getState).mockResolvedValue(
      makeState({
        tasks: [makeTask()],
        reviews: [
          makeReviewSummary({
            situations: [
              makeSituation({
                id: "s-report",
                taskId: "review-1",
                kind: "review_report",
                form: "decide",
                place: { kind: "review", stage: "", step: 0 },
              }),
            ],
          }),
        ],
      }),
    );
    const { user } = renderWithStore(<App />);
    await screen.findByRole("tree", { name: "Active items" });

    await user.keyboard("{Control>}j{/Control}");

    expect(useAppStore.getState().location).toEqual({ kind: "review", id: "review-1" });
  });

  it("changes nothing on Ctrl+J when nothing waits for the user", async () => {
    vi.mocked(api.getState).mockResolvedValue(makeState({ tasks: [makeTask()] }));
    const { user } = renderWithStore(<App />);
    await screen.findByRole("tree", { name: "Active items" });

    await user.keyboard("{Control>}j{/Control}");

    expect(screen.getByText("No task open")).toBeInTheDocument();
    expect(screen.getByRole("treeitem", { name: /^task add-login\./ })).toHaveAttribute(
      "aria-selected",
      "false",
    );
  });

  it("opens the first entry on Ctrl+J from the message box of a conversation", async () => {
    vi.mocked(api.getState).mockResolvedValue(waitingState());
    const { user } = renderWithStore(<App />);

    await user.click(await screen.findByRole("treeitem", { name: /^task add-login\./ }));
    const box = await screen.findByPlaceholderText("Reply to the agent…");
    // Focused directly: jsdom lays nothing out, so a click lands on the resize handle.
    act(() => box.focus());
    await user.keyboard("half a message");
    expect(box).toHaveFocus();

    await user.keyboard("{Control>}j{/Control}");

    expect(await screen.findByRole("treeitem", { name: /^task fix-header\./ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    // What the user was typing stays with the conversation it was typed in.
    expect(useAppStore.getState().drafts["task-1|prd"]).toBe("half a message");
  });

  it("leaves the creation dialog where it is on Ctrl+J", async () => {
    vi.mocked(api.getState).mockResolvedValue(waitingState());
    const { user } = renderWithStore(<App />);
    await screen.findByRole("tree", { name: "Active items" });
    await user.keyboard("{Control>}n{/Control}");
    await screen.findByRole("heading", { name: "New task" });

    const shortcut = createEvent.keyDown(window, { key: "j", ctrlKey: true });
    fireEvent(window, shortcut);

    expect(shortcut.defaultPrevented).toBe(true);
    expect(screen.getByRole("heading", { name: "New task" })).toBeInTheDocument();
    expect(useAppStore.getState().location).toEqual({ kind: "home" });
  });

  it("leaves the dialog that starts a review where it is on Ctrl+N, Ctrl+J and Ctrl+,", async () => {
    vi.mocked(api.getState).mockResolvedValue(
      makeState({
        ...waitingState(),
        reviewCenter: makeReviewCenter({ pullRequests: [makePullRequestRow()] }),
      }),
    );
    renderWithStore(<App />);
    await screen.findByRole("tree", { name: "Active items" });
    act(() => {
      useAppStore.getState().openStartReview({ repositoryId: "repo-1", number: 31 });
    });
    await screen.findByRole("heading", { name: "Start review" });

    for (const key of ["n", "j", ","]) {
      const shortcut = createEvent.keyDown(window, { key, ctrlKey: true });
      fireEvent(window, shortcut);
      expect(shortcut.defaultPrevented).toBe(true);
    }

    expect(screen.getByRole("heading", { name: "Start review" })).toBeInTheDocument();
    expect(useAppStore.getState().newTaskOpen).toBe(false);
    expect(useAppStore.getState().location).toEqual({ kind: "home" });
  });

  it("opens the discussion a situation is in on Ctrl+J", async () => {
    vi.mocked(api.getState).mockResolvedValue(
      makeState({
        tasks: [makeTask()],
        discussions: [
          makeDiscussion({
            situations: [
              makeSituation({
                id: "s-drafts",
                taskId: "discussion-1",
                kind: "drafts",
                form: "decide",
                place: { kind: "discussion", stage: "", step: 0 },
              }),
            ],
          }),
        ],
      }),
    );
    const { user } = renderWithStore(<App />);
    await screen.findByRole("tree", { name: "Active items" });

    await user.keyboard("{Control>}j{/Control}");

    expect(useAppStore.getState().location).toEqual({ kind: "discussion", id: "discussion-1" });
  });

  it("leaves the dialog that creates a discussion where it is on Ctrl+N, Ctrl+J and Ctrl+,", async () => {
    vi.mocked(api.getState).mockResolvedValue(waitingState());
    renderWithStore(<App />);
    await screen.findByRole("tree", { name: "Active items" });
    act(() => {
      useAppStore.getState().openNewDiscussion({ boardId: "board-1", cardKeys: ["dev/web#12"] });
    });

    for (const key of ["n", "j", ","]) {
      const shortcut = createEvent.keyDown(window, { key, ctrlKey: true });
      fireEvent(window, shortcut);
      expect(shortcut.defaultPrevented).toBe(true);
    }

    expect(useAppStore.getState().newDiscussion).toEqual({
      boardId: "board-1",
      cardKeys: ["dev/web#12"],
    });
    expect(useAppStore.getState().newTaskOpen).toBe(false);
    expect(useAppStore.getState().location).toEqual({ kind: "home" });
  });

  it("keeps the card of the creation dialog on Ctrl+N", async () => {
    const { user } = renderWithStore(<App />);
    await screen.findByRole("button", { name: "Repository filter: All repositories" });
    const card = { boardId: "board-1", key: "dev/web#7" };
    act(() => {
      useAppStore.getState().openNewTask(card);
    });

    await user.keyboard("{Control>}n{/Control}");

    expect(useAppStore.getState().newTaskCard).toEqual(card);
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

  it("opens the settings on Ctrl+, with a board registered and no repository", async () => {
    vi.mocked(api.getState).mockResolvedValue(
      makeState({ repositories: [], boards: [makeBoard()] }),
    );
    const { user } = renderWithStore(<App />);
    await screen.findByRole("button", { name: "Settings" });

    await user.keyboard("{Control>},{/Control}");

    expect(await screen.findByRole("heading", { name: "Defaults" })).toBeInTheDocument();
  });

  it("leaves Ctrl+, alone without a registered repository", async () => {
    vi.mocked(api.getState).mockResolvedValue(makeState({ repositories: [] }));
    renderWithStore(<App />);
    await screen.findByRole("button", { name: /^Add repository/ });

    const shortcut = createEvent.keyDown(window, { key: ",", ctrlKey: true });
    fireEvent(window, shortcut);

    expect(shortcut.defaultPrevented).toBe(false);
  });

  it("goes back on Alt+← and forward on Alt+→", async () => {
    vi.mocked(api.getState).mockResolvedValue(waitingState());
    renderWithStore(<App />);
    await screen.findByRole("button", { name: "Repository filter: All repositories" });
    act(() => {
      useAppStore.getState().go(TASK);
      useAppStore.getState().go(HISTORY);
    });

    act(() => {
      press({ key: "ArrowLeft", altKey: true });
    });

    expect(useAppStore.getState()).toMatchObject({ location: TASK, pendingFocus: "title" });

    act(() => {
      press({ key: "ArrowRight", altKey: true });
    });

    expect(useAppStore.getState().location).toEqual(HISTORY);
  });

  it("goes back on Alt+← from the message box of a conversation", async () => {
    vi.mocked(api.getState).mockResolvedValue(waitingState());
    renderWithStore(<App />, { ui: { location: TASK, back: [HISTORY] } });
    const box = await screen.findByPlaceholderText("Reply to the agent…");
    act(() => box.focus());

    let event: KeyboardEvent | undefined;
    act(() => {
      event = press({ key: "ArrowLeft", altKey: true, bubbles: true }, box);
    });

    expect(event?.defaultPrevented).toBe(true);
    expect(useAppStore.getState().location).toEqual(HISTORY);
  });

  it("leaves Alt+← and Alt+→ inert under a modal dialog", async () => {
    const { user } = renderWithStore(<App />, { ui: { back: [HISTORY], forward: [TASK] } });
    await screen.findByRole("button", { name: "Repository filter: All repositories" });
    await user.keyboard("{Control>}n{/Control}");
    await screen.findByRole("heading", { name: "New task" });

    for (const key of ["ArrowLeft", "ArrowRight"]) {
      expect(press({ key, altKey: true }).defaultPrevented).toBe(true);
    }

    expect(useAppStore.getState().location).toEqual({ kind: "home" });
  });

  it("closes the settings on Ctrl+, back to the place they were opened from", async () => {
    const { user } = renderWithStore(<App />);
    await screen.findByRole("button", { name: "Repository filter: All repositories" });
    act(() => {
      useAppStore.getState().go(HISTORY);
    });

    await user.keyboard("{Control>},{/Control}");
    await screen.findByRole("heading", { name: "Defaults" });
    await user.keyboard("{Control>},{/Control}");

    expect(useAppStore.getState()).toMatchObject({ location: HISTORY, pendingFocus: "title" });
  });

  it("closes the settings on Esc back to the place they were opened from", async () => {
    const { user } = renderWithStore(<App />);
    await screen.findByRole("button", { name: "Repository filter: All repositories" });
    act(() => {
      useAppStore.getState().go(HISTORY);
      useAppStore.getState().openSettings();
    });
    await screen.findByRole("heading", { name: "Defaults" });

    await user.keyboard("{Escape}");

    expect(useAppStore.getState()).toMatchObject({ location: HISTORY, pendingFocus: "title" });
  });

  it("closes the settings on Esc to Home when there is no place behind them", async () => {
    const { user } = renderWithStore(<App />, {
      ui: { location: { kind: "settings", section: "defaults" } },
    });
    await screen.findByRole("heading", { name: "Defaults" });

    await user.keyboard("{Escape}");

    expect(useAppStore.getState().location).toEqual({ kind: "home" });
  });

  it("cancels the edit of a prompt on Esc before closing the settings", async () => {
    renderWithStore(<App />, { ui: { location: { kind: "settings", section: "plan" } } });
    await screen.findByRole("button", { name: "Repository filter: All repositories" });
    act(() => {
      useAppStore.getState().startPromptEdit("plan", "Plan it.");
    });

    act(() => {
      press({ key: "Escape" });
    });

    expect(useAppStore.getState()).toMatchObject({
      promptEdit: null,
      location: { kind: "settings", section: "plan" },
    });
  });

  it("leaves Esc to the owner that took it first", async () => {
    renderWithStore(<App />, { ui: { location: { kind: "settings", section: "defaults" } } });
    await screen.findByRole("heading", { name: "Defaults" });
    const owner = (event: KeyboardEvent) => event.preventDefault();
    window.addEventListener("keydown", owner, { capture: true });

    act(() => {
      press({ key: "Escape" });
    });
    window.removeEventListener("keydown", owner, { capture: true });

    expect(useAppStore.getState().location).toEqual({ kind: "settings", section: "defaults" });
  });

  it("leaves Esc to a menu open over the screen", async () => {
    renderWithStore(<App />, { ui: { location: { kind: "settings", section: "defaults" } } });
    await screen.findByRole("heading", { name: "Defaults" });
    const menu = document.createElement("div");
    menu.setAttribute("role", "menu");
    menu.setAttribute("data-open", "");
    document.body.append(menu);

    act(() => {
      press({ key: "Escape" });
    });
    menu.remove();

    expect(useAppStore.getState().location).toEqual({ kind: "settings", section: "defaults" });
  });
});
