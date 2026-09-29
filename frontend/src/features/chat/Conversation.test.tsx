import { act, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Conversation } from "@/features/chat/Conversation";
import { IDLE_SESSION } from "@/features/chat/session";
import type { Entry, TaskSummary } from "@/lib/wails";
import { clockTime } from "@/lib/when";
import { useAppStore } from "@/store/app-store";
import type { TranscriptState } from "@/store/transcript";
import { renderWithStore } from "@/test/render";
import {
  makeAction,
  makeEntry,
  makeSituation,
  makeState,
  makeTask,
  makeTranscript,
} from "@/test/wails-mock";

function ready(entries: Entry[], pending: Entry[] = []): Record<string, TranscriptState> {
  return { "task-1|prd": { status: "ready", error: "", entries, pending, buffered: [] } };
}

function readyState(entries: Entry[]): TranscriptState {
  return { status: "ready", error: "", entries, pending: [], buffered: [] };
}

function loading(): Record<string, TranscriptState> {
  return { "task-1|prd": { status: "loading", error: "", entries: [], pending: [], buffered: [] } };
}

function reloading(entries: Entry[]): Record<string, TranscriptState> {
  return { "task-1|prd": { status: "loading", error: "", entries, pending: [], buffered: [] } };
}

/**
 * scrollUp gives the scroller of the conversation the geometry jsdom does not
 * lay out, puts the reader at the top and returns the scrollTo it now uses.
 */
function scrollUp(container: HTMLElement) {
  const scroller = container.querySelector('[data-slot="conversation"]')?.closest(".size-full");
  if (scroller === null || scroller === undefined) {
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
    action: makeAction({ toolUseId: target, target, status }),
  });
}

describe("Conversation", () => {
  it("shows a placeholder until the conversation is loaded", () => {
    renderWithStore(<Conversation stage="prd" taskId="task-1" session={makeTask()} />, {
      state: withTask(),
      ui: { transcripts: loading() },
    });

    expect(screen.queryByText("Add a login screen")).not.toBeInTheDocument();
    expect(screen.getByRole("status", { name: "Loading the conversation" })).toBeInTheDocument();
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
    expect(screen.getByText("Written PRD.md")).toBeInTheDocument();
  });

  it("draws what the app said to the agent as a line of the product that opens the message", async () => {
    const entries = [
      makeEntry("user", {
        user: {
          text: "The plan is not valid yet.",
          pending: false,
          prompt: false,
          app: true,
          sent: "",
          appKind: "correction",
          appPass: 0,
          appRound: 1,
          appRounds: 3,
          appCount: 2,
        },
      }),
    ];
    const { user } = renderWithStore(
      <Conversation stage="plan" taskId="task-1" session={makeTask()} />,
      { state: withTask(), ui: { transcripts: { "task-1|plan": readyState(entries) } } },
    );

    const line = screen.getByRole("button", { name: /MySpec → Plan agent/ });
    expect(line).toHaveTextContent("The plan isn't valid yet · 2 problems · correction 1 of 3");
    expect(screen.queryByText("The plan is not valid yet.")).not.toBeInTheDocument();

    await user.click(line);

    expect(screen.getByTestId("markdown")).toHaveTextContent("The plan is not valid yet.");
  });

  it("leaves the stage prompt out of the conversation", () => {
    const entries = [
      makeEntry("user", {
        user: {
          text: "",
          pending: false,
          prompt: true,
          app: false,
          sent: "",
          appKind: "",
          appPass: 0,
          appRound: 0,
          appRounds: 0,
          appCount: 0,
        },
      }),
      makeEntry("assistant"),
    ];
    renderWithStore(<Conversation stage="prd" taskId="task-1" session={makeTask()} />, {
      state: withTask(),
      ui: { transcripts: ready(entries) },
    });

    expect(screen.getByTestId("markdown")).toHaveTextContent("On it.");
    expect(screen.queryByText(/PRD started/)).not.toBeInTheDocument();
  });

  it("joins the start of the stage and the brief the user gave into one line that opens it", async () => {
    const entries = [
      makeEntry("user", {
        user: {
          text: "Add a login screen",
          pending: false,
          prompt: true,
          app: false,
          sent: "",
          appKind: "",
          appPass: 0,
          appRound: 0,
          appRounds: 0,
          appCount: 0,
        },
      }),
    ];
    const { user } = renderWithStore(
      <Conversation stage="prd" taskId="task-1" session={makeTask()} />,
      { state: withTask(), ui: { transcripts: ready(entries) } },
    );

    const line = screen.getByRole("button", { name: /PRD started/ });
    expect(line).toHaveTextContent("with your description");

    await user.click(line);

    expect(screen.getByTestId("markdown")).toHaveTextContent("Add a login screen");
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
        user: {
          text: "and dark mode",
          pending: true,
          prompt: false,
          app: false,
          sent: "",
          appKind: "",
          appPass: 0,
          appRound: 0,
          appRounds: 0,
          appCount: 0,
        },
      }),
    ];
    renderWithStore(<Conversation stage="prd" taskId="task-1" session={makeTask()} />, {
      state: withTask({ pendingCount: 1 }),
      ui: { transcripts: ready([], pending) },
    });

    const queued = screen.getByRole("article", { name: "You, queued, sends when the turn ends" });
    expect(queued).toHaveTextContent("and dark mode");
    expect(queued).toHaveTextContent("Queued · sends when the turn ends");
    expect(screen.getByRole("button", { name: "Remove" })).toBeInTheDocument();
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
        session={makeTask({
          sessionStatus: "working",
          turnRunning: true,
          retryAttempt: 3,
          retryMax: 10,
          retryReason: "overloaded",
          retryAt: new Date(Date.now() + 30_000).toISOString(),
        })}
      />,
      {
        state: withTask(),
        ui: { transcripts: ready([]) },
      },
    );

    expect(screen.getByRole("status")).toHaveTextContent(
      /^Retrying · attempt 3 of 10 · the API is overloaded · next try in \d+s$/,
    );
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

  it("offers a way back to the end when the reader is further up, with what arrived", async () => {
    const first = makeEntry("user");
    const { container, user } = renderWithStore(
      <Conversation
        stage="prd"
        taskId="task-1"
        session={makeTask({ sessionStatus: "working", turnRunning: true, processRunning: true })}
      />,
      {
        state: withTask(),
        ui: { transcripts: ready([first]) },
      },
    );
    const scrollTo = scrollUp(container);

    act(() => {
      useAppStore
        .getState()
        .setTranscript(makeTranscript({ entries: [first, makeEntry("assistant")] }));
    });

    const back = screen.getByRole("button", {
      name: "New messages: 1. Go to the end. The PRD agent is working.",
    });
    expect(back).toHaveTextContent("New messages 1");
    expect(back).toHaveTextContent("PRD agent working");
    await user.click(back);

    expect(scrollTo).toHaveBeenCalledWith({ top: 1000 });
    expect(screen.queryByRole("button", { name: /Go to the end/ })).not.toBeInTheDocument();
  });

  it("offers no way back while the reader is at the end", () => {
    renderWithStore(<Conversation stage="prd" taskId="task-1" session={makeTask()} />, {
      state: withTask(),
      ui: { transcripts: ready([makeEntry("user")]) },
    });

    expect(screen.queryByRole("button", { name: /Go to the end/ })).not.toBeInTheDocument();
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

    expect(screen.queryByText(/New messages/)).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Go to the end." }));

    expect(scrollTo).toHaveBeenCalledWith({ top: 1000 });
    expect(screen.queryByRole("button", { name: /Go to the end/ })).not.toBeInTheDocument();
  });

  it("keeps the conversation on screen while the session is loaded again", () => {
    renderWithStore(<Conversation stage="prd" taskId="task-1" session={makeTask()} />, {
      state: withTask(),
      ui: { transcripts: reloading([makeEntry("user")]) },
    });

    expect(screen.getByText("Add a login screen")).toBeInTheDocument();
    expect(screen.queryByRole("status", { name: "Loading the conversation" })).toBeNull();
  });

  it("takes no message in an earlier conversation: no answer, no retry, nothing queued", () => {
    const entries = [
      makeEntry("user"),
      makeEntry("question"),
      makeEntry("permission"),
      makeEntry("error"),
    ];
    const pending = [
      makeEntry("user", {
        user: {
          text: "and dark mode",
          pending: true,
          prompt: false,
          app: false,
          sent: "",
          appKind: "",
          appPass: 0,
          appRound: 0,
          appRounds: 0,
          appCount: 0,
        },
      }),
    ];
    renderWithStore(<Conversation stage="prd" taskId="task-1" session={IDLE_SESSION} readOnly />, {
      state: withTask({ sessionStatus: "error" }),
      ui: { transcripts: ready(entries, pending) },
    });

    expect(screen.getByText("Add a login screen")).toBeInTheDocument();
    expect(screen.getByText("Which database?")).toBeInTheDocument();
    expect(screen.getByText("The agent couldn't finish the turn.")).toBeInTheDocument();
    expect(screen.queryByText("and dark mode")).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
  });

  it("says nothing of the work of the session behind an earlier conversation", () => {
    renderWithStore(
      <Conversation
        stage="prd"
        taskId="task-1"
        session={makeTask({ sessionStatus: "working", turnRunning: true, processRunning: true })}
        readOnly
      />,
      { state: withTask(), ui: { transcripts: ready([makeEntry("user")]) } },
    );

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("opens an earlier conversation at its start, with no way to the end", () => {
    const { container } = renderWithStore(
      <Conversation stage="prd" taskId="task-1" session={IDLE_SESSION} readOnly />,
      { state: withTask(), ui: { transcripts: ready([makeEntry("user")]) } },
    );
    const scrollTo = scrollUp(container);

    act(() => {
      useAppStore
        .getState()
        .setTranscript(makeTranscript({ entries: [makeEntry("user"), makeEntry("assistant")] }));
    });

    expect(scrollTo).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: /Go to the end/ })).toBeNull();
  });

  it("can take the focus from code, for the way back from an earlier conversation", () => {
    const { container } = renderWithStore(
      <Conversation stage="prd" taskId="task-1" session={makeTask()} />,
      { state: withTask(), ui: { transcripts: ready([makeEntry("user")]) } },
    );

    expect(container.querySelector('[data-slot="conversation"]')).toHaveAttribute("tabindex", "-1");
  });

  it("draws a feed named after who talks, busy while the agent writes", () => {
    const writing = makeEntry("assistant");
    if (writing.assistant !== null) {
      writing.assistant.complete = false;
    }
    renderWithStore(<Conversation stage="step:1" taskId="task-1" session={makeTask()} />, {
      state: withTask(),
      ui: { transcripts: { "task-1|step:1": readyState([writing]) } },
    });

    expect(screen.getByRole("feed", { name: "Conversation with the implementer" })).toHaveAttribute(
      "aria-busy",
      "true",
    );
  });

  it("names every entry with its time, and writes the voice only where it changes", () => {
    const at = "2026-09-05T10:00:00Z";
    const time = clockTime(at, Date.now());
    const entries = [
      makeEntry("assistant", { createdAt: at }),
      makeEntry("assistant", { createdAt: at }),
      makeEntry("user", { createdAt: at }),
      makeEntry("assistant", { createdAt: at }),
    ];
    renderWithStore(<Conversation stage="prd" taskId="task-1" session={makeTask()} />, {
      state: withTask(),
      ui: { transcripts: ready(entries) },
    });

    const speeches = screen.getAllByRole("article", { name: `PRD agent, ${time}` });
    expect(speeches).toHaveLength(3);
    expect(speeches.map((speech) => speech.textContent?.startsWith("PRD agent"))).toEqual([
      true,
      false,
      true,
    ]);
    expect(screen.getByRole("article", { name: `You, ${time}` })).toHaveTextContent(
      "Add a login screen",
    );
  });

  it("puts the entries, the end line, the fixed card, the queue and the activity in this order", () => {
    const queued = makeEntry("user");
    if (queued.user !== null) {
      queued.user = { ...queued.user, text: "and dark mode", pending: true };
    }
    const pending = [queued];
    renderWithStore(
      <Conversation
        stage="prd"
        taskId="task-1"
        session={makeTask({ sessionStatus: "working", turnRunning: true, processRunning: true })}
        endLine={<p>The end line</p>}
        fixed={<p>The fixed card</p>}
      />,
      { state: withTask(), ui: { transcripts: ready([makeEntry("user")], pending) } },
    );

    const feed = screen.getByRole("feed");
    const text = feed.textContent ?? "";
    const order = [
      "Add a login screen",
      "The end line",
      "The fixed card",
      "and dark mode",
      "Thinking…",
    ];
    const places = order.map((part) => text.indexOf(part));
    expect(places.every((place) => place >= 0)).toBe(true);
    expect([...places].sort((a, b) => a - b)).toEqual(places);
  });

  it("ends with the activity of the place in place of the work of the session", () => {
    renderWithStore(
      <Conversation
        stage="prd"
        taskId="task-1"
        session={makeTask({ sessionStatus: "working", turnRunning: true, processRunning: true })}
        activity="Opening the pull request…"
      />,
      { state: withTask(), ui: { transcripts: ready([makeEntry("user")]) } },
    );

    expect(screen.getByRole("status")).toHaveTextContent("Opening the pull request…");
    expect(screen.queryByText("Thinking…")).not.toBeInTheDocument();
  });

  it("tells an error of the session, without a button", () => {
    renderWithStore(<Conversation stage="prd" taskId="task-1" session={makeTask()} />, {
      state: withTask(),
      ui: { transcripts: ready([makeEntry("error")]) },
    });

    const error = screen.getByRole("article", { name: /^Session error, / });
    expect(error).toHaveTextContent("The agent couldn't finish the turn.");
    expect(error).toHaveTextContent("the agent stopped");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("marks the last speech with the rail of a question in text when a reply is waited", () => {
    renderWithStore(
      <Conversation stage="prd" taskId="task-1" session={makeTask()} replyWaiting />,
      { state: withTask(), ui: { transcripts: ready([makeEntry("assistant")]) } },
    );

    expect(screen.getByTestId("markdown")).toHaveClass("markdown-rail-last");
  });
});

describe("Conversation stretches and markers", () => {
  const said = (text: string, messageId: string): Entry => {
    const entry = makeEntry("assistant");
    return entry.assistant === null
      ? entry
      : { ...entry, assistant: { ...entry.assistant, text, messageId } };
  };
  const speeches = (count: number, from: number) =>
    Array.from({ length: count }, (_, index) =>
      said(`Speech ${from + index}.`, `msg_${from + index}`),
    );
  const correction = (round: number): Entry => {
    const entry = makeEntry("user");
    return entry.user === null
      ? entry
      : {
          ...entry,
          user: {
            ...entry.user,
            text: `Correction ${round}.`,
            app: true,
            appKind: "correction",
            appRound: round,
            appRounds: 3,
            appCount: 1,
          },
        };
  };
  const invalid = (message: string): Entry => {
    const entry = makeEntry("marker");
    return entry.marker === null
      ? entry
      : {
          ...entry,
          marker: {
            ...entry.marker,
            type: "plan_invalid",
            problems: [{ file: "2-api.md", message }],
          },
        };
  };
  const plan = (entries: Entry[]) => ({ "task-1|plan": readyState(entries) });

  it("folds an earlier stretch of twelve entries into one line that opens it", async () => {
    const { user } = renderWithStore(
      <Conversation stage="plan" taskId="task-1" session={makeTask()} />,
      {
        state: withTask(),
        ui: { transcripts: plan([...speeches(12, 0), correction(1), ...speeches(2, 20)]) },
      },
    );

    const fold = screen.getByRole("button", { name: /12 speeches · 0 actions/ });
    expect(
      screen.getByRole("article", { name: /^Earlier: 12 speeches and 0 actions, from the start/ }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Speech 0.")).not.toBeInTheDocument();
    expect(screen.getByText("Speech 20.")).toBeInTheDocument();

    await user.click(fold);

    expect(fold).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Speech 0.")).toBeInTheDocument();
  });

  it("keeps a stretch open when a new round arrives on screen", () => {
    renderWithStore(<Conversation stage="plan" taskId="task-1" session={makeTask()} />, {
      state: withTask(),
      ui: { transcripts: plan(speeches(12, 0)) },
    });

    act(() => {
      useAppStore.setState({
        transcripts: plan([...speeches(12, 0), correction(1), said("Fixing.", "msg_40")]),
      });
    });

    expect(screen.getByText("Speech 0.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /12 speeches/ })).not.toBeInTheDocument();
  });

  it("opens and focuses the last invalid plan marker the request bar asked for", () => {
    const entries = [invalid("no title"), said("Fixing.", "msg_1"), invalid("no repository")];
    renderWithStore(<Conversation stage="plan" taskId="task-1" session={makeTask()} />, {
      state: withTask(),
      ui: { transcripts: plan(entries) },
    });

    act(() => {
      useAppStore.getState().requestMarkerOpen("task-1", "plan_invalid");
    });

    const [older, newer] = screen.getAllByRole("button", { name: /The plan is still invalid/ });
    const marker = newer?.closest("article");
    expect(marker).toHaveFocus();
    expect(newer).toHaveAttribute("aria-expanded", "true");
    expect(older).toHaveAttribute("aria-expanded", "false");
    expect(marker).toHaveTextContent("2-api.md · no repository");
    expect(screen.queryByText(/no title/)).not.toBeInTheDocument();
    expect(useAppStore.getState().markerRequest).toBeNull();
  });

  it("unfolds the stretch of the marker the request bar asked for", () => {
    const entries = [
      ...speeches(12, 0),
      invalid("no repository"),
      correction(1),
      said("Fixing.", "msg_40"),
    ];
    renderWithStore(<Conversation stage="plan" taskId="task-1" session={makeTask()} />, {
      state: withTask(),
      ui: { transcripts: plan(entries) },
    });
    expect(screen.queryByText("Speech 0.")).not.toBeInTheDocument();

    act(() => {
      useAppStore.getState().requestMarkerOpen("task-1", "plan_invalid");
    });

    expect(screen.getByRole("button", { name: /12 speeches/ })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(screen.getByRole("article", { name: /^The plan is still invalid/ })).toHaveFocus();
    expect(screen.getByText("Speech 0.")).toBeInTheDocument();
  });

  it("drops a request for a marker the conversation doesn't have", () => {
    renderWithStore(<Conversation stage="plan" taskId="task-1" session={makeTask()} />, {
      state: withTask(),
      ui: { transcripts: plan([said("Done.", "msg_1")]) },
    });

    act(() => {
      useAppStore.getState().requestMarkerOpen("task-1", "plan_invalid");
    });

    expect(useAppStore.getState().markerRequest).toBeNull();
  });

  it("leaves the request of another task, and of an earlier conversation, alone", () => {
    renderWithStore(<Conversation stage="plan" taskId="task-1" session={makeTask()} readOnly />, {
      state: withTask(),
      ui: { transcripts: plan([invalid("no title")]) },
    });

    act(() => {
      useAppStore.getState().requestMarkerOpen("task-1", "plan_invalid");
    });
    expect(useAppStore.getState().markerRequest).not.toBeNull();

    act(() => {
      useAppStore.getState().requestMarkerOpen("task-2", "plan_invalid");
    });
    expect(useAppStore.getState().markerRequest).toEqual({
      taskId: "task-2",
      type: "plan_invalid",
    });
  });
  it("blinks the pending card whose situation started with the screen open", () => {
    const situation = makeSituation({
      id: "s-question",
      kind: "question",
      place: { kind: "stage", stage: "prd", step: 0 },
    });
    renderWithStore(<Conversation stage="prd" taskId="task-1" session={makeTask()} />, {
      state: withTask({ situations: [situation] }),
      ui: { transcripts: ready([makeEntry("question")]) },
    });

    const card = screen.getByRole("article", { name: /^Question, answer with/ });
    expect(card).not.toHaveAttribute("data-flash");

    act(() => {
      useAppStore.getState().flashSituation("s-question");
    });

    expect(card).toHaveAttribute("data-flash", "wait");
  });

  it("starts the one stop of Tab on the pending card", () => {
    renderWithStore(<Conversation stage="prd" taskId="task-1" session={makeTask()} />, {
      state: withTask(),
      ui: { transcripts: ready([makeEntry("question"), makeEntry("user")]) },
    });

    expect(screen.getByRole("article", { name: /^Question, answer with/ })).toHaveAttribute(
      "tabindex",
      "0",
    );
  });
});
