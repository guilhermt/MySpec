import { screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Composer, type ComposerProps } from "@/features/chat/Composer";
import { QuestionCard } from "@/features/chat/entries/QuestionCard";
import type { SessionState } from "@/features/chat/session";
import { api, type QuestionEntry } from "@/lib/wails";
import { useAppStore } from "@/store/app-store";
import { renderWithStore } from "@/test/render";
import { makeState, makeTask } from "@/test/wails-mock";

const DRAFT = { "task-1|prd": "ship it" };
const REST = { findings: false, askForChange: false };
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

    expect(api.sendMessage).toHaveBeenCalledWith("task-1", "prd", "ship it");
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

    expect(api.sendMessage).toHaveBeenCalledWith("task-1", "step:1", "hi");
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

    expect(api.sendMessage).toHaveBeenCalledWith("task-1", "prd", "ship it");
  });

  it("resumes the paused task and then sends the message", async () => {
    const task = makeTask({ sessionStatus: "paused" });
    const { user } = renderWithStore(composer(task), { ui: { drafts: DRAFT } });

    expect(field()).toHaveAttribute("placeholder", "Sending resumes the task…");
    expect(screen.queryByRole("button", { name: "Resume" })).not.toBeInTheDocument();

    await user.click(field());
    await user.keyboard("{Enter}");

    await waitFor(() => expect(api.sendMessage).toHaveBeenCalledWith("task-1", "prd", "ship it"));
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

  it("sends a quick reply without touching the draft", async () => {
    const chips = [
      { key: "a", text: "Per key" },
      { key: "b", text: "Per plan" },
    ];
    const { user } = renderWithStore(composer(makeTask(), { chips }), { ui: { drafts: DRAFT } });

    expect(field()).toHaveAttribute("placeholder", "Answer a or b, or reply to the PRD agent…");
    await user.click(screen.getByRole("button", { name: "b · Per plan" }));

    expect(api.sendMessage).toHaveBeenCalledWith("task-1", "prd", "b");
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
    expect(field()).toHaveValue("");
    await waitFor(() => expect(useAppStore.getState().questionChoices["req-1"]).toBeUndefined());
  });

  it("tells under the field that the answer was not sent, without the app notice", async () => {
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
    expect(useAppStore.getState().questionChoices["req-1"]).toEqual({
      0: { labels: ["Per key"], other: null },
      1: { labels: [], other: "Disk" },
    });
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

  it("never gives way to the conversation above it", () => {
    renderWithStore(composer(makeTask({ sessionStatus: "paused" })));

    const box = field().closest("div.shrink-0");
    expect(box).toHaveClass("pt-(--space-2)", "pb-(--space-4)");
  });
});
