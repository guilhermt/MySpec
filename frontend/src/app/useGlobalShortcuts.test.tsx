import { act, createEvent, fireEvent, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "@/app/App";
import type { Location } from "@/lib/locations";
import { api } from "@/lib/wails";
import { useAppStore } from "@/store/app-store";
import type { TranscriptState } from "@/store/transcript";
import { renderWithStore, resetAppStore } from "@/test/render";
import {
  makeBoard,
  makeDiscussion,
  makeMigration,
  makePullRequestRow,
  makeReviewCenter,
  makeReviewSummary,
  makeSituation,
  makeState,
  makeTask,
  makeTaskConversation,
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

// welcomeState is the app with nothing registered and nothing active.
function welcomeState() {
  return makeState({
    repositories: [],
    boards: [],
    tasks: [],
    reviews: [],
    discussions: [],
    history: [],
    reviewHistory: [],
    discussionHistory: [],
  });
}

const TASK: Location = { kind: "task", id: "task-1" };
const REVIEW: Location = { kind: "review", id: "review-1" };
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

  it("leaves Ctrl+N alone in the welcome mode", async () => {
    vi.mocked(api.getState).mockResolvedValue(welcomeState());
    const { user } = renderWithStore(<App />);
    await screen.findByRole("heading", { name: "Welcome to MySpec" });

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
    expect(screen.getByRole("button", { name: "More actions" })).toBeInTheDocument();

    // The task on screen is not an entry any more: the next one is.
    await user.keyboard("{Control>}j{/Control}");

    expect(screen.getByRole("treeitem", { name: /^task add-login\./ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("opens the next entry on Ctrl+J from the page of an item that left", async () => {
    vi.mocked(api.getState).mockResolvedValue(waitingState());
    const { user } = renderWithStore(<App />, {
      ui: { location: { kind: "gone", item: "task", id: "task-9", name: "add-docs", boardId: "" } },
    });
    await screen.findByText("add-docs was deleted");

    await user.keyboard("{Control>}j{/Control}");

    expect(await screen.findByRole("treeitem", { name: /^task fix-header\./ })).toHaveAttribute(
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

  it("stays where it is on Ctrl+J and says so when nothing waits for the user", async () => {
    vi.mocked(api.getState).mockResolvedValue(makeState({ tasks: [makeTask()] }));
    const { user } = renderWithStore(<App />);
    await screen.findByRole("tree", { name: "Active items" });

    await user.keyboard("{Control>}j{/Control}");

    expect(screen.getByRole("region", { name: "Start" })).toBeInTheDocument();
    expect(screen.getByRole("treeitem", { name: /^task add-login\./ })).toHaveAttribute(
      "aria-selected",
      "false",
    );
    expect(screen.getByRole("status")).toHaveTextContent("Nothing else needs you now.");
  });

  it("opens the first entry on Ctrl+J from the message box of a conversation", async () => {
    vi.mocked(api.getState).mockResolvedValue(waitingState());
    const { user } = renderWithStore(<App />);

    await user.click(await screen.findByRole("treeitem", { name: /^task add-login\./ }));
    const box = await screen.findByRole("textbox", { name: /^Reply to the/ });
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
    await screen.findByRole("heading", { name: "Review web#31" });

    for (const key of ["n", "j", ","]) {
      const shortcut = createEvent.keyDown(window, { key, ctrlKey: true });
      fireEvent(window, shortcut);
      expect(shortcut.defaultPrevented).toBe(true);
    }

    expect(screen.getByRole("heading", { name: "Review web#31" })).toBeInTheDocument();
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
      useAppStore
        .getState()
        .openNewDiscussion({ boardId: "board-1", cardKeys: ["dev/web#12"], askBoard: false });
    });

    for (const key of ["n", "j", ","]) {
      const shortcut = createEvent.keyDown(window, { key, ctrlKey: true });
      fireEvent(window, shortcut);
      expect(shortcut.defaultPrevented).toBe(true);
    }

    expect(useAppStore.getState().newDiscussion).toEqual({
      boardId: "board-1",
      cardKeys: ["dev/web#12"],
      askBoard: false,
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

  it("leaves Ctrl+J and Ctrl+E alone in the welcome mode", async () => {
    vi.mocked(api.getState).mockResolvedValue(welcomeState());
    renderWithStore(<App />);
    await screen.findByRole("heading", { name: "Welcome to MySpec" });

    for (const key of ["j", "e"]) {
      const shortcut = createEvent.keyDown(window, { key, ctrlKey: true });
      fireEvent(window, shortcut);

      expect(shortcut.defaultPrevented).toBe(false);
    }
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

  it("toggles the settings on Ctrl+, in the welcome mode and closes them to the welcome", async () => {
    vi.mocked(api.getState).mockResolvedValue(welcomeState());
    const { user } = renderWithStore(<App />);
    await screen.findByRole("heading", { name: "Welcome to MySpec" });

    await user.keyboard("{Control>},{/Control}");
    expect(await screen.findByRole("heading", { name: "Defaults" })).toBeInTheDocument();

    await user.keyboard("{Control>},{/Control}");
    const title = await screen.findByRole("heading", { name: "Welcome to MySpec" });
    expect(title).toHaveFocus();
  });

  it("closes the settings on Esc in the welcome mode", async () => {
    vi.mocked(api.getState).mockResolvedValue(welcomeState());
    const { user } = renderWithStore(<App />);
    await screen.findByRole("heading", { name: "Welcome to MySpec" });
    await user.keyboard("{Control>},{/Control}");
    await screen.findByRole("heading", { name: "Defaults" });

    await user.keyboard("{Escape}");

    expect(await screen.findByRole("heading", { name: "Welcome to MySpec" })).toBeInTheDocument();
  });

  it("goes back on Alt+← in the welcome mode", async () => {
    vi.mocked(api.getState).mockResolvedValue(welcomeState());
    renderWithStore(<App />);
    await screen.findByRole("heading", { name: "Welcome to MySpec" });
    act(() => {
      useAppStore.getState().openSettings();
    });

    act(() => {
      press({ key: "ArrowLeft", altKey: true });
    });

    expect(useAppStore.getState().location).toEqual({ kind: "home" });
    act(() => {
      press({ key: "ArrowRight", altKey: true });
    });
    expect(useAppStore.getState().location.kind).toBe("settings");
  });

  it("answers to no shortcut on the refused migration", async () => {
    vi.mocked(api.getState).mockResolvedValue(makeState({ migration: makeMigration() }));
    renderWithStore(<App />);
    await screen.findByRole("heading", { name: "MySpec couldn't be updated" });

    const shortcut = createEvent.keyDown(window, { key: ",", ctrlKey: true });
    fireEvent(window, shortcut);

    expect(shortcut.defaultPrevented).toBe(false);
    expect(useAppStore.getState().location.kind).toBe("home");
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

    // The header of the task takes the focus on its title.
    expect(useAppStore.getState()).toMatchObject({ location: TASK, pendingFocus: null });
    expect(screen.getByRole("heading", { level: 1, name: "add-login" })).toHaveFocus();

    act(() => {
      press({ key: "ArrowRight", altKey: true });
    });

    expect(useAppStore.getState().location).toEqual(HISTORY);
  });

  it("goes back on Alt+← from the message box of a conversation", async () => {
    vi.mocked(api.getState).mockResolvedValue(waitingState());
    renderWithStore(<App />, { ui: { location: TASK, back: [HISTORY] } });
    const box = await screen.findByRole("textbox", { name: /^Reply to the/ });
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

  it("opens the worktree of the task on screen on Ctrl+E from the message box", async () => {
    vi.mocked(api.getState).mockResolvedValue(
      makeState({ tasks: [makeTask({ worktreePath: "/worktrees/add-login" })] }),
    );
    renderWithStore(<App />, { ui: { location: TASK } });
    const box = await screen.findByRole("textbox", { name: /^Reply to the/ });
    act(() => box.focus());

    let event: KeyboardEvent | undefined;
    act(() => {
      event = press({ key: "e", ctrlKey: true, bubbles: true }, box);
    });

    expect(event?.defaultPrevented).toBe(true);
    expect(api.openInEditor).toHaveBeenCalledWith("task-1");
  });

  it("leaves Ctrl+E alone on a task without a worktree", async () => {
    vi.mocked(api.getState).mockResolvedValue(makeState({ tasks: [makeTask()] }));
    renderWithStore(<App />, { ui: { location: TASK } });
    await screen.findByRole("textbox", { name: /^Reply to the/ });

    act(() => {
      press({ key: "e", ctrlKey: true });
    });

    expect(api.openInEditor).not.toHaveBeenCalled();
  });

  it("leaves Ctrl+E inert under a modal dialog", async () => {
    vi.mocked(api.getState).mockResolvedValue(
      makeState({ tasks: [makeTask({ worktreePath: "/worktrees/add-login" })] }),
    );
    const { user } = renderWithStore(<App />, { ui: { location: TASK } });
    await screen.findByRole("textbox", { name: /^Reply to the/ });
    await user.keyboard("{Control>}n{/Control}");
    await screen.findByRole("heading", { name: "New task" });

    expect(press({ key: "e", ctrlKey: true }).defaultPrevented).toBe(true);

    expect(api.openInEditor).not.toHaveBeenCalled();
  });

  it("opens the worktree of the review on screen on Ctrl+E from the message box", async () => {
    vi.mocked(api.getState).mockResolvedValue(
      makeState({ reviews: [makeReviewSummary({ worktreePath: "/worktrees/web/pr_31" })] }),
    );
    renderWithStore(<App />, { ui: { location: REVIEW } });
    const box = await screen.findByRole("textbox");
    act(() => box.focus());

    let event: KeyboardEvent | undefined;
    act(() => {
      event = press({ key: "e", ctrlKey: true, bubbles: true }, box);
    });

    expect(event?.defaultPrevented).toBe(true);
    expect(api.openReviewInEditor).toHaveBeenCalledWith("review-1");
    expect(api.openInEditor).not.toHaveBeenCalled();
  });

  it("leaves Ctrl+E alone on a review without a worktree", async () => {
    vi.mocked(api.getState).mockResolvedValue(
      makeState({ reviews: [makeReviewSummary({ worktreePath: "" })] }),
    );
    renderWithStore(<App />, { ui: { location: REVIEW } });
    await screen.findByRole("textbox");

    act(() => {
      press({ key: "e", ctrlKey: true });
    });

    expect(api.openReviewInEditor).not.toHaveBeenCalled();
  });

  it("leaves a shortcut to what the screen took for itself first", async () => {
    vi.mocked(api.getState).mockResolvedValue(
      makeState({ reviews: [makeReviewSummary({ worktreePath: "/worktrees/web/pr_31" })] }),
    );
    // Ahead of the listener of the app, as a finding is: it opens its line on Ctrl+E.
    const took = (event: KeyboardEvent) => event.preventDefault();
    window.addEventListener("keydown", took);
    try {
      renderWithStore(<App />, { ui: { location: REVIEW } });
      await screen.findByRole("textbox");

      act(() => {
        press({ key: "e", ctrlKey: true });
      });
    } finally {
      window.removeEventListener("keydown", took);
    }

    expect(api.openReviewInEditor).not.toHaveBeenCalled();
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

    expect(useAppStore.getState().location).toEqual(HISTORY);
    expect(screen.getByRole("heading", { level: 1, name: "History" })).toHaveFocus();
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

    expect(useAppStore.getState().location).toEqual(HISTORY);
    expect(screen.getByRole("heading", { level: 1, name: "History" })).toHaveFocus();
  });

  it("closes the settings on Esc to Home when there is no place behind them", async () => {
    const { user } = renderWithStore(<App />, {
      ui: { location: { kind: "settings", section: "defaults" } },
    });
    await screen.findByRole("heading", { name: "Defaults" });

    await user.keyboard("{Escape}");

    expect(useAppStore.getState().location).toEqual({ kind: "home" });
  });

  it("closes the open panel on Esc and gives the focus back to its button", async () => {
    vi.mocked(api.getState).mockResolvedValue(makeState({ tasks: [makeTask()] }));
    const { user } = renderWithStore(<App />, { ui: { location: TASK } });
    await user.click(await screen.findByRole("button", { name: "Artifacts" }));
    expect(screen.getByRole("complementary", { name: "Artifacts" })).toBeInTheDocument();

    await user.keyboard("{Escape}");

    expect(useAppStore.getState()).toMatchObject({ panel: null, location: TASK });
    expect(screen.queryByRole("complementary", { name: "Artifacts" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Artifacts" })).toHaveFocus();
  });

  it("closes the panel on Esc before closing the settings", () => {
    renderWithStore(<App />, {
      ui: { location: { kind: "settings", section: "defaults" }, panel: "artifacts" },
    });

    act(() => {
      press({ key: "Escape" });
    });

    expect(useAppStore.getState()).toMatchObject({
      panel: null,
      location: { kind: "settings", section: "defaults" },
    });
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

  describe("with an earlier conversation on screen", () => {
    // READING is a task on its tech spec whose PRD conversation is read in place of it.
    const READING = makeState({
      tasks: [
        makeTask({
          stage: "tech_spec",
          conversations: [
            makeTaskConversation({ stage: "prd" }),
            makeTaskConversation({ stage: "tech_spec" }),
          ],
        }),
      ],
    });
    const READ: TranscriptState = {
      status: "ready",
      error: "",
      entries: [],
      pending: [],
      buffered: [],
    };
    const TRANSCRIPTS = { "task-1|prd": READ, "task-1|tech_spec": READ };
    const EARLIER = "PRD, an earlier conversation";

    function reading(panel: "details" | null) {
      // The panel was open beside the conversation when the earlier one opened, or not at all.
      vi.mocked(api.getState).mockResolvedValue(READING);
      return renderWithStore(<App />, {
        state: READING,
        ui: {
          location: TASK,
          panel,
          transcripts: TRANSCRIPTS,
          earlierConversation: {
            taskId: "task-1",
            stage: "prd",
            from: panel === null ? null : "panel",
          },
        },
      });
    }

    // openLayer puts over the screen a layer as Base UI draws it open: a listbox, a popover or the
    // ⋯ menu. Like Base UI, it closes itself on Esc, the last one opened first, once the key has
    // gone through the window, so the global Esc still sees it open.
    function openLayer(attributes: Record<string, string>): HTMLElement {
      const layer = document.createElement("div");
      for (const [name, value] of Object.entries(attributes)) {
        layer.setAttribute(name, value);
      }
      layer.setAttribute("data-open", "");
      document.body.append(layer);
      return layer;
    }

    function closeTopLayerOnEsc(layers: HTMLElement[]): () => void {
      const close = (event: KeyboardEvent) => {
        const top = [...layers].reverse().find((layer) => layer.isConnected);
        if (event.key === "Escape" && top !== undefined) {
          queueMicrotask(() => top.remove());
        }
      };
      window.addEventListener("keydown", close, { capture: true });
      return () => window.removeEventListener("keydown", close, { capture: true });
    }

    it("closes the earlier conversation on Esc, with the focus on the conversation of the task", async () => {
      reading(null);
      expect(await screen.findByRole("region", { name: EARLIER })).toHaveFocus();

      await act(async () => {
        press({ key: "Escape" });
      });

      expect(useAppStore.getState()).toMatchObject({ earlierConversation: null, location: TASK });
      expect(screen.queryByRole("region", { name: EARLIER })).not.toBeInTheDocument();
      expect(document.querySelector('[data-slot="conversation"]')).toHaveFocus();
    });

    it("closes the listbox, the popover, the ⋯, the panel and then the earlier conversation, one Esc each", async () => {
      reading("details");
      await screen.findByRole("region", { name: EARLIER });
      const menu = openLayer({ role: "menu" });
      const popover = openLayer({ "data-slot": "popover-content" });
      const listbox = openLayer({ role: "listbox" });
      const stop = closeTopLayerOnEsc([menu, popover, listbox]);
      const open = () => ({
        listbox: listbox.isConnected,
        popover: popover.isConnected,
        menu: menu.isConnected,
        panel: useAppStore.getState().panel !== null,
        earlier: useAppStore.getState().earlierConversation !== null,
      });

      try {
        const after: ReturnType<typeof open>[] = [];
        for (let times = 0; times < 5; times += 1) {
          await act(async () => {
            press({ key: "Escape" });
          });
          after.push(open());
        }

        const shut = { listbox: false, popover: false, menu: false, panel: false, earlier: false };
        expect(after).toEqual([
          { ...shut, popover: true, menu: true, panel: true, earlier: true },
          { ...shut, menu: true, panel: true, earlier: true },
          { ...shut, panel: true, earlier: true },
          { ...shut, earlier: true },
          shut,
        ]);
        expect(useAppStore.getState().location).toEqual(TASK);
        expect(document.querySelector('[data-slot="conversation"]')).toHaveFocus();
      } finally {
        stop();
      }
    });
  });
});
