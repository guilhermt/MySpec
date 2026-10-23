import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Composer, type ComposerProps } from "@/features/chat/Composer";
import { QuestionCard } from "@/features/chat/entries/QuestionCard";
import type { SessionState } from "@/features/chat/session";
import { api, type QuestionEntry } from "@/lib/wails";
import { useAppStore } from "@/store/app-store";
import { renderWithStore } from "@/test/render";
import { makeState, makeTask } from "@/test/wails-mock";

const DRAFT = { "task-1|prd": "ship it" };
const REST = {
  findings: false,
  askForChange: false,
  reviseFindings: false,
  item: "task",
  drafts: null,
};
const RUNNING = { sessionStatus: "working", turnRunning: true, processRunning: true };

function composer(
  session: SessionState = makeTask(),
  props: Partial<ComposerProps> = {},
  stage = "prd",
) {
  return (
    <Composer
      taskId="task-1"
      stage={stage}
      session={session}
      otherPrimary={false}
      context={REST}
      {...props}
    />
  );
}

function asking(multiSelect = false): QuestionEntry {
  return {
    requestId: "req-1",
    toolUseId: "toolu_1",
    questions: [
      {
        question: "Which limits?",
        header: "Limits",
        options: [{ label: "Per key", description: "" }],
        multiSelect,
      },
      {
        question: "Which store?",
        header: "Store",
        options: [{ label: "Redis", description: "" }],
        multiSelect: false,
      },
    ],
    answers: null,
    status: "pending",
    answeredAt: "",
  };
}

// threeQuestions is a pending card of three single choices, which the card and the composer share.
function threeQuestions(): QuestionEntry {
  const question = asking();
  return {
    ...question,
    questions: [
      ...(question.questions ?? []),
      {
        question: "Which window?",
        header: "Window",
        options: [{ label: "Sliding", description: "" }],
        multiSelect: false,
      },
    ],
  };
}

const field = () => screen.getByRole("textbox", { name: "Reply to the PRD agent" });

describe("Composer", () => {
  it("sends the draft on Enter and empties the field once it is sent", async () => {
    const { user } = renderWithStore(composer(), { ui: { drafts: DRAFT } });

    await user.click(field());
    await user.keyboard("{Enter}");

    expect(api.sendMessage).toHaveBeenCalledWith("task-1", "prd", "ship it", []);
    await waitFor(() => expect(useAppStore.getState().drafts["task-1|prd"]).toBe(""));
  });

  it("sends nothing when there is nothing but blanks to send", async () => {
    const { user } = renderWithStore(composer(), { ui: { drafts: { "task-1|prd": "   " } } });

    await user.click(field());
    await user.keyboard("{Enter}");

    expect(api.sendMessage).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /Send/ })).toHaveAttribute("aria-disabled", "true");
  });

  it("keeps Shift+Enter for a new line", async () => {
    const { user } = renderWithStore(composer(), { ui: { drafts: DRAFT } });

    await user.click(field());
    await user.keyboard("{Shift>}{Enter}{/Shift}");

    expect(api.sendMessage).not.toHaveBeenCalled();
  });

  it("keeps the draft of the stage it was given, not one per task", async () => {
    const { user } = renderWithStore(composer(makeTask(), {}, "step:1"), { ui: { drafts: DRAFT } });

    const input = screen.getByRole("textbox", { name: "Reply to the implementer" });
    expect(input).toHaveValue("");
    expect(input).toHaveAttribute("placeholder", "Reply to the implementer…");

    await user.type(input, "hi");
    await user.keyboard("{Enter}");

    expect(api.sendMessage).toHaveBeenCalledWith("task-1", "step:1", "hi", []);
    expect(useAppStore.getState().drafts["task-1|prd"]).toBe("ship it");
  });

  it("keeps the text and offers to send again when the message is not sent", async () => {
    vi.mocked(api.sendMessage).mockRejectedValueOnce(new Error("the session is gone"));
    const { user } = renderWithStore(composer(), { ui: { drafts: DRAFT } });

    await user.click(field());
    await user.keyboard("{Enter}");

    expect(await screen.findByText("Not sent · the session is gone")).toBeInTheDocument();
    expect(field()).toHaveValue("ship it");
    expect(useAppStore.getState().error).toBeNull();

    await user.click(screen.getByRole("button", { name: /Send again/ }));
    await waitFor(() => expect(field()).toHaveValue(""));
    expect(screen.queryByText(/Not sent/)).not.toBeInTheDocument();
  });

  it("makes Send the primary only with text and no other primary on screen", () => {
    const { unmount } = renderWithStore(composer(), { ui: { drafts: DRAFT } });
    expect(screen.getByRole("button", { name: /Send/ })).toHaveAttribute("data-variant", "primary");
    unmount();

    renderWithStore(composer(makeTask(), { otherPrimary: true }), { ui: { drafts: DRAFT } });
    expect(screen.getByRole("button", { name: /Send/ })).toHaveAttribute(
      "data-variant",
      "secondary",
    );
  });

  it("stops the turn with the button, and with Esc only while the field is empty", async () => {
    const task = makeTask({ ...RUNNING, turnStartedAt: new Date(Date.now() - 5000).toISOString() });
    const { user } = renderWithStore(composer(task));

    expect(screen.getByText(/^Working · \d/)).toBeInTheDocument();
    expect(field()).toHaveAttribute("placeholder", "Queue a message for the PRD agent…");

    await user.click(screen.getByRole("button", { name: "Stop" }));
    await user.click(field());
    await user.keyboard("{Escape}");
    expect(api.interrupt).toHaveBeenCalledTimes(2);
    expect(api.interrupt).toHaveBeenCalledWith("task-1", "prd");

    await user.type(field(), "wait");
    await user.keyboard("{Escape}");
    expect(api.interrupt).toHaveBeenCalledTimes(2);
    expect(field()).toHaveValue("wait");
  });

  it("leaves the turn alone when there is none to stop", async () => {
    const { user } = renderWithStore(composer());

    await user.click(field());
    await user.keyboard("{Escape}");

    expect(api.interrupt).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Stop" })).not.toBeInTheDocument();
  });

  it("queues a message while the agent is answering, with a secondary Send", async () => {
    const { user } = renderWithStore(composer(makeTask(RUNNING)), { ui: { drafts: DRAFT } });

    const send = screen.getByRole("button", { name: /Send/ });
    expect(send).toHaveAttribute("data-variant", "secondary");
    await user.click(send);

    expect(api.sendMessage).toHaveBeenCalledWith("task-1", "prd", "ship it", []);
  });

  it("says what a paused conversation resumes", () => {
    const task = makeTask({ sessionStatus: "paused" });
    renderWithStore(composer(task, { context: { ...REST, item: "review" } }));

    expect(field()).toHaveAttribute("placeholder", "Sending resumes the review…");
  });

  it("resumes the paused task and then sends the message", async () => {
    const task = makeTask({ sessionStatus: "paused" });
    const { user } = renderWithStore(composer(task), { ui: { drafts: DRAFT } });

    expect(field()).toHaveAttribute("placeholder", "Sending resumes the task…");
    expect(screen.queryByRole("button", { name: "Resume" })).not.toBeInTheDocument();

    await user.click(field());
    await user.keyboard("{Enter}");

    await waitFor(() =>
      expect(api.sendMessage).toHaveBeenCalledWith("task-1", "prd", "ship it", []),
    );
    expect(api.resume).toHaveBeenCalledWith("task-1", "prd");
    expect(vi.mocked(api.resume).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(api.sendMessage).mock.invocationCallOrder[0] ?? 0,
    );
  });

  it("stops at a resume that fails, telling it under the field without the app notice", async () => {
    vi.mocked(api.resume).mockRejectedValueOnce(new Error("the worktree is gone"));
    const task = makeTask({ sessionStatus: "paused" });
    const { user } = renderWithStore(composer(task), { ui: { drafts: DRAFT } });

    await user.click(field());
    await user.keyboard("{Enter}");

    expect(await screen.findByText("Not sent · the worktree is gone")).toBeInTheDocument();
    expect(api.sendMessage).not.toHaveBeenCalled();
    expect(useAppStore.getState().error).toBeNull();
    expect(field()).toHaveValue("ship it");
  });

  it("says why an empty Send is disabled in its tooltip, not beside it", async () => {
    const { user } = renderWithStore(composer());

    const send = screen.getByRole("button", { name: /^Send/ });
    expect(send).toHaveAttribute("aria-disabled", "true");
    expect(send).toHaveAccessibleDescription("Write a message");
    const reason = screen.getByText("Write a message");
    expect(reason).toHaveClass("sr-only");

    await user.hover(send);
    expect(await screen.findByRole("tooltip")).toHaveTextContent("Write a message");
  });

  it("gathers the quick replies in a named group of chips", () => {
    const chips = [
      { key: "a", text: "Per key" },
      { key: "b", text: "Per plan" },
    ];
    renderWithStore(composer(makeTask(), { chips }));

    const group = screen.getByRole("group", { name: "Quick replies" });
    const replies = within(group).getAllByRole("button");
    expect(replies.map((reply) => reply.getAttribute("aria-label"))).toEqual([
      "a · Per key",
      "b · Per plan",
    ]);
    expect(replies[0]).toHaveClass("rounded-(--radius-pill)");
  });

  describe("starters", () => {
    const starters = [
      {
        label: "Ask for changes",
        tooltip: "Starts the message: the agent revises the drafts",
        text: "Change the drafts: ",
      },
    ];
    const discussion = { ...REST, item: "discussion", who: "agent" };
    const box = () => screen.getByRole("textbox", { name: "Reply to the agent" });

    it("puts the start of the message before what is written", async () => {
      const { user } = renderWithStore(composer(makeTask(), { starters, context: discussion }), {
        ui: { drafts: DRAFT },
      });

      const group = screen.getByRole("group", { name: "Starts of a message" });
      await user.click(within(group).getByRole("button", { name: "Ask for changes" }));

      expect(box()).toHaveValue("Change the drafts: ship it");
    });

    it("does not repeat a start the box already begins with", async () => {
      const { user } = renderWithStore(composer(makeTask(), { starters, context: discussion }), {
        ui: { drafts: { "task-1|prd": "Change the drafts: drop the third" } },
      });

      await user.click(screen.getByRole("button", { name: "Ask for changes" }));

      expect(box()).toHaveValue("Change the drafts: drop the third");
    });

    it("takes the focus with the cursor at the end of the text", async () => {
      const { user } = renderWithStore(composer(makeTask(), { starters, context: discussion }), {
        ui: { drafts: DRAFT },
      });

      await user.click(screen.getByRole("button", { name: "Ask for changes" }));

      const textarea = box() as HTMLTextAreaElement;
      expect(textarea).toHaveFocus();
      expect(textarea.selectionStart).toBe(textarea.value.length);
      expect(textarea.selectionEnd).toBe(textarea.value.length);
    });

    it("comes before the quick replies in the same strip", () => {
      const chips = [
        { key: "a", text: "Per key" },
        { key: "b", text: "Per plan" },
      ];
      renderWithStore(composer(makeTask(), { starters, chips, context: discussion }));

      const groups = screen.getAllByRole("group").map((group) => group.getAttribute("aria-label"));
      expect(groups.indexOf("Starts of a message")).toBeLessThan(groups.indexOf("Quick replies"));
    });

    it("lets the context name who speaks", () => {
      renderWithStore(composer(makeTask(), { context: discussion }));

      expect(box()).toHaveAttribute("placeholder", "Reply to the agent…");
    });
  });

  it("sends a quick reply without touching the draft", async () => {
    const chips = [
      { key: "a", text: "Per key" },
      { key: "b", text: "Per plan" },
    ];
    const { user } = renderWithStore(composer(makeTask(), { chips }), { ui: { drafts: DRAFT } });

    expect(field()).toHaveAttribute("placeholder", "Answer a or b, or reply to the PRD agent…");
    await user.click(screen.getByRole("button", { name: "b · Per plan" }));

    expect(api.sendMessage).toHaveBeenCalledWith("task-1", "prd", "b", []);
    expect(field()).toHaveValue("ship it");
  });

  it("answers the first question without a choice and goes back to the card", async () => {
    const question = threeQuestions();
    const { user } = renderWithStore(
      <>
        <QuestionCard taskId="task-1" stage="prd" question={question} createdAt="" />
        {composer(makeTask(), { question, otherPrimary: true })}
      </>,
      {
        ui: {
          drafts: { "task-1|prd": "Disk" },
          questionChoices: { "req-1": { 0: { labels: ["Per key"], other: null } } },
        },
      },
    );

    await user.click(field());
    await user.keyboard("{Enter}");

    expect(useAppStore.getState().questionChoices["req-1"]).toEqual({
      0: { labels: ["Per key"], other: null },
      1: { labels: [], other: "Disk" },
    });
    expect(field()).toHaveValue("");
    expect(screen.getByRole("radio", { name: /Sliding/ })).toHaveFocus();
    expect(api.answerQuestion).not.toHaveBeenCalled();
    expect(api.sendMessage).not.toHaveBeenCalled();
  });

  it("sends the card once the text answers the last question", async () => {
    const question = asking();
    const { user } = renderWithStore(composer(makeTask(), { question, otherPrimary: true }), {
      ui: {
        drafts: { "task-1|prd": "Disk" },
        questionChoices: { "req-1": { 0: { labels: ["Per key"], other: null } } },
      },
    });

    await user.click(field());
    await user.keyboard("{Enter}");

    expect(api.answerQuestion).toHaveBeenCalledWith("task-1", "prd", "req-1", {
      "Which limits?": "Per key",
      "Which store?": "Disk",
    });
    await waitFor(() => expect(field()).toHaveValue(""));
    expect(useAppStore.getState().questionChoices["req-1"]).toEqual({
      0: { labels: ["Per key"], other: null },
      1: { labels: [], other: "Disk" },
    });
  });

  it("keeps the text in the field until the answer is sent", async () => {
    let resolve: () => void = () => {};
    vi.mocked(api.answerQuestion).mockReturnValueOnce(
      new Promise<void>((done) => {
        resolve = done;
      }),
    );
    const question = asking();
    const { user } = renderWithStore(composer(makeTask(), { question, otherPrimary: true }), {
      ui: {
        drafts: { "task-1|prd": "Disk" },
        questionChoices: { "req-1": { 0: { labels: ["Per key"], other: null } } },
      },
    });

    await user.click(field());
    await user.keyboard("{Enter}");

    expect(field()).toHaveValue("Disk");
    resolve();
    await waitFor(() => expect(field()).toHaveValue(""));
  });

  it("tells under the field that the answer was not sent, keeping the text to send again", async () => {
    vi.mocked(api.answerQuestion).mockRejectedValueOnce(new Error("the session stopped"));
    const question = asking();
    const { user } = renderWithStore(composer(makeTask(), { question, otherPrimary: true }), {
      ui: {
        drafts: { "task-1|prd": "Disk" },
        questionChoices: { "req-1": { 0: { labels: ["Per key"], other: null } } },
      },
    });

    await user.click(field());
    await user.keyboard("{Enter}");

    expect(await screen.findByText("Not sent · the session stopped")).toBeInTheDocument();
    expect(useAppStore.getState().error).toBeNull();
    expect(field()).toHaveValue("Disk");
    expect(useAppStore.getState().questionChoices["req-1"]).toEqual({
      0: { labels: ["Per key"], other: null },
    });
    const again = screen.getByRole("button", { name: "Send again" });
    expect(again).not.toHaveAttribute("aria-disabled", "true");

    await user.click(again);

    expect(api.answerQuestion).toHaveBeenLastCalledWith("task-1", "prd", "req-1", {
      "Which limits?": "Per key",
      "Which store?": "Disk",
    });
    await waitFor(() => expect(field()).toHaveValue(""));
    expect(screen.queryByText(/Not sent/)).not.toBeInTheDocument();
  });

  it("shows the card sending, with the answer on it, while the composer sends it", async () => {
    let resolve: () => void = () => {};
    vi.mocked(api.answerQuestion).mockReturnValueOnce(
      new Promise<void>((done) => {
        resolve = done;
      }),
    );
    const question = asking();
    const { user } = renderWithStore(
      <>
        <QuestionCard taskId="task-1" stage="prd" question={question} createdAt="" />
        {composer(makeTask(), { question, otherPrimary: true })}
      </>,
      {
        ui: {
          drafts: { "task-1|prd": "Disk" },
          questionChoices: { "req-1": { 0: { labels: ["Per key"], other: null } } },
        },
      },
    );

    await user.click(field());
    await user.keyboard("{Enter}");

    const card = screen.getByRole("article");
    expect(card).toHaveAttribute("aria-busy", "true");
    expect(screen.getByRole("status")).toHaveTextContent("Sending “Per key, Disk”…");
    expect(screen.queryByRole("button", { name: /Answer/ })).not.toBeInTheDocument();

    resolve();
    await waitFor(() => expect(field()).toHaveValue(""));

    expect(card).toHaveAttribute("aria-busy", "true");
    expect(screen.getByRole("radio", { name: /Per key/ })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: /Other: Disk/ })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(api.answerQuestion).toHaveBeenCalledTimes(1);
  });

  it("sends nothing from the field while the card sends the answer", async () => {
    const question = asking();
    const { user } = renderWithStore(composer(makeTask(), { question, otherPrimary: true }), {
      ui: {
        drafts: { "task-1|prd": "Disk" },
        questionChoices: { "req-1": { 0: { labels: ["Per key"], other: null } } },
        questionSending: { "req-1": true },
      },
    });

    await user.click(field());
    await user.keyboard("{Enter}");

    expect(api.answerQuestion).not.toHaveBeenCalled();
    expect(field()).toHaveValue("Disk");
  });

  it("shows the system's Sending… on Send while the card's answer is on its way", () => {
    renderWithStore(composer(makeTask(), { question: asking(), otherPrimary: true }), {
      ui: {
        drafts: { "task-1|prd": "Disk" },
        questionChoices: { "req-1": { 0: { labels: ["Per key"], other: null } } },
        questionSending: { "req-1": true },
      },
    });

    expect(screen.getByRole("button", { name: "Sending…" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Send" })).not.toBeInTheDocument();
  });

  it("drops the card's old failure when the composer sends the answer", async () => {
    vi.mocked(api.answerQuestion).mockRejectedValueOnce(new Error("the session stopped"));
    let resolve: () => void = () => {};
    vi.mocked(api.answerQuestion).mockReturnValueOnce(
      new Promise<void>((done) => {
        resolve = done;
      }),
    );
    const question = asking();
    const { user } = renderWithStore(
      <>
        <QuestionCard taskId="task-1" stage="prd" question={question} createdAt="" />
        {composer(makeTask(), { question, otherPrimary: true })}
      </>,
      {
        ui: {
          questionChoices: {
            "req-1": {
              0: { labels: ["Per key"], other: null },
              1: { labels: ["Redis"], other: null },
            },
          },
        },
      },
    );

    await user.click(screen.getByRole("button", { name: /Answer/ }));
    expect(await screen.findByText("Not sent · the session stopped")).toBeInTheDocument();

    await user.click(field());
    await user.keyboard("{Enter}");

    expect(api.answerQuestion).toHaveBeenCalledTimes(2);
    expect(screen.queryByText(/Not sent/)).not.toBeInTheDocument();
    resolve();
  });

  it("drops the composer's failure when the card answers, and offers Send, not Send again", async () => {
    vi.mocked(api.answerQuestion).mockRejectedValueOnce(new Error("the session stopped"));
    const question = asking();
    const { user } = renderWithStore(
      <>
        <QuestionCard taskId="task-1" stage="prd" question={question} createdAt="" />
        {composer(makeTask(), { question, otherPrimary: true })}
      </>,
      {
        ui: {
          drafts: { "task-1|prd": "Disk" },
          questionChoices: { "req-1": { 0: { labels: ["Per key"], other: null } } },
        },
      },
    );

    await user.click(field());
    await user.keyboard("{Enter}");
    expect(await screen.findByText("Not sent · the session stopped")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send again" })).toBeInTheDocument();

    await user.click(screen.getByRole("radio", { name: /Redis/ }));
    await user.click(screen.getByRole("button", { name: /Answer/ }));

    expect(api.answerQuestion).toHaveBeenCalledTimes(2);
    expect(screen.queryByText(/Not sent/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Send again" })).not.toBeInTheDocument();
  });

  it("drops the composer's failure when the question settles", async () => {
    vi.mocked(api.answerQuestion).mockRejectedValueOnce(new Error("the session stopped"));
    const question = asking();
    const { user, rerender } = renderWithStore(
      composer(makeTask(), { question, otherPrimary: true }),
      {
        ui: {
          drafts: { "task-1|prd": "Disk" },
          questionChoices: { "req-1": { 0: { labels: ["Per key"], other: null } } },
        },
      },
    );

    await user.click(field());
    await user.keyboard("{Enter}");
    expect(await screen.findByText("Not sent · the session stopped")).toBeInTheDocument();

    rerender(composer(makeTask(), { question: null, otherPrimary: true }));

    expect(screen.queryByText(/Not sent/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send" })).toBeInTheDocument();
  });

  it("brings no choices back for a question that settled while its answer failed", async () => {
    let reject: (error: Error) => void = () => {};
    vi.mocked(api.answerQuestion).mockReturnValueOnce(
      new Promise<void>((_, fail) => {
        reject = fail;
      }),
    );
    const question = asking();
    const { user } = renderWithStore(composer(makeTask(), { question, otherPrimary: true }), {
      ui: {
        drafts: { "task-1|prd": "Disk" },
        questionChoices: { "req-1": { 0: { labels: ["Per key"], other: null } } },
      },
    });

    await user.click(field());
    await user.keyboard("{Enter}");
    act(() => useAppStore.setState({ questionChoices: {}, questionSending: {} }));
    reject(new Error("no request"));

    await waitFor(() => expect(api.answerQuestion).toHaveBeenCalledTimes(1));
    await screen.findByText("Not sent · no request");
    expect(useAppStore.getState().questionChoices["req-1"]).toBeUndefined();
  });

  it("changes the model of the session it writes to", async () => {
    const { user } = renderWithStore(composer(makeTask(), {}, "step:2"), { state: makeState() });

    await user.click(screen.getByRole("button", { name: "Conversation model: Fable 5.1 · high" }));
    await user.click(await screen.findByRole("menuitemradio", { name: "Opus 5.5 (1M)" }));

    expect(api.setSessionModel).toHaveBeenCalledWith(
      "task-1",
      "step:2",
      "claude-opus-5-5[1m]",
      "high",
    );
  });

  it("has no model to show without a session", () => {
    renderWithStore(composer(makeTask({ sessionModel: "", sessionEffort: "" })));

    expect(screen.queryByRole("button", { name: /Conversation model:/ })).not.toBeInTheDocument();
  });

  it("measures the context of the session right after the model", async () => {
    const { user } = renderWithStore(composer(makeTask({ contextPercent: 44 })), {
      state: makeState(),
    });
    const meter = screen.getByRole("meter", { name: "Context" });

    expect(meter).toHaveTextContent("44%");
    expect(
      screen.getByRole("button", { name: /Conversation model:/ }).compareDocumentPosition(meter) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    await user.hover(meter);
    expect(await screen.findByRole("tooltip")).toHaveTextContent("Context window 44% used");
  });

  it("shows … for the context before the first reading", () => {
    renderWithStore(composer(makeTask({ contextPercent: null })));

    expect(screen.getByRole("meter", { name: "Context" })).toHaveTextContent("…");
  });

  it("shows — for the context while the session is paused", () => {
    renderWithStore(composer(makeTask({ sessionStatus: "paused", contextPercent: 44 })));

    expect(screen.getByRole("meter", { name: "Context" })).toHaveTextContent("—");
  });

  it("has no context meter without a session", () => {
    renderWithStore(composer(makeTask({ sessionModel: "", sessionEffort: "" })));

    expect(screen.queryByRole("meter")).not.toBeInTheDocument();
  });

  it("never gives way to the conversation above it", () => {
    renderWithStore(composer(makeTask({ sessionStatus: "paused" })));

    const box = field().closest("div.shrink-0");
    expect(box).toHaveClass("pt-(--space-2)", "pb-(--space-4)");
  });

  describe("images", () => {
    const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0];
    const png = (name = "shot.png") => new File([new Uint8Array(PNG)], name, { type: "image/png" });
    const pdf = () =>
      new File([new Uint8Array([...Buffer.from("%PDF-1.7")])], "doc.pdf", {
        type: "application/pdf",
      });
    const paste = (files: File[], text = "") =>
      fireEvent.paste(field(), { clipboardData: { files, getData: () => text, types: [] } });
    const box = () => field().closest<HTMLElement>("[data-slot=composer]") as HTMLElement;
    const attached = () => useAppStore.getState().attachments["task-1|prd"] ?? [];

    it("attaches a pasted image and lets Send go with only images", async () => {
      renderWithStore(composer());
      expect(screen.getByRole("button", { name: /Send/ })).toHaveAttribute("aria-disabled", "true");

      paste([png()]);

      expect(await screen.findByRole("list", { name: "Attached images" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Image 1 of 1, shot.png" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Send/ })).toHaveAttribute(
        "aria-disabled",
        "false",
      );
    });

    it("leaves a paste of text as text", () => {
      renderWithStore(composer());

      const notPrevented = fireEvent.paste(field(), {
        clipboardData: { files: [], getData: () => "hello", types: ["text/plain"] },
      });

      expect(notPrevented).toBe(true);
      expect(attached()).toEqual([]);
    });

    it("refuses a dropped PDF by its format and leaves the text alone", async () => {
      renderWithStore(composer(), { ui: { drafts: DRAFT } });

      fireEvent.drop(box(), { dataTransfer: { types: ["Files"], files: [pdf()] } });

      expect(
        await screen.findByText("Not attached · doc.pdf isn't PNG, JPEG, GIF or WebP"),
      ).toBeInTheDocument();
      expect(attached()).toEqual([]);
      expect(field()).toHaveValue("ship it");
    });

    it("says it takes the images while files are dragged over the box", () => {
      renderWithStore(composer());

      fireEvent.dragEnter(box(), { dataTransfer: { types: ["Files"] } });
      expect(screen.getByText("Drop images to attach")).toBeInTheDocument();
      expect(box()).toHaveClass("border-dashed");

      fireEvent.dragLeave(box(), { dataTransfer: { types: ["Files"] } });
      expect(screen.queryByText("Drop images to attach")).not.toBeInTheDocument();
    });

    it("sends the images with the text, in base64, and clears them", async () => {
      const { user } = renderWithStore(composer(), { ui: { drafts: DRAFT } });
      paste([png()]);
      await screen.findByRole("list", { name: "Attached images" });

      await user.click(screen.getByRole("button", { name: /Send/ }));

      await waitFor(() => expect(api.sendMessage).toHaveBeenCalledTimes(1));
      const [, , text, images] = vi.mocked(api.sendMessage).mock.calls[0] ?? [];
      expect(text).toBe("ship it");
      expect(images).toEqual([Buffer.from(PNG).toString("base64")]);
      await waitFor(() => expect(attached()).toEqual([]));
      expect(screen.queryByRole("list", { name: "Attached images" })).not.toBeInTheDocument();
    });

    it("keeps an image attached while the message is on its way", async () => {
      let finish = () => {};
      vi.mocked(api.sendMessage).mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            finish = resolve;
          }),
      );
      const { user } = renderWithStore(composer(), { ui: { drafts: DRAFT } });
      paste([png()]);
      await screen.findByRole("list", { name: "Attached images" });
      await user.click(screen.getByRole("button", { name: /Send/ }));
      paste([png("late.png")]);
      await waitFor(() => expect(attached()).toHaveLength(2));

      finish();

      await waitFor(() => expect(attached().map((one) => one.name)).toEqual(["late.png"]));
    });

    it("keeps the text and the images when the message is not sent", async () => {
      vi.mocked(api.sendMessage).mockRejectedValueOnce(new Error("the session is gone"));
      const { user } = renderWithStore(composer(), { ui: { drafts: DRAFT } });
      paste([png()]);
      await screen.findByRole("list", { name: "Attached images" });

      await user.click(screen.getByRole("button", { name: /Send/ }));

      expect(await screen.findByText("Not sent · the session is gone")).toBeInTheDocument();
      expect(field()).toHaveValue("ship it");
      expect(attached()).toHaveLength(1);
    });

    it("removes an image with its ×", async () => {
      const { user } = renderWithStore(composer());
      paste([png(), png("two.png")]);
      await screen.findByRole("button", { name: "Image 2 of 2, two.png" });

      await user.click(screen.getByRole("button", { name: "Remove image 1, shot.png" }));

      expect(attached().map((one) => one.name)).toEqual(["two.png"]);
      expect(URL.revokeObjectURL).toHaveBeenCalled();
    });

    it("holds the images back from a pending question until they are removed", async () => {
      const { user } = renderWithStore(composer(makeTask(), { question: asking() }));
      paste([png()]);
      await screen.findByRole("list", { name: "Attached images" });

      await user.click(screen.getByRole("button", { name: /Send/ }));

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Images don't answer a question. Answer the card first, or remove the images.",
      );
      expect(api.sendMessage).not.toHaveBeenCalled();

      await user.click(screen.getByRole("button", { name: "Remove image 1, shot.png" }));
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it("doesn't hold the images back from the next question once the held ones went", async () => {
      const { user, rerender } = renderWithStore(composer(makeTask(), { question: asking() }));
      paste([png()]);
      await screen.findByRole("list", { name: "Attached images" });
      await user.click(screen.getByRole("button", { name: /Send/ }));
      expect(await screen.findByRole("alert")).toBeInTheDocument();

      // The card answers the question, and the images go in a message of their own.
      rerender(composer(makeTask(), { question: null }));
      await user.click(screen.getByRole("button", { name: /Send/ }));
      await waitFor(() => expect(attached()).toHaveLength(0));
      rerender(composer(makeTask(), { question: { ...asking(), requestId: "req-2" } }));
      paste([png("next.png")]);
      await screen.findByRole("list", { name: "Attached images" });

      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it("sends a quick reply without the images", async () => {
      const chips = [{ key: "a", text: "Per key" }];
      const { user } = renderWithStore(composer(makeTask(), { chips }));
      paste([png()]);
      await screen.findByRole("list", { name: "Attached images" });

      await user.click(screen.getByRole("button", { name: "a · Per key" }));

      expect(api.sendMessage).toHaveBeenCalledWith("task-1", "prd", "a", []);
      expect(attached()).toHaveLength(1);
    });
  });
});
