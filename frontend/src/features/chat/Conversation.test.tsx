import { act, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Conversation } from "@/features/chat/Conversation";
import type { Entry, TaskSummary } from "@/lib/wails";
import { useAppStore } from "@/store/app-store";
import type { TranscriptState } from "@/store/transcript";
import { renderWithStore } from "@/test/render";
import { makeEntry, makeState, makeTask, makeTranscript } from "@/test/wails-mock";

function ready(entries: Entry[], pending: Entry[] = []): Record<string, TranscriptState> {
  return { "task-1|prd": { status: "ready", entries, pending, buffered: [] } };
}

function loading(): Record<string, TranscriptState> {
  return { "task-1|prd": { status: "loading", entries: [], pending: [], buffered: [] } };
}

function reloading(entries: Entry[]): Record<string, TranscriptState> {
  return { "task-1|prd": { status: "loading", entries, pending: [], buffered: [] } };
}

/**
 * scrollUp gives the scroller of the conversation the geometry jsdom does not
 * lay out, puts the reader at the top and returns the scrollTo it now uses.
 */
function scrollUp(container: HTMLElement) {
  const scroller = container.querySelector('[data-slot="conversation"]');
  if (scroller === null) {
    throw new Error("the conversation has no scrolling region");
  }
  const scrollTo = vi.fn<(options: ScrollToOptions) => void>();
  Object.defineProperty(scroller, "scrollHeight", { value: 1000, configurable: true });
  Object.defineProperty(scroller, "clientHeight", { value: 100, configurable: true });
  Object.defineProperty(scroller, "scrollTop", { value: 0, configurable: true });
  Object.defineProperty(scroller, "scrollTo", { value: scrollTo, configurable: true });
  act(() => {
    scroller.dispatchEvent(new Event("scroll"));
  });
  return scrollTo;
}

function withTask(overrides: Partial<TaskSummary> = {}) {
  return makeState({ tasks: [makeTask(overrides)] });
}

function action(turnId: string, target: string, status = "done"): Entry {
  return makeEntry("action", {
    turnId,
    action: { toolUseId: target, tool: "Read", label: "Read", target, status },
  });
}

describe("Conversation", () => {
  it("shows a placeholder until the conversation is loaded", () => {
    renderWithStore(<Conversation stage="prd" taskId="task-1" session={makeTask()} />, {
      state: withTask(),
      ui: { transcripts: loading() },
    });

    expect(screen.queryByText("Add a login screen")).not.toBeInTheDocument();
    expect(document.querySelector('[data-slot="skeleton"]')).toBeInTheDocument();
  });

  it("shows the conversation of the stage it was given", () => {
    renderWithStore(<Conversation stage="step:1" taskId="task-1" session={makeTask()} />, {
      state: withTask(),
      ui: { transcripts: ready([makeEntry("user")]) },
    });

    // The entries above belong to the PRD; this conversation is the step's.
    expect(screen.queryByText("Add a login screen")).not.toBeInTheDocument();
  });

  it("draws what was said and what was done, in order", () => {
    const entries = [makeEntry("user"), makeEntry("assistant"), makeEntry("marker")];
    renderWithStore(<Conversation stage="prd" taskId="task-1" session={makeTask()} />, {
      state: withTask(),
      ui: { transcripts: ready(entries) },
    });

    expect(screen.getByText("Add a login screen")).toBeInTheDocument();
    expect(screen.getByTestId("markdown")).toHaveTextContent("On it.");
    expect(screen.getByText("PRD written")).toBeInTheDocument();
  });

  it("shows what the app said to the agent as coming from the app", () => {
    const entries = [
      makeEntry("user", {
        user: { text: "The plan is not valid yet.", pending: false, prompt: false, app: true },
      }),
    ];
    renderWithStore(<Conversation stage="prd" taskId="task-1" session={makeTask()} />, {
      state: withTask(),
      ui: { transcripts: ready(entries) },
    });

    expect(screen.getByText("MySpec · sent to the agent")).toBeInTheDocument();
    expect(screen.getByText("The plan is not valid yet.")).toBeInTheDocument();
  });

  it("leaves the stage prompt out of the conversation", () => {
    const entries = [
      makeEntry("user", {
        user: { text: "", pending: false, prompt: true, app: false },
      }),
      makeEntry("assistant"),
    ];
    renderWithStore(<Conversation stage="prd" taskId="task-1" session={makeTask()} />, {
      state: withTask(),
      ui: { transcripts: ready(entries) },
    });

    expect(screen.getByTestId("markdown")).toHaveTextContent("On it.");
    expect(screen.queryByText("MySpec · sent to the agent")).not.toBeInTheDocument();
  });

  it("keeps the brief the user gave along with the first prompt", () => {
    const entries = [
      makeEntry("user", {
        user: { text: "Add a login screen", pending: false, prompt: true, app: false },
      }),
    ];
    renderWithStore(<Conversation stage="prd" taskId="task-1" session={makeTask()} />, {
      state: withTask(),
      ui: { transcripts: ready(entries) },
    });

    expect(screen.getByText("Add a login screen")).toBeInTheDocument();
  });

  it("collapses the actions of a turn into one line", async () => {
    const entries = [action("turn-1", "a.ts"), action("turn-1", "b.ts")];
    const { user } = renderWithStore(
      <Conversation stage="prd" taskId="task-1" session={makeTask()} />,
      {
        state: withTask(),
        ui: { transcripts: ready(entries) },
      },
    );

    const trigger = screen.getByRole("button", { name: /2 actions/ });
    expect(screen.queryByText("a.ts")).not.toBeInTheDocument();

    await user.click(trigger);

    expect(screen.getByText("a.ts")).toBeInTheDocument();
    expect(screen.getByText("b.ts")).toBeInTheDocument();
  });

  it("marks a message that is still waiting its turn", () => {
    const pending = [
      makeEntry("user", {
        user: { text: "and dark mode", pending: true, prompt: false, app: false },
      }),
    ];
    renderWithStore(<Conversation stage="prd" taskId="task-1" session={makeTask()} />, {
      state: withTask({ pendingCount: 1 }),
      ui: { transcripts: ready([], pending) },
    });

    expect(screen.getByText("and dark mode")).toBeInTheDocument();
    expect(screen.getByText("Queued")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove queued message" })).toBeInTheDocument();
  });

  it("says the agent is thinking when nothing else is happening", () => {
    renderWithStore(
      <Conversation
        stage="prd"
        taskId="task-1"
        session={makeTask({ sessionStatus: "working", turnRunning: true, processRunning: true })}
      />,
      {
        state: withTask(),
        ui: { transcripts: ready([makeEntry("user")]) },
      },
    );

    expect(screen.getByRole("status")).toHaveTextContent("Thinking…");
  });

  it("says the session is starting before the process is up", () => {
    renderWithStore(
      <Conversation
        stage="prd"
        taskId="task-1"
        session={makeTask({ sessionStatus: "working", turnRunning: true })}
      />,
      {
        state: withTask(),
        ui: { transcripts: ready([]) },
      },
    );

    expect(screen.getByRole("status")).toHaveTextContent("Starting session…");
  });

  it("says which attempt is on when the session is being retried", () => {
    renderWithStore(
      <Conversation
        stage="prd"
        taskId="task-1"
        session={makeTask({ sessionStatus: "working", turnRunning: true, retryAttempt: 2 })}
      />,
      {
        state: withTask(),
        ui: { transcripts: ready([]) },
      },
    );

    expect(screen.getByRole("status")).toHaveTextContent("Retrying (attempt 2)…");
  });

  it("stays quiet while a tool is running, since the action already says so", () => {
    renderWithStore(
      <Conversation
        stage="prd"
        taskId="task-1"
        session={makeTask({ sessionStatus: "working", turnRunning: true, processRunning: true })}
      />,
      {
        state: withTask(),
        ui: { transcripts: ready([action("turn-1", "a.ts", "running")]) },
      },
    );

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("stays quiet between turns", () => {
    renderWithStore(<Conversation stage="prd" taskId="task-1" session={makeTask()} />, {
      state: withTask(),
      ui: { transcripts: ready([makeEntry("assistant")]) },
    });

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("offers a way back to the end when the reader is further up", async () => {
    const { container, user } = renderWithStore(
      <Conversation stage="prd" taskId="task-1" session={makeTask()} />,
      {
        state: withTask(),
        ui: { transcripts: ready([makeEntry("user")]) },
      },
    );
    const scrollTo = scrollUp(container);

    act(() => {
      useAppStore
        .getState()
        .setTranscript(makeTranscript({ entries: [makeEntry("user"), makeEntry("assistant")] }));
    });

    await user.click(screen.getByRole("button", { name: "New messages" }));

    expect(scrollTo).toHaveBeenCalledWith({ top: 1000 });
    expect(screen.queryByRole("button", { name: "New messages" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Scroll to bottom" })).not.toBeInTheDocument();
  });

  it("offers no way back while the reader is at the end", () => {
    renderWithStore(<Conversation stage="prd" taskId="task-1" session={makeTask()} />, {
      state: withTask(),
      ui: { transcripts: ready([makeEntry("user")]) },
    });

    expect(screen.queryByRole("button", { name: "Scroll to bottom" })).not.toBeInTheDocument();
  });

  it("offers a way back to the end even when nothing new arrived", async () => {
    const { container, user } = renderWithStore(
      <Conversation stage="prd" taskId="task-1" session={makeTask()} />,
      {
        state: withTask(),
        ui: { transcripts: ready([makeEntry("user")]) },
      },
    );
    const scrollTo = scrollUp(container);

    expect(screen.queryByText("New messages")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Scroll to bottom" }));

    expect(scrollTo).toHaveBeenCalledWith({ top: 1000 });
    expect(screen.queryByRole("button", { name: "Scroll to bottom" })).not.toBeInTheDocument();
  });

  it("keeps the conversation on screen while the session is loaded again", () => {
    renderWithStore(<Conversation stage="prd" taskId="task-1" session={makeTask()} />, {
      state: withTask(),
      ui: { transcripts: reloading([makeEntry("user")]) },
    });

    expect(screen.getByText("Add a login screen")).toBeInTheDocument();
    expect(document.querySelector('[data-slot="skeleton"]')).not.toBeInTheDocument();
  });

  it("keeps what is positioned inside the conversation within its scroll", () => {
    const { container } = renderWithStore(
      <Conversation stage="prd" taskId="task-1" session={makeTask()} />,
      {
        state: withTask(),
        ui: { transcripts: ready([makeEntry("user")]) },
      },
    );
    const scroller = container.querySelector('[data-slot="conversation"]');
    if (scroller === null) {
      throw new Error("the conversation has no scrolling region");
    }

    expect(scroller).toHaveClass("relative");
  });
});
